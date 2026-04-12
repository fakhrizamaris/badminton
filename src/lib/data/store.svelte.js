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
	isReady: false
});

/**
 * Initialize all database data
 */
export async function initDB() {
	if (db.isReady) return;
	
	try {
		const [sRes, pRes, gRes, setRes] = await Promise.all([
			supabase.from('sessions').select('*').order('created_at', { ascending: false }),
			supabase.from('participants').select('*').order('created_at', { ascending: true }),
			supabase.from('gallery').select('*').order('created_at', { ascending: false }),
			supabase.from('settings').select('*').eq('id', 'global').single()
		]);

		if (sRes.data) db.sessions = sRes.data;
		if (pRes.data) db.participants = pRes.data;
		if (gRes.data) db.gallery = gRes.data;
		if (setRes.data) db.settings = setRes.data;
		
		db.isReady = true;
	} catch (err) {
		console.error('Failed to init DB:', err);
		// Fallback minimal agar app tidak crash
		db.isReady = true;
	}
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
	for (const file of files) {
		const compressed = await compressImage(file);
		const fileName = `gallery-${Date.now()}-${Math.random().toString(36).substring(7)}.jpg`;
		
		const { data: uploadData, error: uploadError } = await safeUpload('gallery', fileName, compressed);

		if (uploadError) throw uploadError;

		const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(fileName);
		const { error: dbError } = await supabase.from('gallery').insert([{
			url: urlData.publicUrl,
			caption: ''
		}]);

		if (dbError) throw dbError;
	}
	
	// Refresh gallery
	const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
	if (data) db.gallery = data;
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
	const compressed = await compressImage(file);
	const fileName = `settings-qris-${Date.now()}.jpg`;
	
	const { error: uploadError } = await safeUpload('gallery', fileName, compressed);

	if (uploadError) throw uploadError;

	const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(fileName);
	
	const { error: dbError } = await supabase
		.from('settings')
		.update({ qris_url: urlData.publicUrl, updated_at: new Date().toISOString() })
		.eq('id', 'global');

	if (dbError) throw dbError;
	
	db.settings.qris_url = urlData.publicUrl;
}

export async function uploadPaymentProof(participantId, file) {
	const fileExt = file.name.split('.').pop();
	const fileName = `proof-${participantId}-${Date.now()}.${fileExt}`;
	const filePath = `payments/${fileName}`;

	// 1. Kompresi gambar dulu
	const compressedBlob = await compressImage(file);

	// 2. Upload ke Storage
	const { data: sData, error: sError } = await safeUpload('gallery', filePath, compressedBlob, {
		contentType: 'image/jpeg'
	});

	if (sError) throw sError;

	// 2. Ambil URL
	const { data: { publicUrl } } = supabase.storage
		.from('gallery')
		.getPublicUrl(filePath);

	// 3. Update Participant table
	const { error: dbError } = await supabase
		.from('participants')
		.update({ payment_proof_url: publicUrl })
		.eq('id', participantId);

	if (dbError) throw dbError;

	// 4. Update Local State
	const p = db.participants.find(p => p.id === participantId);
	if (p) p.payment_proof_url = publicUrl;
	
	return publicUrl;
}

/**
 * Kompresi gambar di sisi klien sebelum diupload
 * @param {File} file 
 * @returns {Promise<Blob>}
 */
async function compressImage(file) {
	return new Promise((resolve) => {
		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onload = (event) => {
			const img = new Image();
			img.src = event.target.result;
			img.onload = () => {
				const canvas = document.createElement('canvas');
				const MAX_WIDTH = 800; // Optimal untuk bukti transfer
				let width = img.width;
				let height = img.height;

				if (width > MAX_WIDTH) {
					height *= MAX_WIDTH / width;
					width = MAX_WIDTH;
				}

				canvas.width = width;
				canvas.height = height;
				const ctx = canvas.getContext('2d');
				ctx.drawImage(img, 0, 0, width, height);

				canvas.toBlob((blob) => {
					resolve(blob);
				}, 'image/jpeg', 0.7); // Kualitas 70% sudah sangat cukup
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

export async function addParticipant(sessionId, name, needsRacket) {
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
