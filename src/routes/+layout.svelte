<script lang="ts">
	import '../app.css';
	import { onMount } from 'svelte';
	import { invalidate } from '$app/navigation';
	import { page } from '$app/stores';
	import { supabase } from '$lib/supabaseClient';
	import { writable } from 'svelte/store';
	import { browser } from '$app/environment';

	const userCredits = writable(0);
	let session: any = null;
	let loading = true;

	onMount(async () => {
		try {
			const { data, error } = await supabase.auth.getSession();
			if (error) throw error;
			session = data.session;

			if (session) {
				await loadUserCredits(session.user.id);

				supabase
					.channel('public:profiles')
					.on(
						'postgres_changes',
						{
							event: 'UPDATE',
							schema: 'public',
							table: 'profiles',
							filter: `id=eq.${session.user.id}`
						},
						(payload) => {
							userCredits.set(payload.new.credits);
						}
					)
					.subscribe();
			}
		} catch (error) {
			console.error('Error loading session:', error);
		} finally {
			loading = false;
		}
	});

	async function loadUserCredits(userId: string) {
		try {
			const { data: profile, error } = await supabase
				.from('profiles')
				.select('credits')
				.eq('id', userId)
				.single();

			if (error) throw error;
			userCredits.set(profile?.credits || 0);
		} catch (error) {
			console.error('Error loading user credits:', error);
		}
	}

	supabase.auth.onAuthStateChange((event, newSession) => {
		session = newSession;
		if (browser) {
			invalidate('supabase:auth');
		}
	});
</script>

{#if loading}
	<p>Loading...</p>
{:else if session}
	<p>Credits: {$userCredits}</p>
{/if}

<slot />
