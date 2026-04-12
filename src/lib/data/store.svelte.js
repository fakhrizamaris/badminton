import { supabase } from '$lib/supabaseClient';

export const appConfig = $state({
	admin_pin: '1234',
	maps_embed_url:
		'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.043588102927!2d104.09582577508493!3d1.1262423988636437!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31d9894e77227d81%3A0x633d7b9735d1f874!2sAxton%20Botania%20Badminton%20Hall!5e0!3m2!1sen!2sid!4v1712900000000!5m2!1sen!2sid'
});

export const db = $state({
	sessions: [],
	participants: [],
	gallery: [],
	settings: { qris_url: null },
	theme: 'light',
	isReady: false
});

/**
 * Derived Statistics for Admin Dashboard
 */
const stats = $derived.by(() => {
	if (!db.participants.length) return { totalRevenue: 0, totalPlayers: 0, uniquePlayers: 0, growth: 0 };
	
	const paidParticipants = db.participants.filter(p => p.has_paid);
	const totalRevenue = paidParticipants.reduce((acc, p) => {
		const session = db.sessions.find(s => s.id === p.session_id);
		return acc + (session ? calcPlayerCost(session, db.participants.filter(dp => dp.session_id === session.id), p.needs_racket) : 0);
	}, 0);
	
	const uniquePlayers = new Set(
		db.participants
			.filter(p => p && p.name)
			.map(p => p.name.toLowerCase().trim())
	).size;
	
	return {
		totalRevenue,
		totalPlayers: db.participants.length,
		uniquePlayers,
		activeSessions: db.sessions.filter(s => s && !isSessionPassed(s)).length
	};
});

export const getCommunityStats = () => stats;

/**
 * Initialize all database data
 */
export async function initDB() {
	if (db.isReady) return;
	
	try {
		console.log('🚀 Initializing DB...');
		
		// 1. Prioritize sessions (schedule) for instant UI feedback
		const sessionPromise = supabase.from('sessions').select('*').order('created_at', { ascending: false });
		
		// 2. Prepare secondary data in the background
		const backgroundPromise = Promise.all([
			supabase.from('participants').select('*').order('created_at', { ascending: true }),
			supabase.from('gallery').select('*').order('created_at', { ascending: false }),
			supabase.from('settings').select('*').eq('id', 'global').maybeSingle()
		]);

		// Add a fail-safe timeout for the critical initial data
		const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('TIMEOUT')), 8000));

		try {
			const { data: sData } = await Promise.race([sessionPromise, timeoutPromise]);
			if (sData) {
				console.log('✅ Sessions loaded');
				db.sessions = sData;
			}
		} catch (err) {
			console.warn('⚠️ Session load slow or timed out. Moving on to unblock UI.');
		}
		
		// Immediately enable UI even if background data is still loading
		db.isReady = true;

		// Load theme (instant)
		const savedTheme = localStorage.getItem('app_theme') || 'light';
		db.theme = savedTheme;
		applyTheme(savedTheme);

		// Update secondary data asynchronously
		const [pRes, gRes, setRes] = await backgroundPromise;
		if (pRes.data) db.participants = pRes.data;
		if (gRes.data) db.gallery = gRes.data;
		if (setRes.data) db.settings = setRes.data || db.settings;
		console.log('🏁 DB Ready');

	} catch (err) {
		console.error('❌ Failed to init DB:', err);
		// Minimal fallback to avoid stuck UI
		db.isReady = true;
	}
}

function applyTheme(theme) {
	if (typeof document !== 'undefined') {
		if (theme === 'dark') {
			document.documentElement.classList.add('dark-mode');
		} else {
			document.documentElement.classList.remove('dark-mode');
		}
	}
}

export function toggleTheme() {
	db.theme = db.theme === 'light' ? 'dark' : 'light';
	localStorage.setItem('app_theme', db.theme);
	applyTheme(db.theme);
}

/**
 * Helper to upload file and auto-create bucket if missing
 */
async function safeUpload(bucket, path, file, options = {}) {
	const { data, error } = await supabase.storage.from(bucket).upload(path, file, options);
	
	if (error && error.message.includes('Bucket not found')) {
		console.log(`Auto-creating missing bucket: ${bucket}...`);
		const { error: createError } = await supabase.storage.createBucket(bucket, { public: true });
		
		if (createError) {
			alert(`⚠️ SISTEM GAGAL MENGUPLOAD GAMBAR.\n\nEror: Folder/Bucket bernama '${bucket}' belum dibuat di Supabase.\n\nSOLUSI UNTUK ADMIN:\n1. Buka Dashboard Supabase\n2. Buka menu Storage\n3. Klik "New Bucket" lalu beri nama: ${bucket}\n4. Centang "Public bucket" lalu Save.`);
			throw new Error(`Please create the '${bucket}' bucket in Supabase manually.`);
		}
		
		// Retry upload after bucket creation
		return await supabase.storage.from(bucket).upload(path, file, options);
	}
	
	return { data, error };
}

