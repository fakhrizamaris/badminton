import { fail, redirect } from '@sveltejs/kit';

export const actions = {
	login: async ({ request, cookies }) => {
		const data = await request.formData();
		const pin = data.get('pin');

		if (pin === '1234') {
			cookies.set('admin_auth', 'authenticated', {
				path: '/',
				httpOnly: true,
				sameSite: 'strict',
				secure: true,
				maxAge: 60 * 60 * 24 // 1 day
			});
			throw redirect(303, '/admin');
		}

		return fail(400, { error: 'Incorrect PIN' });
	},
	logout: async ({ cookies }) => {
		cookies.delete('admin_auth', { path: '/' });
		throw redirect(303, '/admin/login');
	}
};
