import { supabase } from '$lib/supabaseClient';

export const appConfig = $state({
	admin_pin: '1234',
	maps_embed_url:
		'https://maps.google.com/maps?q=1.126242,104.095825&hl=id&z=17&output=embed'
});

export const db = $state({
	sessions: [],
	participants: [],
	gallery: [],
	settings: { qris_url: null },
	theme: 'light',
	isReady: false,
	toasts: [],
	confirm: null
});

// ── Date Folder Helper ────────────────────────────────────────────

/**
 * Hasilkan nama folder dari Date object.
 * Output: "13-April-2026"
 * @param {Date} date
 * @returns {string}
 */
function getDateFolderName(date = new Date()) {
	const day   = String(date.getDate()).padStart(2, '0');
	const month = date.toLocaleString('en-US', { month: 'long' }); // "April"
	const year  = date.getFullYear();
	return `${day}-${month}-${year}`;
}

// ── ID Generators ──────────────────────────────────────────────────

function generateTicketId() {
	const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid O, I, 1, 0
	let result = '';
	for (let i = 0; i < 6; i++) {
		result += chars.charAt(Math.floor(Math.random() * chars.length));
	}
	return result;
}

function generateUniqueCode() {
	return Math.floor(Math.random() * 900) + 100; // 100-999
}

// ── Derived Stats ─────────────────────────────────────────────────

const stats = $derived.by(() => {
	if (!db.participants.length)
		return { totalRevenue: 0, totalPlayers: 0, uniquePlayers: 0, activeSessions: 0 };

	const paidParticipants = db.participants.filter(p => p.has_paid);
	const totalRevenue = paidParticipants.reduce((acc, p) => {
		const session = db.sessions.find(s => s.id === p.session_id);
		return acc + (session
			? calcPlayerCost(session, db.participants.filter(dp => dp.session_id === session.id), p.needs_racket)
			: 0);
	}, 0);

	const uniquePlayers = new Set(
		db.participants.filter(p => p?.name).map(p => p.name.toLowerCase().trim())
	).size;

	return {
		totalRevenue,
		totalPlayers: db.participants.length,
		uniquePlayers,
		activeSessions: db.sessions.filter(s => s && !isSessionPassed(s)).length
	};
});

export const getCommunityStats = () => stats;

// ── DB Init ───────────────────────────────────────────────────────

let initDBPromise = null;

export async function initDB() {
	if (db.isReady) return;
	if (initDBPromise) return initDBPromise;

	initDBPromise = (async () => {
		try {
			console.log('🚀 Initializing DB...');

			const sessionPromise = supabase
				.from('sessions').select('*').order('created_at', { ascending: false });

			const backgroundPromise = Promise.all([
				supabase.from('participants').select('*').order('created_at', { ascending: true }),
				supabase.from('gallery').select('*').order('created_at', { ascending: false }),
				supabase.from('settings').select('*').eq('id', 'global').maybeSingle()
			]);

			const timeoutPromise = new Promise((_, reject) =>
				setTimeout(() => reject(new Error('TIMEOUT')), 8000)
			);

			try {
				const { data: sData } = await Promise.race([sessionPromise, timeoutPromise]);
				if (sData) { db.sessions = sData; console.log('✅ Sessions loaded'); }
			} catch {
				console.warn('⚠️ Session load timed out.');
			}

			db.isReady = true;

			const savedTheme = localStorage.getItem('app_theme') || 'light';
			db.theme = savedTheme;
			applyTheme(savedTheme);

			const [pRes, gRes, setRes] = await backgroundPromise;
			if (pRes.data)  db.participants = pRes.data;
			if (gRes.data)  db.gallery      = gRes.data;
			if (setRes.data) db.settings    = setRes.data || db.settings;
			console.log('🏁 DB Ready');

		} catch (err) {
			console.error('❌ Failed to init DB:', err);
			db.isReady = true;
		} finally {
			initDBPromise = null;
		}
	})();

	return initDBPromise;
}

