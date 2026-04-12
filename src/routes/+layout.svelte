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

	<!-- Global Floating Navigation (Professional) -->
	{#if myTickets.length > 0 && !currentPath.includes('/ticket/')}
		<div class="fixed bottom-6 left-1/2 -translate-x-1/2 z-40 animate-slide-up no-print">
			<div class="bg-navy/90 backdrop-blur-md rounded-2xl p-1.5 shadow-2xl shadow-navy/40 border border-white/20 flex items-center gap-1">
				<a 
					href="/" 
					class="px-5 py-2.5 rounded-xl text-xs font-bold transition-all {isHomePage ? 'bg-white text-navy' : 'text-white/60 hover:text-white'}"
				>
					Home
				</a>
				<div class="relative group">
					<button class="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-white/10 flex items-center gap-2 hover:bg-white/20 transition-all">
						My Passes
						<span class="flex h-4 w-4 items-center justify-center rounded-full bg-danger text-[9px] font-black text-white">
							{myTickets.length}
						</span>
					</button>

					<!-- Dropdown (Professional) -->
					<div class="absolute bottom-full left-1/2 -translate-x-1/2 mb-4 w-60 bg-surface rounded-2xl shadow-2xl border border-border/50 overflow-hidden opacity-0 pointer-events-none group-hover:opacity-100 group-hover:pointer-events-auto transition-all transform scale-95 group-hover:scale-100 origin-bottom">
						<div class="p-3 bg-bg border-b border-border/50">
							<p class="text-[10px] font-black text-text-tertiary uppercase tracking-widest">Active Tickets</p>
						</div>
						<div class="max-h-60 overflow-y-auto divide-y divide-border/30">
							{#each myTickets as t}
								<a href="/ticket/{t.id}" class="block p-4 hover:bg-navy/5 transition-all group/item">
									<div class="flex justify-between items-start">
										<div class="min-w-0">
											<p class="text-xs font-bold text-text-primary truncate">{t.session || 'Session'}</p>
											<p class="text-[9px] text-text-tertiary mt-1 font-mono uppercase">#{t.id}</p>
										</div>
										<div class="w-6 h-6 rounded-lg bg-navy/5 flex items-center justify-center text-navy group-hover/item:bg-navy group-hover/item:text-white transition-all">
											<ChevronRight size={14} />
										</div>
									</div>
								</a>
							{/each}
						</div>
					</div>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
	@keyframes slideUp {
		from { transform: translate(-50%, 20px); opacity: 0; }
		to { transform: translate(-50%, 0); opacity: 1; }
	}
	.animate-slide-up {
		animation: slideUp 0.6s cubic-bezier(0.16, 1, 0.3, 1);
	}
	@media print {
		.no-print { display: none !important; }
	}
</style>
