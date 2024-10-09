import { createClient } from '@supabase/supabase-js';
// import { SUPABASE_URL, SUPABASE_ANON_KEY } from '$lib/config';
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const createSupabaseWithToken = (token) => {
	return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
		global: {
			// Pass the access token in the auth header
			headers: {
				Authorization: `Bearer ${token}`
			}
		}
	});
};
