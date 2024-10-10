<script lang="ts">
	import { FileText } from 'lucide-svelte';
	import SvelteMarkdown from 'svelte-markdown';
	import { Card } from '$lib/components/ui/card';
	import type { Message } from '$lib/types';

	export let message: Message;
	export let isLoading: boolean = false;
</script>

{#if isLoading && !message.content}
	<div class="flex gap-2 justify-center">
		<div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: -0.3s;" />
		<div class="w-2 h-2 bg-current rounded-full animate-bounce" style="animation-delay: -0.15s;" />
		<div class="w-2 h-2 bg-current rounded-full animate-bounce" />
	</div>
{:else}
	<div class="space-y-4">
		{#each message.content as item, index}
			{#if item.type === 'text'}
				<div class="prose dark:prose-invert max-w-none">
					<SvelteMarkdown source={item.text} />
				</div>
			{:else if item.type === 'image_url'}
				<div class="mt-2">
					<img
						src={item.image_url}
						alt="Uploaded content"
						class="max-w-full rounded-lg"
						on:error={(e) => {
							e.currentTarget.src = '/placeholder-image.png';
						}}
					/>
				</div>
			{:else if item.type === 'file_url'}
				<Card class="p-3 mt-2 hover:bg-accent transition-colors">
					<a
						href={item.file_url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center gap-2 text-blue-500 hover:text-blue-600"
					>
						<FileText class="h-4 w-4" />
						<span class="text-sm">View attached file</span>
					</a>
				</Card>
			{/if}
		{/each}
	</div>
{/if}
