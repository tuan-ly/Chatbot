<script lang="ts" context="module">
	function clickOutside(node: HTMLElement) {
		const handleClick = (event: MouseEvent) => {
			if (!node.contains(event.target as Node)) {
				node.dispatchEvent(new CustomEvent('outclick'));
			}
		};

		document.addEventListener('click', handleClick, true);

		return {
			destroy() {
				document.removeEventListener('click', handleClick, true);
			}
		};
	}
</script>

<!-- DropdownMenu.svelte -->
<script lang="ts">
	import { createEventDispatcher } from 'svelte';
	import { MoreVertical } from 'lucide-svelte';
	import { Button } from './ui/button';

	export let show = false;

	const dispatch = createEventDispatcher();

	function handleRename() {
		dispatch('rename');
		show = false;
	}

	function handleDelete() {
		dispatch('delete');
		show = false;
	}

	function handleClickOutside(event: MouseEvent) {
		if (!(event.target as HTMLElement).closest('.dropdown-menu')) {
			show = false;
		}
	}
</script>

<div class="relative">
	<Button variant="ghost" size="icon" on:click={() => (show = !show)}>
		<MoreVertical class="h-4 w-4" />
	</Button>

	{#if show}
		<div
			class="dropdown-menu absolute right-0 mt-2 w-48 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 z-10"
			use:clickOutside
		>
			<div class="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
				<button
					class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
					role="menuitem"
					on:click={handleRename}
				>
					Rename
				</button>
				<button
					class="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-100 hover:text-gray-900 w-full text-left"
					role="menuitem"
					on:click={handleDelete}
				>
					Delete
				</button>
			</div>
		</div>
	{/if}
</div>
