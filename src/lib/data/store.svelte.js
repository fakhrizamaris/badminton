import { supabase } from '$lib/supabaseClient';

export const appConfig = $state({
	admin_pin: '1234',
	maps_embed_url:
		'https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3989.043588102927!2d104.09582577508493!3d1.1262423988636437!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x31d9894e77227d81%3A0x633d7b9735d1f874!2sAxton%20Botania%20Badminton%20Hall!5e0!3m2!1sen!2sid!4v1712900000000!5m2!1sen!2sid'
});

export const db = $state({
	sessions: [],
	participants: [],
	gallery: [], // Daftar foto dari database
	isReady: false
});

export async function initDB() {
	const { data: sData } = await supabase.from('sessions').select('*').order('date', { ascending: false });
	if (sData) db.sessions = sData;

	const { data: pData } = await supabase.from('participants').select('*');
	if (pData) db.participants = pData;

	const { data: gData } = await supabase.from('gallery').select('*').order('created_at', { ascending: false });
	if (gData) db.gallery = gData;
	
	db.isReady = true;
}

export async function uploadGalleryImages(files) {
	const uploadedItems = [];
	
	for (const file of files) {
		const fileExt = file.name.split('.').pop();
		const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
		const filePath = `photos/${fileName}`;

		// 1. Upload ke Supabase Storage (Bucket: 'gallery')
		const { data: sData, error: sError } = await supabase.storage
			.from('gallery')
			.upload(filePath, file);

		if (sError) {
			console.error('Upload error:', sError);
			continue;
		}

		// 2. Ambil Public URL
		const { data: { publicUrl } } = supabase.storage
			.from('gallery')
			.getPublicUrl(filePath);

		// 3. Simpan ke Tabel 'gallery'
		const { data: dbData, error: dbError } = await supabase
			.from('gallery')
			.insert([{ url: publicUrl, caption: file.name }])
			.select();

		if (dbData && dbData[0]) {
			uploadedItems.push(dbData[0]);
		}
	}

	// Update local state
	db.gallery = [...uploadedItems, ...db.gallery];
	return uploadedItems;
}

export async function deleteGalleryImage(id, url) {
	// 1. Hapus dari DB
	const { error: dbError } = await supabase.from('gallery').delete().eq('id', id);
	if (!dbError) {
		// 2. Hapus dari State
		db.gallery = db.gallery.filter(item => item.id !== id);
		
		// 3. (Opsional) Hapus dari Storage jika perlu
		// Kita butuh path filenya, biasanya bisa diekstrak dari URL
	}
}

// ── CRUD Helpers ──────────────────────────────────────────────────

export function getSession(id) {
	return db.sessions.find((s) => s.id === id);
}

export function getParticipants(sessionId) {
	return db.participants.filter((p) => p.session_id === sessionId);
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
	if (!session || !sessionParticipants) return 0;
	const count = sessionParticipants.length || 1;
	return Math.ceil(((session.court_count || 0) * 77000) / count);
}

export function calcRacketShare(session, sessionParticipants) {
	if (!session || !sessionParticipants || (session.racket_count || 0) === 0) return 0;
	const renters = sessionParticipants.filter((p) => p?.needs_racket);
	const renterCount = renters.length || 1;
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
	const sessionDate = new Date(session.date + 'T' + (session.time ? session.time.split(' - ')[0] : '00:00'));
	const now = new Date();
	const hourDiff = (sessionDate - now) / (1000 * 60 * 60);
	return hourDiff > 24;
}
