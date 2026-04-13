import { fail, redirect } from '@sveltejs/kit';
import { ADMIN_PIN } from '$env/static/private';

export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const pin = data.get('pin');

		// Throttling logic
		const attempts = parseInt(cookies.get('login_attempts') || '0');
		const lockoutTime = parseInt(cookies.get('lockout_until') || '0');
		const now = Date.now();

		if (now < lockoutTime) {
			const remaining = Math.ceil((lockoutTime - now) / 60000);
			return fail(403, { error: `Terlalu banyak percobaan. Silakan coba lagi dalam ${remaining} menit.` });
		}

		// Memeriksa PIN dari Environment Variable (Secret)
		if (pin === (ADMIN_PIN || '1234')) {
			// Reset attempts on success
			cookies.delete('login_attempts', { path: '/' });
			cookies.delete('lockout_until', { path: '/' });

			cookies.set('admin_auth', 'authenticated', {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: true,
				maxAge: 60 * 60 * 24 // 1 hari
			});
			throw redirect(303, '/admin');
		}

		// Failed attempt
		const newAttempts = attempts + 1;
		if (newAttempts >= 3) {
			const until = Date.now() + 5 * 60 * 1000; // 5 menit
			cookies.set('lockout_until', until.toString(), { path: '/', maxAge: 300 });
			cookies.delete('login_attempts', { path: '/' });
			return fail(403, { error: 'Terlalu banyak percobaan salah. Login dikunci selama 5 menit.' });
		}

		cookies.set('login_attempts', newAttempts.toString(), { path: '/', maxAge: 3600 });
		return fail(400, { error: `PIN salah. Sisa percobaan: ${3 - newAttempts}.` });
	},
	logout: async ({ cookies }) => {
		cookies.delete('admin_auth', { path: '/' });
		throw redirect(303, '/admin/login');
	}
};