export async function uploadGalleryImages(files) {
	console.log(`📸 Starting upload of ${files.length} images...`);
	for (let i = 0; i < files.length; i++) {
		const file = files[i];
		console.log(`[${i+1}/${files.length}] Compressing...`);
		const compressed = await compressImage(file, 'gallery');
		
		const fileName = `gallery-${Date.now()}-${Math.random().toString(36).substring(7)}.webp`;
		console.log(`[${i+1}/${files.length}] Uploading ${fileName}...`);
		
		const { data: uploadData, error: uploadError } = await safeUpload('gallery', fileName, compressed, {
			contentType: 'image/webp'
		});

		if (uploadError) {
			console.error(`❌ Upload failed for ${fileName}:`, uploadError);
			throw uploadError;
		}

		console.log(`[${i+1}/${files.length}] Accessing URL...`);
		const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(fileName);
		const publicUrlWithCache = `${urlData.publicUrl}?t=${Date.now()}`;

		console.log(`[${i+1}/${files.length}] Saving to DB...`);
		const { error: dbError } = await supabase.from('gallery').insert([{
			url: publicUrlWithCache,
			caption: ''
		}]);

		if (dbError) {
			console.error(`❌ DB insert failed:`, dbError);
			throw dbError;
		}
		console.log(`✅ Image ${i+1} done`);
	}
	
	// Refresh gallery
	console.log('🔄 Refreshing local gallery state...');
	const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
	if (data) db.gallery = data;
	console.log('🏁 All uploads complete');
}

export async function deleteGalleryImage(id, url) {
	try {
		// Hapus dari bucket storage (ambil filename dari URL)
		const fileName = url.split('/').pop();
		if (fileName) {
			await supabase.storage.from('gallery').remove([fileName]);
		}

		// Hapus record dari database
		const { error } = await supabase.from('gallery').delete().eq('id', id);
		if (error) throw error;

		// Update UI/State
		db.gallery = db.gallery.filter(item => item.id !== id);
	} catch (err) {
		console.error('Failed to delete gallery image:', err);
		throw err;
	}
}

/**
 * Update global QRIS image
 * @param {File} file 
 */
export async function updateQRIS(file) {
	const compressed = await compressImage(file, 'proof');
	const fileName = `settings-qris-${Date.now()}.webp`;
	
	const { error: uploadError } = await safeUpload('gallery', `settings/${fileName}`, compressed, {
		contentType: 'image/webp'
	});

	if (uploadError) throw uploadError;

	const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(`settings/${fileName}`);
	const publicUrlWithCache = `${urlData.publicUrl}?t=${Date.now()}`;
	
	const { error: dbError } = await supabase
		.from('settings')
		.update({ qris_url: publicUrlWithCache, updated_at: new Date().toISOString() })
		.eq('id', 'global');

	if (dbError) throw dbError;
	
	db.settings.qris_url = publicUrlWithCache;
}

export async function uploadPaymentProof(participantId, file) {
	const fileName = `proof-${participantId}-${Date.now()}.webp`;

	// 1. Kompresi gambar dulu
	const compressedBlob = await compressImage(file, 'proof');

	// 2. Upload ke Storage - BUCKET: proofs, FOLDER: payment
	const filePath = `payment/${fileName}`;
	const { data: sData, error: sError } = await safeUpload('proofs', filePath, compressedBlob, {
		contentType: 'image/webp'
	});

	if (sError) throw sError;

	// 2. Ambil URL (dari bucket proofs/payment)
	const { data: { publicUrl } } = supabase.storage
		.from('proofs')
		.getPublicUrl(filePath);

	// 3. Update DB
	const { error: dbError } = await supabase
		.from('participants')
		.update({ payment_proof_url: publicUrl })
		.eq('id', participantId);

	if (dbError) throw dbError;

	// Sync local state
	const p = db.participants.find((p) => p.id === participantId);
	if (p) p.payment_proof_url = publicUrl;
	
	return publicUrl;
}

/**
 * Kompresi gambar di sisi klien sebelum diupload
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
/**
 * Image Compression with WebP & High-Performance Canvas
 * @param {File} file 
 * @param {'gallery' | 'proof'} type 
 */
