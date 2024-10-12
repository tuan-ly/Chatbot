<script lang="ts">
	import { writable } from 'svelte/store';
	import { Button } from '$lib/components/ui/button';
	import { Textarea } from '$lib/components/ui/textarea';
	import { ScrollArea } from '$lib/components/ui/scroll-area';
	import { Separator } from '$lib/components/ui/separator';
	import { Card } from '$lib/components/ui/card';
	import { cn } from '$lib/utils';
	import {
		PanelLeftOpen,
		Send,
		Plus,
		Settings,
		Paperclip,
		X,
		Image,
		FileText
	} from 'lucide-svelte';
	import { supabase } from '$lib/supabaseClient';
	import { goto } from '$app/navigation';
	import type { Conversation, Message, Profile, ContentItem } from '$lib/types';
	import { onMount } from 'svelte';
	import { models } from '$lib/config';
	import MessageContent from '$lib/components/MessageContent.svelte';
	import DropdownMenu from '$lib/components/DropdownMenu.svelte';
	import { MessageHandler } from '$lib/messageHandler';

	let conversations: Conversation[] = [];
	let currentConversationId: string | null = null;
	let currentConversation: Conversation | undefined;
	let userInput = '';
	let selectedModel = 'gpt-4o';
	let isAILoading = false;
	let canSendMessage = false;
	let userCredits = 0;
	let userId: string | null = null;
	let isMobileSidebarOpen = false;

	onMount(async () => {
		const { data: session } = await supabase.auth.getSession();

		if (!session?.session) {
			goto('/login');
			return;
		} else {
			userId = session.session.user.id;
			await loadConversationsFromSupabase(userId);
			await loadUserCredits(userId);

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

	function toggleMobileSidebar() {
		isMobileSidebarOpen = !isMobileSidebarOpen;
	}

	function closeMobileSidebar() {
		isMobileSidebarOpen = false;
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
			// Check if any message has a content type that is not "text"
			const hasNonTextContent = messageArray.some((message) =>
				message.content.some((item) => item.type !== 'text')
			);
			if (model !== 'claude-3-5-sonnet-20240620' && hasNonTextContent) {
				return 'Can not process non-text content in this model';
			}

			const {
				data: { session }
			} = await supabase.auth.getSession();
			if (!session) {
				throw new Error('User not authenticated');
			}

			const formattedMessageArray = MessageHandler.formatMesssages(messageArray, model);

			console.log('formattedMessageArray', formattedMessageArray);
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

	let attachments: File[] = [];
	let isDragging = false;
	const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
	const ALLOWED_TYPES = [
		'image/jpeg',
		'image/png',
		'image/gif',
		'application/pdf',
		'text/plain',
		'application/msword',
		'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
	];

	function handleFileSelect(event: Event) {
		const input = event.target as HTMLInputElement;
		if (input.files) {
			addFiles(Array.from(input.files));
		}
	}

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

	function addFiles(files: File[]) {
		for (const file of files) {
			if (file.size > MAX_FILE_SIZE) {
				alert(`File ${file.name} is too large. Maximum size is 20MB.`);
				continue;
			}

			if (!ALLOWED_TYPES.includes(file.type)) {
				alert(`File type ${file.type} is not supported.`);
				continue;
			}

			attachments = [...attachments, file];
		}
	}

	function removeAttachment(index: number) {
		attachments = attachments.filter((_, i) => i !== index);
	}

	function getFileIcon(type: string) {
		if (type.startsWith('image/')) {
			return Image;
		}
		return FileText;
	}

	async function sendMessage(retry = false) {
		if (!userId || (!userInput.trim() && attachments.length === 0) || !currentConversationId) {
			return;
		}

		const content: ContentItem[] = [];

		if (userInput.trim()) {
			content.push({
				type: 'text',
				text: userInput.trim()
			});
		}

		if (attachments.length > 0) {
			try {
				const uploadedContents = await MessageHandler.processUploadedFiles(attachments);
				content.push(...uploadedContents);
			} catch (error) {
				console.error('Upload error:', error);
				alert('Failed to upload files. Please try again.');
				return;
			}
		}

		const userMessage = await MessageHandler.saveMessage(currentConversationId, 'user', content);

		if (!userMessage) {
			alert('Failed to save message. Please try again.');
			return;
		}

		if (currentConversation) {
			currentConversation.messages = [...currentConversation.messages, userMessage];
		}

		const originalInput = userInput;
		userInput = '';
		attachments = [];
		isAILoading = true;

		// Add a processing message
		const processingMessage: Message = {
			id: 'processing',
			conversation_id: currentConversationId,
			role: 'assistant',

			created_at: new Date().toISOString()
		};

		if (currentConversation) {
			currentConversation.messages = [...currentConversation.messages, processingMessage];
		}

		try {
			const response = await sendRequest(
				currentConversation?.messages.filter((msg) => msg.id !== 'processing') || [],
				selectedModel,
				currentConversationId
			);

			if (response) {
				const aiMessage = await MessageHandler.saveMessage(currentConversationId, 'assistant', [
					{
						type: 'text',
						text: response
					}
				]);

				if (aiMessage && currentConversation) {
					currentConversation.messages = currentConversation.messages
						.filter((msg) => msg.id !== 'processing')
						.concat(aiMessage);
				}
			}
		} catch (error) {
			console.error('Error:', error);
			if (!retry) {
				const shouldRetry = confirm(
					"Sorry, I couldn't process your request. Would you like to try again?"
				);
				if (shouldRetry) {
					userInput = originalInput;
					sendMessage(true);
				}
			} else {
				alert("Sorry, I couldn't process your request. Please try again later.");
			}
		} finally {
			isAILoading = false;
		}
	}

	async function selectConversation(id: string) {
		currentConversationId = id;

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

	async function renameConversation(id: string) {
		const conversation = conversations.find((conv) => conv.id === id);
		if (!conversation) return;

		const newTitle = prompt('Enter new conversation title:', conversation.title);
		if (!newTitle) return;

		const { error } = await supabase.from('conversations').update({ title: newTitle }).eq('id', id);

		if (error) {
			console.error('Error renaming conversation:', error);
			alert('Failed to rename conversation. Please try again.');
		} else {
			conversation.title = newTitle;
			conversations = [...conversations];
		}
	}

	async function deleteConversation(id: string) {
		if (!confirm('Are you sure you want to delete this conversation?')) {
			return;
		}

		const { error } = await supabase.from('conversations').delete().eq('id', id);

		if (error) {
			console.error('Error deleting conversation:', error);
			alert('Failed to delete conversation. Please try again.');
		} else {
			conversations = conversations.filter((conv) => conv.id !== id);
			if (currentConversationId === id) {
				currentConversationId = conversations[0]?.id || null;
				currentConversation = conversations[0];
			}
		}
	}

	const openDropdowns = writable<Record<string, boolean>>({});

	function toggleDropdown(id: string) {
		openDropdowns.update((state) => {
			const newState = Object.keys(state).reduce(
				(acc, key) => {
					acc[key] = false;
					return acc;
				},
				{} as Record<string, boolean>
			);

			newState[id] = !state[id];
			return newState;
		});
	}

	function closeAllDropdowns() {
		openDropdowns.set({});
	}

	$: currentConversation = conversations.find((conv) => conv.id === currentConversationId);
	$: canSendMessage = userInput.trim() !== '';
</script>

<div class="flex h-screen bg-background">
	<!-- Sidebar (always visible on desktop, hidden by default on mobile) -->
	<aside class="w-64 bg-muted/40 border-r hidden md:block">
		<div class="flex h-full flex-col p-4">
			<div class="flex items-center justify-between mb-4">
				<Button variant="outline" class="w-full" on:click={addConversation}>
					<Plus class="mr-2 h-4 w-4" />
					New Chat
				</Button>
			</div>

			<ScrollArea class="flex-1">
				{#each conversations as conversation}
					<div
						class="flex items-center mb-1 group relative"
						class:active={currentConversationId === conversation.id}
					>
						<Button
							variant={currentConversationId === conversation.id ? 'secondary' : 'ghost'}
							class="flex-1 justify-start truncate pr-8"
							on:click={() => selectConversation(conversation.id)}
						>
							{conversation.title}
						</Button>
						<div class="absolute right-1">
							<DropdownMenu
								isOpen={$openDropdowns[conversation.id] || false}
								on:toggle={() => toggleDropdown(conversation.id)}
								on:rename={() => renameConversation(conversation.id)}
								on:delete={() => deleteConversation(conversation.id)}
								on:close={closeAllDropdowns}
							/>
						</div>
					</div>
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
	</aside>

	<!-- Main content -->
	<div class="flex-1 flex flex-col">
		<!-- Mobile sidebar toggle and header -->
		<header class="p-4 border-b md:hidden">
			<Button variant="ghost" size="icon" on:click={toggleMobileSidebar}>
				<PanelLeftOpen class="h-4 w-4" />
			</Button>
		</header>

		<!-- Messages and input area -->
		<div class="flex-1 flex flex-col relative">
			<!-- Messages area with fixed height -->
			<div class="flex-1 overflow-y-auto">
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
											'max-w-[90%] sm:max-w-[80%] p-3 sm:p-4 overflow-hidden',
											message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-muted'
										)}
									>
										<div class="break-words overflow-wrap-anywhere">
											<MessageContent {message} isLoading={isAILoading && !message.content} />
										</div>
									</Card>
								</div>
							{/each}
						{/if}
					{/if}
				</ScrollArea>
			</div>
			<!-- Input Area -->
			<div class="border-t p-2 sm:p-4">
				<div class="container w-full mx-auto">
					<div
						class=" p-2 sm:p-4"
						on:dragover={handleDragOver}
						on:dragleave={handleDragLeave}
						on:drop={handleDrop}
					>
						<div class="container w-full mx-auto">
							<!-- Show attachments preview only when there are attachments -->
							{#if attachments.length > 0}
								<div class="mb-4 flex flex-wrap gap-2">
									{#each attachments as file, index}
										<div class="flex items-center gap-2 bg-muted p-2 rounded-md">
											<svelte:component this={getFileIcon(file.type)} class="h-4 w-4" />
											<span class="text-sm truncate max-w-[150px] sm:max-w-[200px]">
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

							<div class="flex flex-col sm:flex-row gap-2">
								<select
									bind:value={selectedModel}
									class="w-full sm:w-40 rounded-md border border-input bg-background px-3 py-2 text-sm mb-2 sm:mb-0"
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
	</div>
	<!-- Mobile sidebar (off-canvas) -->
	{#if isMobileSidebarOpen}
		<div
			class="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 md:hidden"
			on:click={closeMobileSidebar}
		>
			<aside class="w-64 h-full bg-muted/40 border-r" on:click|stopPropagation>
				<div class="flex h-full flex-col p-4">
					<div class="flex items-center justify-between mb-4">
						<Button variant="outline" class="w-full" on:click={addConversation}>
							<Plus class="mr-2 h-4 w-4" />
							New Chat
						</Button>
					</div>

					<ScrollArea class="flex-1">
						{#each conversations as conversation}
							<div
								class="flex items-center mb-1 group relative"
								class:active={currentConversationId === conversation.id}
							>
								<Button
									variant={currentConversationId === conversation.id ? 'secondary' : 'ghost'}
									class="flex-1 justify-start truncate pr-8"
									on:click={() => selectConversation(conversation.id)}
								>
									{conversation.title}
								</Button>
								<div class="absolute right-1">
									<DropdownMenu
										isOpen={$openDropdowns[conversation.id] || false}
										on:toggle={() => toggleDropdown(conversation.id)}
										on:rename={() => renameConversation(conversation.id)}
										on:delete={() => deleteConversation(conversation.id)}
										on:close={closeAllDropdowns}
									/>
								</div>
							</div>
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
			</aside>
		</div>
	{/if}
</div>

<style>
	:global(.overflow-wrap-anywhere) {
		overflow-wrap: anywhere;
	}
	:global(.dropdown-menu) {
		position: static;
	}
	.active .absolute {
		opacity: 1;
	}

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

	.flex-1.flex.flex-col {
		height: calc(100vh - 57px); /* Adjust 57px if your header height differs */
	}

	.flex-1.overflow-y-auto {
		height: 0; /* This allows the flex-grow to work properly */
	}

	/* Ensure the input area stays at the bottom */
	.border-t {
		flex-shrink: 0;
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

	@media (max-width: 768px) {
		.container {
			padding-left: 1rem;
			padding-right: 1rem;
		}
	}
</style>
