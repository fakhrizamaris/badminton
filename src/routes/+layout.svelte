<script>
	import "./layout.css";
	import { page } from "$app/state";

	import { onMount } from "svelte";
	import { initDB } from "$lib/data/store.svelte.js";
	import { ChevronRight, ChevronUp, ChevronDown } from "lucide-svelte";

	let { children } = $props();

	let currentPath = $derived(page.url.pathname);
	let isHomePage = $derived(currentPath === "/");

	let myTickets = $state([]);

	onMount(() => {
		initDB();
		myTickets = JSON.parse(localStorage.getItem('my_tickets') || '[]');
	});
</script>

<svelte:head>
	<title>Badminton Split-Bill</title>
</svelte:head>

<div class="min-h-dvh flex flex-col bg-bg">
	<!-- Main content -->
	<main class="flex-1 pb-20">
		{@render children()}
	</main>
</div>

<style>
</style>
