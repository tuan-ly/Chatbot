<!-- MessageContent.svelte -->
<script lang="ts">
	import SvelteMarkdown from 'svelte-markdown';
	import { Image, FileText } from 'lucide-svelte';

	export let message: any;

	function getFileIcon(type: string) {
		if (type.startsWith('image/')) {
			return Image;
		}
		return FileText;
	}

	let content: { text: string; attachments: any[] } | null = null;

	$: {
		try {
			content = JSON.parse(message.content);
		} catch {
			content = { text: message.content, attachments: [] };
		}
	}
</script>

{#if content}
	{#if content.text}
		<SvelteMarkdown source={content.text} />
	{/if}

	{#if content.attachments?.length > 0}
		<div class="mt-2 space-y-2">
			{#each content.attachments as attachment}
				<div class="flex items-center space-x-2">
					<a
						href={attachment.url}
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center space-x-2 text-blue-500 hover:text-blue-600"
					>
						<svelte:component this={getFileIcon(attachment.type)} class="h-4 w-4" />
						<span>{attachment.name}</span>
					</a>
				</div>
			{/each}
		</div>
	{/if}
{/if}
