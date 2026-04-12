import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

const supabaseUrl = env.PUBLIC_SUPABASE_URL;
const supabaseAnonKey = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY; // your .env name

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
