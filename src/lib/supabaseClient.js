import { createClient } from '@supabase/supabase-js';
import { env } from '$env/dynamic/public';

const supabaseUrl = env.PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = env.PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'placeholder';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
