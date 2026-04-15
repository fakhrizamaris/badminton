import { createClient } from '@supabase/supabase-js';
import { env as publicEnv } from '$env/dynamic/public';
import { env as privateEnv } from '$env/dynamic/private';

function createSupabaseForAuth(accessToken) {
	const supabaseUrl = publicEnv.PUBLIC_SUPABASE_URL;
	const supabaseAnonKey = publicEnv.PUBLIC_SUPABASE_PUBLISHABLE_KEY;

	if (!supabaseUrl || !supabaseAnonKey) {
		throw new Error('Supabase public env belum lengkap.');
	}

	const headers = accessToken ? { Authorization: `Bearer ${accessToken}` } : {};

	return createClient(supabaseUrl, supabaseAnonKey, {
		auth: { persistSession: false, autoRefreshToken: false },
		global: { headers }
	});
}

export function getAdminEmail() {
	return (privateEnv.ADMIN_EMAIL || '').trim().toLowerCase();
}

export async function getAdminUserFromCookies(cookies) {
	const accessToken = cookies.get('sb_access_token');
	if (!accessToken) return null;

	const adminEmail = getAdminEmail();
	if (!adminEmail) {
		console.error('ADMIN_EMAIL belum di-set pada environment.');
		return null;
	}

	const supabase = createSupabaseForAuth(accessToken);
	const { data, error } = await supabase.auth.getUser(accessToken);
	if (error || !data?.user) return null;

	const userEmail = (data.user.email || '').toLowerCase();
	if (userEmail !== adminEmail) return null;

	return data.user;
}

export function createPublicSupabase() {
	return createSupabaseForAuth();
}

export function createUserScopedSupabase(accessToken) {
	return createSupabaseForAuth(accessToken);
}
