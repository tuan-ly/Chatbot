<script>
	import { Textarea } from '$lib/components/ui/textarea';
	import { Button } from '$lib/components/ui/button';
	import { Send, Paperclip } from 'lucide-svelte';
	import { onMount } from 'svelte';

	let userInput = '';
	let textareaElement;
	let textareaHeight = 50; // Initial height
	const maxHeight = 200; // Maximum height

	$: isInputEmpty = userInput.trim().length === 0;

	function adjustTextareaHeight() {
		if (textareaElement) {
			textareaElement.style.height = 'auto';
			textareaHeight = Math.min(textareaElement.scrollHeight, maxHeight);
		}
	}

	$: if (userInput) {
		adjustTextareaHeight();
	}

	onMount(() => {
		if (textareaElement) {
			adjustTextareaHeight();
		}
	});

	function handleKeydown(event) {
		if (event.key === 'Enter' && !event.shiftKey) {
			event.preventDefault();
			sendMessage();
		}
	}

	async function sendMessage() {
		if (isInputEmpty) return;
		// Your existing sendMessage logic here
		userInput = '';
		textareaHeight = 50; // Reset height after sending
	}
</script>

<div class="input-area-container">
	<div class="flex items-end gap-2 bg-background p-2 rounded-lg border border-input">
		<div class="flex-grow relative">
			<Textarea
				bind:this={textareaElement}
				bind:value={userInput}
				on:input={adjustTextareaHeight}
				on:keydown={handleKeydown}
				placeholder="Type your message..."
				class="min-h-[50px] max-h-[200px] pr-10 resize-none overflow-y-auto"
				style="height: {textareaHeight}px;"
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
		<Button class="self-end" on:click={sendMessage} disabled={isInputEmpty}>
			<Send class="h-4 w-4" />
		</Button>
	</div>
</div>

<style>
	.input-area-container {
		position: sticky;
		bottom: 0;
		background-color: var(--background);
		padding: 1rem;
		border-top: 1px solid var(--border);
	}

	:global(.input-area-container .textarea) {
		transition: height 0.1s ease-out;
	}
</style>
