<script>
	import './layout.css';
	import { Home, Shield } from 'lucide-svelte';
	import { page } from '$app/state';

	import { onMount } from 'svelte';
	import { initDB } from '$lib/data/store.svelte.js';

	let { children } = $props();

	let currentPath = $derived(page.url.pathname);
	let isHomePage = $derived(currentPath === '/');

	onMount(() => {
		initDB();
	});
</script>

<svelte:head>
	<title>Badminton Split-Bill</title>
</svelte:head>

<div class="min-h-dvh flex flex-col bg-bg">
	<!-- Main content -->
	<main class="flex-1 {isHomePage ? '' : 'pb-24'}">
		{@render children()}
	</main>

	<!-- Bottom Navigation Bar (hidden on home page which has its own top nav) -->
	{#if !isHomePage}
		<nav class="fixed bottom-0 inset-x-0 z-50 bg-surface/80 backdrop-blur-xl border-t border-border safe-area-bottom">
			<div class="max-w-4xl mx-auto flex items-center justify-around h-16">
				<a
					href="/"
					class="flex flex-col items-center gap-1 px-6 py-2 transition-colors duration-200 {currentPath === '/' ? 'text-navy' : 'text-text-tertiary hover:text-text-secondary'}"
				>
					<Home size={22} strokeWidth={1.5} />
					<span class="text-[10px] font-semibold tracking-wide">Home</span>
				</a>

				<a
					href="/admin"
					class="flex flex-col items-center gap-1 px-6 py-2 transition-colors duration-200 {currentPath === '/admin' ? 'text-navy' : 'text-text-tertiary hover:text-text-secondary'}"
				>
					<Shield size={22} strokeWidth={currentPath === '/admin' ? 2.5 : 1.5} />
					<span class="text-[10px] font-semibold tracking-wide">Admin</span>
				</a>
			</div>
		</nav>
	{/if}
</div>

<style>
	.safe-area-bottom {
		padding-bottom: env(safe-area-inset-bottom, 0px);
	}
</style>
