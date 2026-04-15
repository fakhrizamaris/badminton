import { json } from '@sveltejs/kit';
import { createUserScopedSupabase, getAdminUserFromCookies } from '$lib/server/adminAuth';

export async function DELETE({ params, cookies }) {
	const adminUser = await getAdminUserFromCookies(cookies);
	if (!adminUser) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const sessionId = params.id;
	if (!sessionId) {
		return json({ error: 'Session ID tidak valid.' }, { status: 400 });
	}

	const accessToken = cookies.get('sb_access_token');
	if (!accessToken) {
		return json({ error: 'Unauthorized' }, { status: 401 });
	}

	const adminSupabase = createUserScopedSupabase(accessToken);

	const { error: participantsError } = await adminSupabase
		.from('participants')
		.delete()
		.eq('session_id', sessionId);

	if (participantsError) {
		return json(
			{ error: `Gagal hapus peserta sesi: ${participantsError.message}` },
			{ status: 403 }
		);
	}

	const { data: deletedSessions, error: sessionError } = await adminSupabase
		.from('sessions')
		.delete()
		.eq('id', sessionId)
		.select('id');

	if (sessionError) {
		return json({ error: `Gagal hapus sesi: ${sessionError.message}` }, { status: 403 });
	}

	if (!deletedSessions?.length) {
		return json({ error: 'Sesi tidak ditemukan atau sudah terhapus.' }, { status: 404 });
	}

	return json({ ok: true, deletedId: deletedSessions[0].id });
}
