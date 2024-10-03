<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { onMount } from 'svelte';

	let messages: { text: string; isUser: boolean }[] = [];
	let userInput = '';

	function sendMessage() {
		if (userInput.trim()) {
			messages = [...messages, { text: userInput, isUser: true }];
			// Here you would typically send the message to a backend or AI service
			// For this example, we'll just echo the message back
			setTimeout(() => {
				messages = [...messages, { text: `You said: ${userInput}`, isUser: false }];
			}, 1000);
			userInput = '';
		}
	}

	onMount(() => {
		messages = [...messages, { text: 'Hello! How can I help you today?', isUser: false }];
	});
</script>

<div class="container mx-auto p-4">
	<h1 class="text-2xl font-bold mb-4">Chatbot</h1>

	<div class="bg-gray-100 p-4 rounded-lg h-96 overflow-y-auto mb-4">
		{#each messages as message}
			<div class={`mb-2 ${message.isUser ? 'text-right' : 'text-left'}`}>
				<span
					class={`inline-block p-2 rounded-lg ${message.isUser ? 'bg-blue-500 text-white' : 'bg-white'}`}
				>
					{message.text}
				</span>
			</div>
		{/each}
	</div>

	<form on:submit|preventDefault={sendMessage} class="flex">
		<Input bind:value={userInput} placeholder="Type your message..." class="flex-grow mr-2" />
		<Button type="submit">Send</Button>
	</form>
</div>
