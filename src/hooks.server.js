import { redirect } from '@sveltejs/kit';
import { getAdminUserFromCookies } from '$lib/server/adminAuth';

export async function handle({ event, resolve }) {
	// Protect all /admin routes except for the login page
	if (event.url.pathname.startsWith('/admin') && event.url.pathname !== '/admin/login') {
		const adminUser = await getAdminUserFromCookies(event.cookies);
		if (!adminUser) {
			throw redirect(303, '/admin/login');
		}
	}

	const response = await resolve(event);
	return response;
}
