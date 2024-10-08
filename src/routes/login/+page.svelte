<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	let email = '';
	let password = '';

	const login = async () => {
		const { error } = await supabase.auth.signInWithPassword({ email, password });
		if (error) {
			alert(error.message);
		} else {
			// Redirect to dashboard
			goto('/dashboard');
	};

	const signInWithGoogle = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google'
		});
		if (error) {
			alert(error.message);
		}
		// Redirect to dashboard
		goto('/dashboard');
	};
</script>

<form on:submit|preventDefault={login}>
	<input type="email" bind:value={email} placeholder="Email" required />
	<input type="password" bind:value={password} placeholder="Password" required />
	<button type="submit">Login</button>
</form>

<div>
	<p>Or</p>
	<button on:click={signInWithGoogle}>Sign in with Google</button>
</div>
