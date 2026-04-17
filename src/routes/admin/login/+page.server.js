import { fail, redirect } from '@sveltejs/kit';
import { createPublicSupabase, getAdminEmails, isAdminEmail } from '$lib/server/adminAuth';

export const actions = {
	login: async ({ request, cookies }) => {
		const isSecure = new URL(request.url).protocol === 'https:';
		const data = await request.formData();
		const email = String(data.get('email') || '').trim().toLowerCase();
		const password = String(data.get('password') || '');
		const adminEmails = getAdminEmails();

		if (!adminEmails.length) {
			return fail(500, { error: 'ADMIN_EMAIL belum diset di environment server (boleh lebih dari satu, pisahkan dengan koma).' });
		}

		if (!email || !password) {
			return fail(400, { error: 'Email dan password wajib diisi.' });
		}

		if (!isAdminEmail(email)) {
			return fail(403, { error: 'Akun ini tidak punya akses admin.' });
		}

		// Throttling logic
		const attempts = parseInt(cookies.get('login_attempts') || '0');
		const lockoutTime = parseInt(cookies.get('lockout_until') || '0');
		const now = Date.now();

		if (now < lockoutTime) {
			const remaining = Math.ceil((lockoutTime - now) / 60000);
			return fail(403, { error: `Terlalu banyak percobaan. Silakan coba lagi dalam ${remaining} menit.` });
		}

		const supabase = createPublicSupabase();
		const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
			email,
			password
		});

		if (!authError && authData?.session?.access_token) {
			// Reset attempts on success
			cookies.delete('login_attempts', { path: '/' });
			cookies.delete('lockout_until', { path: '/' });

			cookies.set('sb_access_token', authData.session.access_token, {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: isSecure,
				maxAge: authData.session.expires_in || 60 * 60
			});

			if (authData.session.refresh_token) {
				cookies.set('sb_refresh_token', authData.session.refresh_token, {
					path: '/',
					httpOnly: true,
					sameSite: 'strict',
					secure: isSecure,
					maxAge: 60 * 60 * 24 * 7
				});
			} else {
				cookies.delete('sb_refresh_token', { path: '/' });
			}

			throw redirect(303, '/admin');
		}

		// Failed attempt
		const newAttempts = attempts + 1;
		if (newAttempts >= 3) {
			const until = Date.now() + 5 * 60 * 1000; // 5 menit
			cookies.set('lockout_until', until.toString(), { path: '/', maxAge: 300 });
			cookies.delete('login_attempts', { path: '/' });
			return fail(403, { error: 'Terlalu banyak percobaan gagal. Login dikunci selama 5 menit.' });
		}

		cookies.set('login_attempts', newAttempts.toString(), { path: '/', maxAge: 3600 });
		return fail(400, {
			error: `Login gagal: ${authError?.message || 'email/password salah'}. Sisa percobaan: ${3 - newAttempts}.`
		});
	},
	logout: async ({ cookies }) => {
		cookies.delete('sb_access_token', { path: '/' });
		cookies.delete('sb_refresh_token', { path: '/' });
		cookies.delete('login_attempts', { path: '/' });
		cookies.delete('lockout_until', { path: '/' });
		throw redirect(303, '/admin/login');
	}
};