function applyTheme(theme) {
	if (typeof document === 'undefined') return;
	document.documentElement.classList.toggle('dark-mode', theme === 'dark');
}

export function toggleTheme() {
	db.theme = db.theme === 'light' ? 'dark' : 'light';
	localStorage.setItem('app_theme', db.theme);
	applyTheme(db.theme);
}

// ── Notifications ─────────────────────────────────────────────────

export function showToast(message, type = 'info') {
	const id = Math.random().toString(36).substring(2, 9);
	db.toasts = [...db.toasts, { id, message, type }];

	setTimeout(() => {
		db.toasts = db.toasts.filter(t => t.id !== id);
	}, 3500);
}

export function askConfirm({ title, message, confirmText = 'Ya, Lanjutkan', cancelText = 'Batal', type = 'info' }) {
	return new Promise((resolve) => {
		db.confirm = {
			title,
			message,
			confirmText,
			cancelText,
			type,
			resolve: (val) => {
				db.confirm = null;
				resolve(val);
			}
		};
	});
}

// ── Storage: safeUpload ───────────────────────────────────────────

/**
 * Upload ke Supabase Storage.
 * Bucket HARUS sudah dibuat manual di Supabase Dashboard sebagai Public bucket.
 */
async function safeUpload(bucket, path, file, options = {}) {
	const { data, error } = await supabase.storage
		.from(bucket)
		.upload(path, file, { ...options, upsert: false });

	if (error) {
		if (error.message?.includes('Bucket not found') || error.statusCode === '404') {
			const msg =
				`❌ Bucket "${bucket}" tidak ditemukan di Supabase Storage.\n\n` +
				`Solusi:\n` +
				`1. Buka Supabase Dashboard → Storage\n` +
				`2. New Bucket → nama: "${bucket}"\n` +
				`3. Centang "Public bucket" → Save\n` +
				`4. Coba upload lagi.`;
			alert(msg);
			throw new Error(msg);
		}
		if (error.message?.includes('already exists') || error.statusCode === '409') {
			console.warn(`⚠️ File sudah ada di ${path}, dianggap sukses.`);
			return { data: { path }, error: null };
		}
		console.error(`❌ Upload gagal → bucket:"${bucket}" path:"${path}"`, error);
		throw error;
	}

	return { data, error: null };
}

// ── Gallery Upload ────────────────────────────────────────────────

/**
 * Upload foto ke bucket "gallery" dengan folder tanggal otomatis.
 *
 * Struktur path di Supabase Storage:
 *   gallery/
 *   └── 13-April-2026/
 *       ├── 1744123456789-ab3f.webp
 *       └── 1744123456999-xy7z.webp
 *
 * @param {File[]} files
 */
export async function uploadGalleryImages(files) {
	console.log(`📸 Uploading ${files.length} image(s)...`);

	// Folder otomatis = tanggal hari ini saat tombol upload ditekan
	const folderName = getDateFolderName(new Date());
	console.log(`📁 Folder target: ${folderName}`);

	for (let i = 0; i < files.length; i++) {
		const file = files[i];

		console.log(`[${i+1}/${files.length}] Compressing "${file.name}"...`);
		const compressed = await compressImage(file, 'gallery');

		// Nama file unik: "<timestamp>-<random>.webp"
		const suffix   = `${Date.now()}-${Math.random().toString(36).substring(2, 8)}`;
		const filePath = `${folderName}/${suffix}.webp`;

		console.log(`[${i+1}/${files.length}] Uploading → ${filePath}`);
		const { error: uploadError } = await safeUpload('gallery', filePath, compressed, {
			contentType: 'image/webp'
		});
		if (uploadError) throw uploadError;

		// Ambil URL publik — BERSIH tanpa query param apapun
		const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(filePath);
		const cleanUrl = urlData.publicUrl;

		console.log(`[${i+1}/${files.length}] Simpan ke DB → ${cleanUrl}`);
		const { error: dbError } = await supabase.from('gallery').insert([{
			url:     cleanUrl,
			caption: '',
			folder:  folderName   // disimpan untuk keperluan grouping di UI
		}]);
		if (dbError) throw dbError;

		console.log(`✅ [${i+1}/${files.length}] Done`);
	}

	// Refresh state
	const { data } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
	if (data) db.gallery = data;
	console.log('🏁 Upload selesai');
}

