import { redirect } from '@sveltejs/kit';

export async function handle({ event, resolve }) {
	// Protect all /admin routes except for the login page
	if (event.url.pathname.startsWith('/admin') && event.url.pathname !== '/admin/login') {
		const adminAuth = event.cookies.get('admin_auth');
		
		if (adminAuth !== 'authenticated') {
			throw redirect(303, '/admin/login');
		}
	}

	const response = await resolve(event);
	return response;
}
