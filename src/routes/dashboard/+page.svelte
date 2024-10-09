<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Card } from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import {
		PanelLeftOpen,
		PanelLeftClose,
		Send,
		Plus,
		Settings,
		Paperclip,
		X,
		Image,
		FileText
	} from 'lucide-svelte';
	import SvelteMarkdown from 'svelte-markdown';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import type { Conversation, Message, Profile, ContentItem } from '$lib/types';
	import { onMount } from 'svelte';
	import { models } from '$lib/config';
	import MessageContent from '$lib/components/MessageContent.svelte';
	import { MessageHandler } from '$lib/messageHandler';
	// src/routes/dashboard/+page.ts
	// Load conversations from Supabase
	let conversations: Conversation[] = [];
	let currentConversationId: string | null = null;
	let currentConversation: Conversation | undefined;
	let userInput = '';
	let selectedModel = 'gpt-4o';
	let isAILoading = false;
	let canSendMessage = false;
	let userCredits = 0;
	let userId: string | null = null;
	let isSidebarOpen = true;

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

	function toggleSidebar() {
		isSidebarOpen = !isSidebarOpen;
	}
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

	// New state variables for file handling
	let attachments: File[] = [];
	let isDragging = false;
	const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
	const ALLOWED_TYPES = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'application/pdf',
		'text/plain',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	];

	// Handle file selection
	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			addFiles(Array.from(input.files));
		}
	}

	// Handle drag and drop
	function handleDragOver(event: DragEvent) {
		event.preventDefault();
		isDragging = true;
	}

	function handleDragLeave(event: DragEvent) {
		event.preventDefault();
		isDragging = false;
	}

	function handleDrop(event: DragEvent) {
		event.preventDefault();
		isDragging = false;

		if (event.dataTransfer?.files) {
			addFiles(Array.from(event.dataTransfer.files));
		}
	}

	// Add files to attachments array
	function addFiles(files: File[]) {
		for (const file of files) {
			if (file.size > MAX_FILE_SIZE) {
				alert(`File ${file.name} is too large. Maximum size is 10MB.`);
				continue;
			}

			if (!ALLOWED_TYPES.includes(file.type)) {
				alert(`File type ${file.type} is not supported.`);
				continue;
			}

			attachments = [...attachments, file];
		}
	}

	// Remove attachment
	function removeAttachment(index: number) {
		attachments = attachments.filter((_, i) => i !== index);
	}

	// Get file icon based on type
	function getFileIcon(type: string) {
		if (type.startsWith('image/')) {
			return Image;
		}
		return FileText;
	}

	async function sendMessage() {
		if (!userId || (!userInput.trim() && attachments.length === 0) || !currentConversationId) {
			return;
		}

		const contents: ContentItem[] = [];

		// Add text content if present
		if (userInput.trim()) {
			contents.push({
				type: 'text',
				text: userInput.trim()
			});
		}

		// Process attachments if present
		if (attachments.length > 0) {
			try {
				const uploadedContents = await MessageHandler.processUploadedFiles(attachments);
				contents.push(...uploadedContents);
			} catch (error) {
				console.error('Upload error:', error);
				alert('Failed to upload files. Please try again.');
				return;
			}
		}

		// Save user message
		const userMessage = await MessageHandler.saveMessage(currentConversationId, 'user', contents);

		if (!userMessage) {
			alert('Failed to save message. Please try again.');
			return;
		}

		// Update conversation with new message
		if (currentConversation) {
			currentConversation.messages = [...currentConversation.messages, userMessage];
		}

		// Clear input and attachments
		userInput = '';
		attachments = [];
		isAILoading = true;

		try {
			// Get AI response
			const response = await sendRequest(
				currentConversation?.messages || [],
				selectedModel,
				currentConversationId
			);

			if (response) {
				// Save AI message
				const aiMessage = await MessageHandler.saveMessage(currentConversationId, 'assistant', [
					{
						type: 'text',
						text: response
					}
				]);

				if (aiMessage && currentConversation) {
					currentConversation.messages = [...currentConversation.messages, aiMessage];
				}
			}
		} catch (error) {
			console.error('Error:', error);
			alert("Sorry, I couldn't process your request. Please try again.");
		} finally {
			isAILoading = false;
		}
	}

	// Function to render message content
	function renderMessage(message: Message) {
		try {
			// Try to parse as JSON (for messages with attachments)
			const content = JSON.parse(message.content);
			return {
				text: content.text,
				attachments: content.attachments
			};
		} catch {
			// If not JSON, treat as regular text message
			return {
				text: message.content,
				attachments: []
			};
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
			.select()
			.single();

		console.log('data', data);
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

	// Helper function to check if the current conversation has any messages
	$: currentConversation = conversations.find((conv) => conv.id === currentConversationId);
	$: canSendMessage = userInput.trim() !== '';
</script>

<div class="flex h-screen bg-background">
	<!-- Sidebar -->
	<div
		class={cn(
			'border-r bg-muted/40 transition-all duration-300',
			isSidebarOpen ? 'w-[300px]' : 'w-0'
		)}
	>
		{#if isSidebarOpen}
			<div class="flex h-full flex-col p-4">
				<div class="flex items-center justify-between mb-4">
					<Button variant="outline" class="w-full" on:click={addConversation}>
						<Plus class="mr-2 h-4 w-4" />
						New Chat
					</Button>
				</div>

				<ScrollArea class="flex-1">
					{#each conversations as conversation}
						<Button
							variant={currentConversationId === conversation.id ? 'secondary' : 'ghost'}
							class="w-full justify-start mb-1 truncate"
							on:click={() => selectConversation(conversation.id)}
						>
							{conversation.title}
						</Button>
					{/each}
				</ScrollArea>

				<Separator class="my-4" />

				<div class="flex flex-col gap-2">
					<div class="flex items-center justify-between px-2">
						<span class="text-sm text-muted-foreground">Credits: {userCredits}</span>
						<Button variant="ghost" size="icon">
							<Settings class="h-4 w-4" />
						</Button>
					</div>
				</div>
			</div>
		{/if}
	</div>

	<!-- Main Content -->
	<div class="flex-1 flex flex-col relative">
		<!-- Toggle Sidebar Button -->
		<Button variant="ghost" size="icon" class="absolute top-4 left-4 z-10" on:click={toggleSidebar}>
			{#if isSidebarOpen}
				<PanelLeftClose class="h-4 w-4" />
			{:else}
				<PanelLeftOpen class="h-4 w-4" />
			{/if}
		</Button>

		<!-- Messages Area -->
		<div class="flex-1 flex flex-col relative">
			<ScrollArea class="flex-1 p-4">
				{#if currentConversationId}
					{#if currentConversation?.messages.length === 0}
						<div class="flex h-full items-center justify-center">
							<div class="text-center space-y-2">
								<h3 class="text-lg font-semibold">Welcome to Chat</h3>
								<p class="text-muted-foreground">Start a conversation below</p>
							</div>
						</div>
					{:else}
						{#each currentConversation?.messages || [] as message}
							<div
								class={cn('mb-8 flex', message.role === 'user' ? 'justify-end' : 'justify-start')}
							>
								<Card
									class={cn(
										'max-w-[80%] p-4',
										message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
									)}
								>
									<MessageContent {message} isLoading={isAILoading && !message.content} />
								</Card>
							</div>
						{/each}
					{/if}
				{/if}
			</ScrollArea>

			<!-- Input Area -->
			<div
				class="border-t p-4"
				on:dragover={handleDragOver}
				on:dragleave={handleDragLeave}
				on:drop={handleDrop}
			>
				<div class="container max-w-4xl mx-auto">
					<!-- Show attachments preview only when there are attachments -->
					{#if attachments.length > 0}
						<div class="mb-4 flex flex-wrap gap-2">
							{#each attachments as file, index}
								<div class="flex items-center gap-2 bg-muted p-2 rounded-md">
									<svelte:component this={getFileIcon(file.type)} class="h-4 w-4" />
									<span class="text-sm truncate max-w-[200px]">
										{file.name}
									</span>
									<Button
										variant="ghost"
										size="icon"
										class="h-4 w-4 p-0"
										on:click={() => removeAttachment(index)}
									>
										<X class="h-3 w-3" />
									</Button>
								</div>
							{/each}
						</div>
					{/if}

					<div class="flex gap-2">
						<select
							bind:value={selectedModel}
							class="w-40 rounded-md border border-input bg-background px-3 py-2 text-sm"
						>
							{#each Object.entries(models) as [value, label]}
								<option {value}>{label}</option>
							{/each}
						</select>

						<div class="flex-1 flex gap-2">
							<div class="flex-1 relative">
								<Textarea
									bind:value={userInput}
									placeholder="Type your message..."
									class="min-h-[50px] pr-10"
									rows="1"
								/>
								<div class="absolute right-2 bottom-2">
									<label class="cursor-pointer">
										<input
											type="file"
											multiple
											class="hidden"
											accept={ALLOWED_TYPES.join(',')}
											on:change={handleFileSelect}
										/>
										<Paperclip class="h-4 w-4 text-muted-foreground hover:text-foreground" />
									</label>
								</div>
							</div>
							<Button
								class="self-end"
								on:click={sendMessage}
								disabled={(!userInput.trim() && attachments.length === 0) || isAILoading}
							>
								<Send class="h-4 w-4" />
							</Button>
						</div>
					</div>

					{#if isDragging}
						<div
							class="absolute inset-0 bg-background/80 flex items-center justify-center border-2 border-dashed border-primary rounded-lg"
						>
							<p class="text-lg font-medium">Drop files here</p>
						</div>
					{/if}
				</div>
			</div>
		</div>
	</div>
</div>

<style>
	.loading-dots {
		display: flex;
		gap: 4px;
		align-items: center;
		justify-center: center;
	}

	.dot {
		width: 8px;
		height: 8px;
		background-color: currentColor;
		border-radius: 50%;
		animation: bounce 1.4s infinite ease-in-out both;
	}

	.dot:nth-child(1) {
		animation-delay: -0.32s;
	}

	.dot:nth-child(2) {
		animation-delay: -0.16s;
	}

	@keyframes bounce {
		0%,
		80%,
		100% {
			transform: scale(0);
		}
		40% {
			transform: scale(1);
		}
	}
</style>