export async function deleteGalleryImage(id, url) {
	try {
		// Ambil path relatif dari URL publik Supabase
		// Format URL: https://xxx.supabase.co/storage/v1/object/public/gallery/13-April-2026/file.webp
		const cleanUrl  = url.split('?')[0];
		const marker    = '/object/public/gallery/';
		const idx       = cleanUrl.indexOf(marker);
		const filePath  = idx !== -1
			? cleanUrl.substring(idx + marker.length)   // "13-April-2026/file.webp"
			: cleanUrl.split('/').pop();                  // fallback: filename saja

		console.log(`🗑️ Hapus dari storage: ${filePath}`);
		const { error: storageErr } = await supabase.storage.from('gallery').remove([filePath]);
		if (storageErr) console.warn('Storage delete (non-fatal):', storageErr.message);

		const { error: dbErr } = await supabase.from('gallery').delete().eq('id', id);
		if (dbErr) throw dbErr;

		db.gallery = db.gallery.filter(item => item.id !== id);
		console.log('✅ Gambar dihapus');
	} catch (err) {
		console.error('Gagal hapus gambar:', err);
		throw err;
	}
}

// ── QRIS ──────────────────────────────────────────────────────────

export async function updateQRIS(file) {
	const compressed = await compressImage(file, 'proof');
	const filePath   = `settings/qris-${Date.now()}.webp`;

	const { error: upErr } = await safeUpload('gallery', filePath, compressed, {
		contentType: 'image/webp'
	});
	if (upErr) throw upErr;

	const { data: urlData } = supabase.storage.from('gallery').getPublicUrl(filePath);
	const cleanUrl = urlData.publicUrl;

	const { error: dbErr } = await supabase
		.from('settings')
		.update({ qris_url: cleanUrl, updated_at: new Date().toISOString() })
		.eq('id', 'global');
	if (dbErr) throw dbErr;

	db.settings.qris_url = cleanUrl;
}

export async function updateMapsUrl(newUrl) {
	// Pastikan kita hanya mengambil URL jika user memasukkan tag iframe lengkap
	let cleanUrl = newUrl.trim();
	if (cleanUrl.includes('<iframe')) {
		const match = cleanUrl.match(/src="([^"]+)"/);
		if (match) cleanUrl = match[1];
	}

	const { error } = await supabase
		.from('settings')
		.upsert({ 
			id: 'global',
			maps_url: cleanUrl, 
			updated_at: new Date().toISOString() 
		});

	if (!error) {
		db.settings.maps_url = cleanUrl;
	} else {
		console.error('Update maps error:', error);
		throw error;
	}
}

// ── Payment Proof ─────────────────────────────────────────────────

export async function uploadPaymentProof(participantId, file) {
	const compressed = await compressImage(file, 'proof');
	const filePath   = `payment/proof-${participantId}-${Date.now()}.webp`;

	const { error: upErr } = await safeUpload('proofs', filePath, compressed, {
		contentType: 'image/webp'
	});
	if (upErr) throw upErr;

	const { data: { publicUrl } } = supabase.storage.from('proofs').getPublicUrl(filePath);

	// Perbarui URL dan set status ke 'pending'
	const { error: dbErr } = await supabase
		.from('participants')
		.update({ 
			payment_proof_url: publicUrl,
			payment_status: 'pending' 
		})
		.eq('id', participantId);
	if (dbErr) throw dbErr;

	const p = db.participants.find(p => p.id === participantId);
	if (p) {
		p.payment_proof_url = publicUrl;
		p.payment_status = 'pending';
	}

	return publicUrl;
}

