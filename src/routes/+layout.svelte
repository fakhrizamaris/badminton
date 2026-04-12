<script>
	import "./layout.css";
	import { page } from "$app/state";

	import { onMount } from "svelte";
	import { initDB } from "$lib/data/store.svelte.js";

	let { children } = $props();

	let currentPath = $derived(page.url.pathname);
	let isHomePage = $derived(currentPath === "/");

	onMount(() => {
		initDB();
	});
</script>

<svelte:head>
	<title>Badminton Split-Bill</title>
</svelte:head>

<div class="min-h-dvh flex flex-col bg-bg">
	<!-- Main content -->
	<main class="flex-1">
		{@render children()}
	</main>

</div>

<style>
	.safe-area-bottom {
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
</style>
