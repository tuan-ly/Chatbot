<!-- DropdownMenu.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { MoreVertical } from 'lucide-svelte';
	import { Button } from './ui/button';

	export let isOpen = false;

	const dispatch = createEventDispatcher();

	function handleRename() {
		dispatch('rename');
		dispatch('close');
	}

	function handleDelete() {
		dispatch('delete');
		dispatch('close');
	}

	function handleToggle(event: MouseEvent) {
		event.stopPropagation();
		dispatch('toggle');
	}
</script>

<div class="dropdown-menu relative">
	<Button variant="ghost" size="icon" on:click={handleToggle}>
		<MoreVertical class="h-4 w-4" />
	</Button>

	{#if isOpen}
		<div
			class="absolute right-0 mt-2 w-24 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
		>
			<div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
				<button
					class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
					role="menuitem"
					on:click|stopPropagation={handleRename}
				>
					Rename
				</button>
				<button
					class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
					role="menuitem"
					on:click|stopPropagation={handleDelete}
				>
					Delete
				</button>
			</div>
		</div>
	{/if}
</div>
