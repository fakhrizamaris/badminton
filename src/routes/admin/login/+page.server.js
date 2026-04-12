import { fail, redirect } from '@sveltejs/kit';
import { ADMIN_PIN } from '$env/static/private';

export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const pin = data.get('pin');

		// Memeriksa PIN dari Environment Variable (Secret)
		if (pin === (ADMIN_PIN || '1234')) {
			cookies.set('admin_auth', 'authenticated', {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: true,
				maxAge: 60 * 60 * 24 // 1 hari
			});
			throw redirect(303, '/admin');
		}

		return fail(400, { error: 'PIN salah. Silakan coba lagi.' });
	},
	logout: async ({ cookies }) => {
		cookies.delete('admin_auth', { path: '/' });
		throw redirect(303, '/admin/login');
	}
};
