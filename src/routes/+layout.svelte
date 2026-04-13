<script>
	import "./layout.css";
	import { page } from "$app/state";

	import { onMount } from "svelte";
	import { initDB, db } from "$lib/data/store.svelte.js";
	import { startPerformanceMonitoring } from "$lib/perf/monitoring.js";
	import { 
		ChevronRight, ChevronUp, ChevronDown, 
		CheckCircle2, XCircle, Info, AlertTriangle, X 
	} from "lucide-svelte";
	import { fade, fly, scale } from "svelte/transition";
	import { backOut } from "svelte/easing";

	let { children } = $props();

	let currentPath = $derived(page.url.pathname);
	let isHomePage = $derived(currentPath === "/");

	let myTickets = $state([]);

	onMount(() => {
		initDB();
		myTickets = JSON.parse(localStorage.getItem('my_tickets') || '[]');
		const stopPerfMonitoring = startPerformanceMonitoring();

		return () => {
			stopPerfMonitoring();
		};
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

	<!-- Global Toasts -->
	<div class="fixed top-0 left-0 right-0 z-[10000] pointer-events-none p-4 flex flex-col items-center sm:items-end gap-3">
		{#each db.toasts as toast (toast.id)}
			<div 
				in:fly={{ y: -20, duration: 400, easing: backOut }}
				out:fade={{ duration: 200 }}
				class="w-full max-w-[340px] pointer-events-auto overflow-hidden bg-surface/80 backdrop-blur-xl border border-divider shadow-2xl rounded-2xl flex items-center p-4 gap-3 group"
			>
				<div class="flex-shrink-0">
					{#if toast.type === 'success'}
						<CheckCircle2 class="text-success" size={20} />
					{:else if toast.type === 'error'}
						<XCircle class="text-danger" size={20} />
					{:else}
						<Info class="text-navy" size={20} />
					{/if}
				</div>
				<p class="flex-1 text-sm font-semibold text-text-primary leading-tight">{toast.message}</p>
			</div>
		{/each}
	</div>

	<!-- Global Confirm Modal -->
	{#if db.confirm}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div 
			class="fixed inset-0 z-[10001] bg-black/40 backdrop-blur-md flex items-center justify-center p-6"
			in:fade={{ duration: 200 }}
			onclick={() => db.confirm.resolve(false)}
		>
			<div 
				class="bg-surface w-full max-w-[320px] rounded-3xl shadow-2xl overflow-hidden border border-border/50"
				in:scale={{ start: 0.9, duration: 300, easing: backOut }}
				onclick={(e) => e.stopPropagation()}
			>
				<div class="p-6 text-center">
					<div class="w-12 h-12 rounded-2xl bg-bg mx-auto mb-4 flex items-center justify-center">
						{#if db.confirm.type === 'danger'}
							<AlertTriangle class="text-danger" size={24} />
						{:else}
							<Info class="text-navy" size={24} />
						{/if}
					</div>
					<h3 class="text-lg font-bold text-text-primary mb-2 leading-tight">{db.confirm.title}</h3>
					<p class="text-sm text-text-secondary leading-relaxed">{db.confirm.message}</p>
				</div>
				<div class="flex border-t border-border/50">
					<button 
						class="flex-1 py-4 text-sm font-bold text-text-secondary hover:bg-bg transition-colors border-r border-border/50"
						onclick={() => db.confirm.resolve(false)}
					>
						{db.confirm.cancelText}
					</button>
					<button 
						class="flex-1 py-4 text-sm font-black transition-colors hover:bg-bg {db.confirm.type === 'danger' ? 'text-danger' : 'text-navy'}"
						onclick={() => db.confirm.resolve(true)}
					>
						{db.confirm.confirmText}
					</button>
				</div>
			</div>
		</div>
	{/if}
</div>

<style>
</style>
