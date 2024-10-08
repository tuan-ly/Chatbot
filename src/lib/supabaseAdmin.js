import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$lib/config';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
	throw new Error('Missing Supabase Admin credentials');
}

// Create Supabase admin client
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
	auth: {
		autoRefreshToken: false,
		persistSession: false
	}
});

export default supabaseAdmin;