async function compressImage(file, type = 'gallery') {
	return new Promise((resolve, reject) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onerror = (e) => reject(e);
		reader.onload = (event) => {
			const img = new Image();
			img.src = event.target.result;
			img.onload = () => {
				const canvas = document.createElement('canvas');
				
				const MAX_WIDTH = type === 'gallery' ? 1200 : 800;
				const QUALITY = type === 'gallery' ? 0.8 : 0.6;
				
				let width = img.width;
				let height = img.height;

				if (width > MAX_WIDTH) {
					height *= MAX_WIDTH / width;
					width = MAX_WIDTH;
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				
				ctx.imageSmoothingEnabled = true;
				ctx.imageSmoothingQuality = 'high';
				ctx.drawImage(img, 0, 0, width, height);

				canvas.toBlob((blob) => {
					if (!blob) {
						reject(new Error('Compression failed'));
						return;
					}
					// Convert Blob to File for more robust upload handling
					const newFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".webp", {
						type: 'image/webp'
					});
					resolve(newFile);
				}, 'image/webp', QUALITY);
			};
		};
	});
}

// ── CRUD Helpers ──────────────────────────────────────────────────

export function getSession(id) {
	return db.sessions.find((s) => s.id === id);
}

export function getParticipants(sessionId) {
	return db.participants.filter((p) => p.session_id === sessionId);
}

export function getParticipantByTicket(ticketId) {
	if (!ticketId) return null;
	return db.participants.find((p) => p.ticket_id === ticketId.toUpperCase());
}

let lastRSVP = 0;
export async function addParticipant(sessionId, name, needsRacket) {
	// 1. Rate Limiting (prevent spam)
	const now = Date.now();
	if (now - lastRSVP < 2000) {
		console.warn('Rate limit exceeded');
		return null;
	}
	lastRSVP = now;

	// 2. Client-side Duplicate Check (Double safety)
	const isDuplicate = db.participants.some(p => p.session_id === sessionId && p.name.toLowerCase() === name.toLowerCase());
	if (isDuplicate) {
		console.error('Safe guard: Participant already exists');
		return null;
	}

	const { data, error } = await supabase
		.from('participants')
		.insert([{ session_id: sessionId, name, needs_racket: needsRacket, has_paid: false }])
		.select();
	if (data && data[0]) {
		// Menggunakan reassignment agar reaktivitas Svelte 5 terpicu dengan pasti
		db.participants = [...db.participants, data[0]];
		return data[0];
	}
	if (error) console.error('Add participant error:', error);
	return null;
}

export async function removeParticipant(participantId) {
	const { error } = await supabase.from('participants').delete().eq('id', participantId);
	if (!error) {
		db.participants = db.participants.filter((p) => p.id !== participantId);
	}
}

export async function toggleLock(sessionId) {
	const session = getSession(sessionId);
	if (session) {
		const newStatus = !session.is_locked;
		const { error } = await supabase.from('sessions').update({ is_locked: newStatus }).eq('id', sessionId);
		if (!error) session.is_locked = newStatus;
	}
}

export async function markPaid(participantId) {
	const p = db.participants.find((p) => p.id === participantId);
	if (p) {
		const { error } = await supabase.from('participants').update({ has_paid: true }).eq('id', participantId);
		if (!error) p.has_paid = true;
	}
}

export async function togglePaid(participantId) {
	const p = db.participants.find((p) => p.id === participantId);
	if (p) {
		const newStatus = !p.has_paid;
		const { error } = await supabase.from('participants').update({ has_paid: newStatus }).eq('id', participantId);
		if (!error) p.has_paid = newStatus;
	}
}

export async function createSession(title, date, time, subtitle, courtCount, racketCount) {
	const { data, error } = await supabase
		.from('sessions')
		.insert([
			{
				title,
				date,
				time: time || '7PM',
				subtitle: subtitle || 'Mixed Levels',
				court_count: courtCount,
				racket_count: racketCount,
				is_locked: false
			}
		])
		.select();
		
	if (data && data[0]) {
		db.sessions = [data[0], ...db.sessions];
		return data[0];
	}
	if (error) console.error('Create session error:', error);
	return null;
}

// ── Pricing Logic ──────────────────────────────────────────────────

export function calcCourtShare(session, sessionParticipants) {
	if (!session || !sessionParticipants || sessionParticipants.length === 0) return 0;
	const count = sessionParticipants.length;
	return Math.ceil(((session.court_count || 0) * 77000) / count);
}

export function calcRacketShare(session, sessionParticipants) {
	if (!session || !sessionParticipants || (session.racket_count || 0) === 0) return 0;
	const renters = sessionParticipants.filter((p) => p?.needs_racket);
	if (renters.length === 0) return 0;
	const renterCount = renters.length;
	return Math.ceil(((session.racket_count || 0) * 20000) / renterCount);
}

export function calcPlayerCost(session, sessionParticipants, needsRacket) {
	if (!session || !sessionParticipants) return 0;
	const courtShare = calcCourtShare(session, sessionParticipants);
	if (needsRacket) {
		return courtShare + calcRacketShare(session, sessionParticipants);
	}
	return courtShare;
}

