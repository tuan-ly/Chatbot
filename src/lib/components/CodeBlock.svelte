<script lang="ts">
	import hljs from 'highlight.js';

	export let code: string = '';
	export let lang: string = '';
	console.log('code', code);

	$: highlighted = code
		? lang && hljs.getLanguage(lang)
			? hljs.highlight(code, { language: lang }).value
			: hljs.highlightAuto(code).value
		: '';
</script>

{#if code}
	<pre class="hljs"><code>{@html highlighted}</code></pre>
{/if}

<style>
	pre {
		white-space: pre-wrap;
		word-break: break-word;
		overflow-x: auto;
	}

	code {
		word-break: break-word;
	}
</style>