// ── Image Compression ─────────────────────────────────────────────

/**
 * Kompres gambar ke WebP via Canvas.
 * Fallback ke file original jika Canvas gagal (Safari/WebKit).
 * @param {File} file
 * @param {'gallery'|'proof'} type
 * @returns {Promise<File>}
 */
async function compressImage(file, type = 'gallery') {
	return new Promise((resolve, reject) => {
		if (!file.type.startsWith('image/')) {
			reject(new Error(`"${file.name}" bukan file gambar.`));
			return;
		}

		const reader = new FileReader();
		reader.readAsDataURL(file);
		reader.onerror = () => reject(new Error('Gagal membaca file'));

		reader.onload = (e) => {
			const img = new Image();
			img.src = e.target.result;

			img.onerror = () => {
				console.warn('Gagal decode gambar — pakai original');
				resolve(file);
			};

			img.onload = () => {
				try {
					const MAX_W   = type === 'gallery' ? 1200 : 800;
					const QUALITY = type === 'gallery' ? 0.82  : 0.65;
					let { width, height } = img;

					if (!width || !height) { resolve(file); return; }

					if (width > MAX_W) {
						height = Math.round(height * MAX_W / width);
						width  = MAX_W;
					}

					const canvas = document.createElement('canvas');
					canvas.width  = width;
					canvas.height = height;

					const ctx = canvas.getContext('2d');
					if (!ctx) { resolve(file); return; }

					ctx.imageSmoothingEnabled = true;
					ctx.imageSmoothingQuality = 'high';
					ctx.drawImage(img, 0, 0, width, height);

					canvas.toBlob((blob) => {
						// Safari kadang return null
						if (!blob) {
							console.warn('canvas.toBlob() null — pakai original');
							resolve(file);
							return;
						}
						if (blob.size >= file.size) {
							// Kompresi justru lebih besar, pakai original
							resolve(file);
							return;
						}
						const baseName   = file.name.replace(/\.[^/.]+$/, '');
						const compressed = new File([blob], `${baseName}.webp`, { type: 'image/webp' });
						console.log(`🗜️ ${(file.size/1024).toFixed(1)}KB → ${(compressed.size/1024).toFixed(1)}KB`);
						resolve(compressed);
					}, 'image/webp', QUALITY);

				} catch (err) {
					console.error('Canvas error — pakai original:', err);
					resolve(file);
				}
			};
		};
	});
}

// ── CRUD ─────────────────────────────────────────────────────────

export function getSession(id) {
	return db.sessions.find(s => s.id === id);
}

export function getParticipants(sessionId) {
	return db.participants.filter(p => p.session_id === sessionId);
}

export function getParticipantByTicket(ticketId) {
	if (!ticketId) return null;
	return db.participants.find(p => p.ticket_id === ticketId.toUpperCase());
}

let lastRSVP = 0;
export async function addParticipant(sessionId, name, needsRacket) {
	const now = Date.now();
	if (now - lastRSVP < 2000) { console.warn('Rate limit'); return null; }
	lastRSVP = now;

	const dup = db.participants.some(
		p => p.session_id === sessionId && p.name.toLowerCase() === name.toLowerCase()
	);
	if (dup) { console.error('Duplicate participant'); return null; }

	const ticketId   = generateTicketId();
	const uniqueCode = generateUniqueCode();

	const { data, error } = await supabase
		.from('participants')
		.insert([{ 
			session_id: sessionId, 
			name, 
			needs_racket: needsRacket, 
			has_paid: false,
			ticket_id: ticketId,
			unique_code: uniqueCode
		}])
		.select();

	if (data?.[0]) {
		db.participants = [...db.participants, data[0]];
		return data[0];
	}
	if (error) console.error('Add participant error:', error);
	return null;
}