export function calcTotalCost(session) {
	if (!session) return 0;
	return (session.court_count || 0) * 77000 + (session.racket_count || 0) * 20000;
}

export function isRSVPOpen(session) {
	if (!session || !session.date) return false;
	
	try {
		// Bersihkan format jam (misal "2 PM - 4 PM" -> "2 PM")
		const rawTime = (session.time || "00:00").split(' - ')[0].trim();
		let hours = 0;
		let minutes = 0;

		if (rawTime.includes(':')) {
			// Format HH:mm
			[hours, minutes] = rawTime.split(':').map(n => parseInt(n));
		} else {
			// Format 2 PM / 7PM
			const match = rawTime.match(/(\d+)\s*(AM|PM)/i);
			if (match) {
				hours = parseInt(match[1]);
				const ampm = match[2].toUpperCase();
				if (ampm === 'PM' && hours < 12) hours += 12;
				if (ampm === 'AM' && hours === 12) hours = 0;
			} else {
				// Default jika hanya angka
				hours = parseInt(rawTime) || 0;
			}
		}

		const sessionDate = new Date(`${session.date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
		const now = new Date();
		
		if (isNaN(sessionDate.getTime())) return true; // Fallback jika parsing gagal, anggap saja buka

		// RSVP dibuka sampai 2 jam sebelum sesi mulai
		const hourDiff = (sessionDate - now) / (1000 * 60 * 60);
		return hourDiff > 2;
	} catch (e) {
		return true; // Jika ada error parsing, biarkan RSVP terbuka
	}
}

export function isSessionPassed(session) {
	if (!session || !session.date) return false;
	
	try {
		// Dapatkan waktu akhir jika ada "19:00 - 23:00", ambil "23:00". Jika cuma "19:00", anggap akhir=mulai
		const parts = (session.time || "00:00").split(' - ');
		const rawTime = (parts.length > 1 ? parts[1] : parts[0]).trim();
		
		let hours = 0;
		let minutes = 0;

		if (rawTime.includes(':')) {
			[hours, minutes] = rawTime.split(':').map(n => parseInt(n));
		} else {
			const match = rawTime.match(/(\d+)\s*(AM|PM)/i);
			if (match) {
				hours = parseInt(match[1]);
				const ampm = match[2].toUpperCase();
				if (ampm === 'PM' && hours < 12) hours += 12;
				if (ampm === 'AM' && hours === 12) hours = 0;
			} else {
				hours = parseInt(rawTime) || 0;
			}
		}

		const sessionEndDate = new Date(`${session.date}T${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:00`);
		const now = new Date();
		
		if (isNaN(sessionEndDate.getTime())) return false; 
		
		return now > sessionEndDate;
	} catch (e) {
		return false; 
	}
}

export async function deleteSession(sessionId) {
	const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
	if (!error) {
		db.sessions = db.sessions.filter(s => s.id !== sessionId);
		// Karena ada relasi cascade di database (idealnya), participants akan terhapus otomatis di sisi server.
		// Namun kita juga perlu membersihkan dari array statis agar UI ter-update:
		db.participants = db.participants.filter(p => p.session_id !== sessionId);
	} else {
		console.error("Gagal menghapus sesi:", error);
	}
}
/**
 * UX Helpers: Confetti & Haptics
 */
export async function triggerConfetti() {
	try {
		const confetti = (await import('https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm')).default;
		confetti({
			particleCount: 150,
			spread: 70,
			origin: { y: 0.6 },
			colors: ['#15335E', '#34C759', '#FFFFFF']
		});
	} catch (e) {
		console.warn('Confetti failed to load');
	}
}

export function triggerHaptic(type = 'medium') {
	if (!window.navigator.vibrate) return;
	
	const patterns = {
		light: 10,
		medium: 20,
		error: [50, 30, 50],
		success: [20, 10, 20]
	};
	
	window.navigator.vibrate(patterns[type] || 20);
}

/**
 * Feature: Add to Calendar
 */
export function addToCalendar(session) {
	if (!session) return;
	
	const date = session.date.replace(/-/g, '');
	const startTime = (session.time || "19:00").split(' - ')[0].replace(':', '') + '00';
	const endTime = (session.time || "21:00").split(' - ')[1]?.replace(':', '') + '00' || '210000';
	
	const title = encodeURIComponent(`Badminton Session: ${session.title}`);
	const details = encodeURIComponent(`Badminton session at Axton Hall. Subtitle: ${session.subtitle}`);
	const location = encodeURIComponent('Axton Badminton Hall, Botania 1, Batam');
	
	// Create Google Calendar Link
	const gCalUrl = `https://www.google.com/calendar/render?action=TEMPLATE&text=${title}&details=${details}&location=${location}&dates=${date}T${startTime}/${date}T${endTime}`;
	
	window.open(gCalUrl, '_blank');
}
