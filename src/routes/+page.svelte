<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Input } from '$lib/components/ui/input';
	import { Textarea } from '$lib/components/ui/textarea';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { browser } from '$app/environment';
	import { AI_URL, models } from '$lib/config';
	import SvelteMarkdown from 'svelte-markdown';

	interface Message {
		role: string;
		content: string;
	}

	interface Conversation {
		id: string;
		title: string;
		messages: Message[];
	}

	let conversations: Conversation[] = [];
	let currentConversationId: string | null = null;
	let userInput = '';
	let selectedModel = 'gpt-4o';
	let isAILoading = false;

	onMount(() => {
		if (browser) {
			const savedConversations = localStorage.getItem('conversations');
			if (savedConversations) {
				conversations = JSON.parse(savedConversations);
				currentConversationId = conversations[0].id;
			} else {
				addConversation();
			}
		}
	});

	function saveConversationsToLocalStorage() {
		if (browser) {
			localStorage.setItem('conversations', JSON.stringify(conversations));
		}
	}

	async function sendRequest(messageArray: Message[], model: string) {
		try {
			const response = await fetch('/api/server', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json'
				},
				body: JSON.stringify({ messageArray, model })
			});

			const data = await response.json();
			console.log('Data:', data);
			return data.result;
		} catch (error) {
			console.error('Error:', error);
			return "Sorry, I couldn't process your request. Please try again.";
		}
	}

	async function sendMessage() {
		if (userInput.trim() && currentConversationId) {
			const conversation = conversations.find((conv) => conv.id === currentConversationId);
			if (conversation) {
				// Add user message immediately
				const userMessage = { content: userInput, role: 'user' };
				conversation.messages = [...conversation.messages, userMessage];
				saveConversationsToLocalStorage();

				// Clear user input
				userInput = '';

				// Set AI loading state
				isAILoading = true;

				try {
					// Add a placeholder for AI message
					const aiPlaceholder = { content: '', role: 'assistant' };
					conversation.messages = [...conversation.messages, aiPlaceholder];

					// Send request to AI
					const aiResponse = await sendRequest(conversation.messages, selectedModel);

					// Update AI message with response
					aiPlaceholder.content = aiResponse;
				} catch (error) {
					console.error('Error:', error);
					// Handle error (e.g., show error message)
				} finally {
					isAILoading = false;
					saveConversationsToLocalStorage();
				}
			}
		}
	}

	function selectConversation(id: string) {
		currentConversationId = id;
	}

	function addConversation() {
		const newConversation: Conversation = {
			id: String(Date.now()),
			title: `Conversation ${conversations.length + 1}`,
			messages: []
		};
		conversations = [newConversation, ...conversations];
		currentConversationId = newConversation.id;
		saveConversationsToLocalStorage();
	}

	// Helper function to check if the current conversation has any messages
	$: currentConversation = conversations.find((conv) => conv.id === currentConversationId);
	$: canSendMessage = userInput.trim() !== '';
</script>

<div class="flex h-screen bg-gray-100">
	<Sidebar {conversations} {selectConversation} {addConversation} />
	<div class="flex-1 flex flex-col">
		<div class="flex-1 overflow-y-auto p-4">
			{#if currentConversationId}
				{#if currentConversation?.messages.length === 0}
					<div class="text-center text-gray-500 mt-8">
						Start a new conversation by typing a message below
					</div>
				{/if}
				{#each currentConversation?.messages || [] as message}
					<div
						class={`mb-4 p-2 rounded ${
							message.role === 'user' ? 'bg-blue-100 ml-auto' : 'bg-gray-100'
						}`}
					>
						{#if message.role === 'assistant' && message.content === '' && isAILoading}
							<div class="loading-indicator">Loading...</div>
						{:else}
							<SvelteMarkdown source={message.content} />
						{/if}
					</div>
				{/each}
			{/if}
		</div>
		<div class="p-4 bg-white border-t">
			<div class="flex space-x-2">
				<Textarea bind:value={userInput} placeholder="Type your message..." class="flex-1" />
				<Button on:click={sendMessage} disabled={!canSendMessage || isAILoading}>Send</Button>
			</div>
			<div class="mt-2">
				<select bind:value={selectedModel} class="w-full p-2 border rounded">
					{#each Object.entries(models) as [value, label]}
						<option {value}>{label}</option>
					{/each}
				</select>
			</div>
		</div>
	</div>
</div>

<style>
	:global(.svelte-markdown code) {
		background-color: #f0f0f0;
		padding: 2px 4px;
		border-radius: 4px;
	}

	:global(.svelte-markdown pre) {
		background-color: #f0f0f0;
		padding: 1em;
		border-radius: 4px;
		overflow-x: auto;
	}

	:global(.svelte-markdown blockquote) {
		border-left: 4px solid #ccc;
		margin: 0;
		padding-left: 1em;
	}

	:global(.svelte-markdown table) {
		border-collapse: collapse;
		margin: 1em 0;
	}

	:global(.svelte-markdown th, .svelte-markdown td) {
		border: 1px solid #ccc;
		padding: 0.5em;
	}
</style>
