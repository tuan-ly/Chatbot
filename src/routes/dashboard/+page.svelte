<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { onMount } from 'svelte';
	import Sidebar from '$lib/components/Sidebar.svelte';
	import { models } from '$lib/config';
	import SvelteMarkdown from 'svelte-markdown';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';

	import type { Conversation, Message, Profile } from '$lib/types';

	let conversations: Conversation[] = [];
	let currentConversationId: string | null = null;
	let currentConversation: Conversation | undefined;
	let userInput = '';
	let selectedModel = 'gpt-4o';
	let isAILoading = false;
	let canSendMessage = false;
	let userCredits = 0;
	let userId: string | null = null;

	onMount(async () => {
		const { data: session } = await supabase.auth.getSession();

		if (!session?.session) {
			// User is not authenticated, redirect to login page
			goto('/login');
			return;
		} else {
			userId = session.session.user.id;
			// Load conversations from Supabase
			await loadConversationsFromSupabase(userId);
			// Load user's credit balance
			await loadUserCredits(userId);

			// Set up real-time listener for credits (optional)
			supabase
				.channel('public:profiles')
				.on(
					'postgres_changes',
					{ event: 'UPDATE', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` },
					(payload: { new: Profile }) => {
						userCredits = payload.new.credits;
					}
				)
				.subscribe();
		}
	});

	async function loadConversationsFromSupabase(userId: string) {
		const { data, error } = await supabase
			.from('conversations')
			.select('*, messages(*)')
			.eq('user_id', userId)
			.order('created_at', { ascending: false });

		if (error) {
			console.error('Error loading conversations:', error);
		} else {
			conversations = (data as Conversation[]) || [];
			currentConversationId = conversations[0]?.id || null;
			currentConversation = conversations[0];
		}
	}

	async function loadUserCredits(userId: string) {
		const { data: profile, error } = await supabase
			.from('profiles')
			.select('credits')
			.eq('id', userId)
			.single();

		if (error) {
			console.error('Error loading user credits:', error);
		} else {
			userCredits = (profile as Profile)?.credits || 0;
		}
	}

	async function sendRequest(messageArray: Message[], model: string, conversationId: string) {
		try {
			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session) {
				throw new Error('User not authenticated');
			}
			const formattedMessageArray = messageArray.map((message) => ({
				role: message.role,
				content: message.content
			}));
			const response = await fetch('/api/ai-interact', {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					Authorization: `Bearer ${session.access_token}`
				},
				body: JSON.stringify({
					messages: formattedMessageArray,
					model,
					conversation_id: conversationId
				})
			});

			const data = await response.json();
			if (response.ok) {
				return data.result;
			} else {
				console.error('Error from server:', data.error);
				alert(data.error);
				return null;
			}
		} catch (error) {
			console.error('Error:', error);
			alert("Sorry, I couldn't process your request. Please try again.");
			return null;
		}
	}

	async function sendMessage() {
		if (!userId) {
			alert('You must be logged in to send messages.');
			return;
		}

		if (userInput.trim() && currentConversationId) {
			const conversation = conversations.find((conv) => conv.id === currentConversationId);
			if (conversation) {
				if (userCredits <= 0) {
					alert('You have insufficient credits to send a message.');
					return;
				}

				// Add user message immediately
				const userMessage: Message = {
					id: '', // Will be updated after Supabase insert
					conversation_id: currentConversationId,
					content: userInput,
					role: 'user',
					created_at: new Date().toISOString()
				};
				conversation.messages = [...conversation.messages, userMessage];

				// Save the user message to Supabase
				const { data: newMessage, error } = await supabase
					.from('messages')
					.insert({
						conversation_id: currentConversationId,
						role: 'user',
						content: userInput
					})
					.single();

				if (error) {
					console.error('Error saving user message:', error);
				} else if (newMessage) {
					// Update message with ID and created_at from Supabase
					userMessage.id = (newMessage as Message).id;
					userMessage.created_at = (newMessage as Message).created_at;
				}

				// Clear user input
				userInput = '';

				// Set AI loading state
				isAILoading = true;
				console.log('conversation.messages', conversation.messages);
				try {
					// Send request to AI
					const aiResponse = await sendRequest(
						conversation.messages,
						selectedModel,
						currentConversationId
					);

					if (aiResponse !== null) {
						// Add AI message
						const aiMessage: Message = {
							id: '', // Will be updated after Supabase insert
							conversation_id: currentConversationId,
							content: aiResponse,
							role: 'assistant',
							created_at: new Date().toISOString()
						};
						conversation.messages = [...conversation.messages, aiMessage];

						// Save AI message to Supabase
						const { data: newAIMessage, error: aiMessageError } = await supabase
							.from('messages')
							.insert({
								conversation_id: currentConversationId,
								role: 'assistant',
								content: aiResponse
							})
							.single();

						if (aiMessageError) {
							console.error('Error saving AI message:', aiMessageError);
						} else if (newAIMessage) {
							aiMessage.id = (newAIMessage as Message).id;
							aiMessage.created_at = (newAIMessage as Message).created_at;
						}
					}
				} catch (error) {
					console.error('Error:', error);
					alert("Sorry, I couldn't process your request. Please try again.");
				} finally {
					isAILoading = false;
					// Reload user credits from the server
					if (userId) {
						await loadUserCredits(userId);
					}
				}
			}
		}
	}

	async function selectConversation(id: string) {
		currentConversationId = id;

		// Load messages for the selected conversation
		const { data: messages, error } = await supabase
			.from('messages')
			.select('*')
			.eq('conversation_id', id)
			.order('created_at', { ascending: true });

		if (error) {
			console.error('Error loading messages:', error);
		} else {
			const conversation = conversations.find((conv) => conv.id === id);
			if (conversation) {
				conversation.messages = (messages as Message[]) || [];
				currentConversation = conversation;
			}
		}
	}

	async function addConversation() {
		if (!userId) {
			alert('You must be logged in to create a conversation.');
			return;
		}

		const title = `Conversation ${conversations.length + 1}`;
		const { data, error } = await supabase
			.from('conversations')
			.insert({ title, user_id: userId })
			.single();

		if (error) {
			console.error('Error creating conversation:', error);
		} else if (data) {
			const newConversation: Conversation = {
				id: (data as Conversation).id,
				title: (data as Conversation).title,
				user_id: (data as Conversation).user_id,
				created_at: (data as Conversation).created_at,
				messages: []
			};
			conversations = [newConversation, ...conversations];
			currentConversationId = newConversation.id;
			currentConversation = newConversation;
		}
	}
	$: {
		console.log('Conversations updated:', conversations);
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
						{#if message.role === 'assistant' && isAILoading && !message.content}
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
			<div class="mt-2">
				<p>User Credits: {userCredits}</p>
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
