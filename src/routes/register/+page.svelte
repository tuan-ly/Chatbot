<script>
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	let email = '';
	let password = '';

	const register = async () => {
		const { error } = await supabase.auth.signUp({ email, password });
		if (error) {
			alert(error.message);
		} else {
			// Redirect to login or dashboard
			goto('/login');
		}
	};

	const signInWithGoogle = async () => {
		const { error } = await supabase.auth.signInWithOAuth({
			provider: 'google'
		});
		if (error) {
			alert(error.message);
		}
	};
</script>

<h1>Register or Sign In</h1>

<form on:submit|preventDefault={register}>
	<input type="email" bind:value={email} placeholder="Email" required />
	<input type="password" bind:value={password} placeholder="Password" required />
	<button type="submit">Sign Up with Email</button>
</form>

<div>
	<p>Or</p>
	<button on:click={signInWithGoogle}>Sign in with Google</button>
</div>

<style>
	form,
	div {
		margin-bottom: 1rem;
	}
	input,
	button {
		margin-bottom: 0.5rem;
	}
</style>