export async function removeParticipant(participantId) {
	const { error } = await supabase.from('participants').delete().eq('id', participantId);
	if (!error) db.participants = db.participants.filter(p => p.id !== participantId);
}

export async function toggleLock(sessionId) {
	const session = getSession(sessionId);
	if (!session) return;
	const newStatus = !session.is_locked;
	const { error } = await supabase.from('sessions').update({ is_locked: newStatus }).eq('id', sessionId);
	if (!error) session.is_locked = newStatus;
}

export async function markPaid(participantId) {
	const p = db.participants.find(p => p.id === participantId);
	if (!p) return;
	const { error } = await supabase.from('participants').update({ has_paid: true }).eq('id', participantId);
	if (!error) p.has_paid = true;
}

export async function togglePaid(participantId) {
	const p = db.participants.find(p => p.id === participantId);
	if (!p) return;
	const newStatus = !p.has_paid;
	const updateData = { has_paid: newStatus };
	
	// Jika diverifikasi (jadi lunas), set status ke 'verified'
	if (newStatus) updateData.payment_status = 'verified';
	else updateData.payment_status = 'pending'; // Jika dicabut verifikasinya
	
	const { error } = await supabase.from('participants').update(updateData).eq('id', participantId);
	if (!error) {
		p.has_paid = newStatus;
		p.payment_status = updateData.payment_status;
	}
}

export async function rejectPayment(participantId) {
	const p = db.participants.find(p => p.id === participantId);
	if (!p) return;
	
	// Set status ke 'rejected', has_paid ke false, dan HAPUS bukti agar keluar dari antrean admin
	const { error } = await supabase
		.from('participants')
		.update({ 
			payment_status: 'rejected',
			has_paid: false,
			payment_proof_url: null 
		})
		.eq('id', participantId);
		
	if (!error) {
		p.payment_status = 'rejected';
		p.has_paid = false;
		p.payment_proof_url = null;
	} else {
		console.error('Reject payment error:', error);
	}
}

export async function createSession(title, date, time, subtitle, courtCount, racketCount) {
	const { data, error } = await supabase
		.from('sessions')
		.insert([{
			title,
			date,
			time: time || '7PM',
			subtitle: subtitle || 'Mixed Levels',
			court_count: courtCount,
			racket_count: racketCount,
			buy_shuttlecock: false,
			is_locked: false
		}])
		.select();

	if (data?.[0]) { db.sessions = [data[0], ...db.sessions]; return data[0]; }
	if (error) console.error('Create session error:', error);
	return null;
}

export async function deleteSession(sessionId) {
	const { error } = await supabase.from('sessions').delete().eq('id', sessionId);
	if (!error) {
		db.sessions      = db.sessions.filter(s => s.id !== sessionId);
		db.participants  = db.participants.filter(p => p.session_id !== sessionId);
	} else {
		console.error('Gagal hapus sesi:', error);
	}
}

export async function toggleSessionShuttlecock(sessionId) {
	const session = getSession(sessionId);
	if (!session) return;

	const newStatus = !session.buy_shuttlecock;
	const { error } = await supabase
		.from('sessions')
		.update({ buy_shuttlecock: newStatus })
		.eq('id', sessionId);

	if (!error) {
		session.buy_shuttlecock = newStatus;
	} else {
		console.error('Toggle shuttlecock error:', error);
	}
}

// ── Pricing ───────────────────────────────────────────────────────

const COURT_PRICE = 77000;
const RACKET_PRICE = 20000;
export const SHUTTLECOCK_PRICE = 140000;

export function calcCourtShare(session, participants) {
	if (!session || !participants?.length) return 0;
	return Math.ceil(((session.court_count || 0) * COURT_PRICE) / participants.length);
}

