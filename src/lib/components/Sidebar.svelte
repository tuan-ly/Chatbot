<script lang="ts">
	import { Button } from '$lib/components/ui/button';
	import { type Conversation } from '$lib/types';
	export let conversations: Conversation[];
	export let selectConversation: (id: string) => void;
	export let addConversation: () => void;

	function handleSelectConversation(id: string) {
		selectConversation(id);
	}
	// $: {
	// 	console.log('Sidebar conversations updated:', conversations);
	// }
</script>

<div class="w-64 bg-gray-800 text-white h-full flex flex-col">
	<div class="p-4">
		<h2 class="text-xl font-bold mb-4">Conversations</h2>
		<Button on:click={addConversation} class="w-full mb-4">New Conversation</Button>
	</div>
	<ul class="flex-1 overflow-y-auto">
		{#each conversations as conversation (conversation.id)}
			<li
				class="px-4 py-2 hover:bg-gray-700 cursor-pointer transition-colors duration-200"
				on:click={() => handleSelectConversation(conversation.id)}
			>
				{conversation.title}
			</li>
		{/each}
	</ul>
</div>