export function calcRacketShare(session, participants) {
	if (!session || !(session.racket_count > 0)) return 0;
	const renters = participants?.filter(p => p?.needs_racket) ?? [];
	if (!renters.length) return 0;
	return Math.ceil(((session.racket_count) * RACKET_PRICE) / renters.length);
}

export function calcShuttlecockShare(session, participants) {
	if (!session?.buy_shuttlecock || !participants?.length) return 0;
	return Math.ceil(SHUTTLECOCK_PRICE / participants.length);
}

export function calcPlayerCost(session, participants, needsRacket) {
	if (!session || !participants) return 0;
	const court = calcCourtShare(session, participants);
	const shuttlecock = calcShuttlecockShare(session, participants);
	return needsRacket
		? court + calcRacketShare(session, participants) + shuttlecock
		: court + shuttlecock;
}

export function calcTotalCost(session) {
	if (!session) return 0;
	return (session.court_count || 0) * COURT_PRICE
		+ (session.racket_count || 0) * RACKET_PRICE
		+ (session?.buy_shuttlecock ? SHUTTLECOCK_PRICE : 0);
}

// ── Session Timing ────────────────────────────────────────────────

function parseSessionHour(timeStr) {
	const raw = timeStr.trim();
	if (raw.includes(':')) {
		const [h, m] = raw.split(':').map(Number);
		return { hours: h, minutes: m };
	}
	const match = raw.match(/(\d+)\s*(AM|PM)/i);
	if (match) {
		let h = parseInt(match[1]);
		if (match[2].toUpperCase() === 'PM' && h < 12) h += 12;
		if (match[2].toUpperCase() === 'AM' && h === 12) h = 0;
		return { hours: h, minutes: 0 };
	}
	return { hours: parseInt(raw) || 0, minutes: 0 };
}

export function isRSVPOpen(session) {
	if (!session?.date) return false;
	try {
		const { hours, minutes } = parseSessionHour((session.time || '00:00').split(' - ')[0]);
		const d = new Date(`${session.date}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00`);
		if (isNaN(d.getTime())) return true;
		return (d - new Date()) / 3_600_000 > 2;
	} catch { return true; }
}

export function isSessionPassed(session) {
	if (!session?.date) return false;
	try {
		const parts = (session.time || '00:00').split(' - ');
		const { hours, minutes } = parseSessionHour(parts.length > 1 ? parts[1] : parts[0]);
		const d = new Date(`${session.date}T${String(hours).padStart(2,'0')}:${String(minutes).padStart(2,'0')}:00`);
		if (isNaN(d.getTime())) return false;
		return new Date() > d;
	} catch { return false; }
}

// ── UX Helpers ────────────────────────────────────────────────────

export async function triggerConfetti() {
	try {
		const confetti = (await import('https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.2/+esm')).default;
		confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 }, colors: ['#15335E', '#34C759', '#FFFFFF'] });
	} catch { console.warn('Confetti failed'); }
}

export function triggerHaptic(type = 'medium') {
	if (!window.navigator?.vibrate) return;
	({ light: 10, medium: 20, error: [50, 30, 50], success: [20, 10, 20] })[type] &&
		window.navigator.vibrate(({ light: 10, medium: 20, error: [50, 30, 50], success: [20, 10, 20] })[type]);
}

export function addToCalendar(session) {
	if (!session) return;
	const date      = session.date.replace(/-/g, '');
	const parts     = (session.time || '19:00 - 21:00').split(' - ');
	const startTime = parts[0].replace(':', '') + '00';
	const endTime   = (parts[1] || '21:00').replace(':', '') + '00';
	window.open(
		`https://www.google.com/calendar/render?action=TEMPLATE` +
		`&text=${encodeURIComponent('Badminton: ' + session.title)}` +
		`&details=${encodeURIComponent(session.subtitle || '')}` +
		`&location=${encodeURIComponent('Axton Badminton Hall, Botania 1, Batam')}` +
		`&dates=${date}T${startTime}/${date}T${endTime}`,
		'_blank'
	);
}