<script>
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import { 
		getParticipantByTicket, 
		getSession, 
		calcPlayerCost, 
		db,
		addToCalendar
	} from '$lib/data/store.svelte.js';
	import { 
		ArrowLeft, 
		Download, 
		ShieldCheck, 
		Clock as ClockIcon, 
		MapPin, 
		Calendar, 
		Users,
		Share2,
		PlusCircle
	} from 'lucide-svelte';

	let ticketId = $derived(page.params.id);
	let participant = $derived(getParticipantByTicket(ticketId));
	let session = $derived(participant ? getSession(participant.session_id) : null);
	
	let isPrinting = $state(false);

	function formatCurrency(amount) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}

	function formatDate(dateStr) {
		if (!dateStr) return '';
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	function handleDownload() {
		isPrinting = true;
		setTimeout(() => {
			window.print();
			isPrinting = false;
		}, 100);
	}

	function handleShare() {
		if (navigator.share) {
			navigator.share({
				title: 'My Badminton Pass',
				text: `Check out my badminton pass for ${session?.title}`,
				url: window.location.href
			});
		}
	}
	let qrCanvas;
	
	onMount(async () => {
		if (participant) {
			try {
				const QRCode = (await import('https://cdn.jsdelivr.net/npm/qrcode@1.5.3/+esm')).default;
				await QRCode.toCanvas(qrCanvas, window.location.href, {
					width: 140,
					margin: 0,
					color: {
						dark: '#15335E',
						light: '#FFFFFF00'
					}
				});
			} catch (err) {
				console.error('QR Generate error:', err);
			}
		}
	});
</script>

<svelte:head>
	<title>Member Pass — {participant ? participant.name : 'Badminton'}</title>
</svelte:head>

<div class="min-h-screen bg-bg p-5 pb-12 flex flex-col items-center">
	
	{#if !db.isReady}
		<div class="pt-32 text-center animate-pulse">
			<div class="w-10 h-10 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
			<p class="text-text-secondary text-sm font-medium">Authenticating ticket...</p>
		</div>
	{:else if !participant}
		<div class="pt-32 text-center">
			<div class="w-20 h-20 bg-danger/10 text-danger rounded-full flex items-center justify-center mx-auto mb-6">
				<ClockIcon size={40} />
			</div>
			<h2 class="text-xl font-bold text-text-primary mb-2">Ticket Not Found</h2>
			<p class="text-sm text-text-tertiary mb-8">The ticket ID might be incorrect or has expired.</p>
			<a href="/" class="px-6 py-3 bg-navy text-white font-bold rounded-2xl shadow-lg">Back to Home</a>
		</div>
	{:else}
		<!-- Header -->
		<header class="w-full max-w-sm mb-8 flex items-center justify-between no-print">
			<a href="/session/{session?.id}" class="w-10 h-10 bg-surface rounded-xl flex items-center justify-center border border-border/50 shadow-sm">
				<ArrowLeft size={18} />
			</a>
			<h1 class="text-sm font-black uppercase tracking-widest text-text-primary">Member Pass</h1>
			<div class="w-10"></div>
		</header>

		<!-- Pass UI (Apple Style) -->
		<div class="w-full max-w-sm bg-white rounded-[2.5rem] overflow-hidden shadow-2xl animate-scale-in flex flex-col items-stretch border border-border/20 receipt-card">
			<!-- Top Section: Header -->
			<div class="bg-navy p-7 text-center relative overflow-hidden">
				<div class="absolute -top-12 -right-12 w-32 h-32 bg-white/10 blur-3xl rounded-full"></div>
				<div class="absolute -bottom-10 -left-10 w-24 h-24 bg-white/5 blur-2xl rounded-full"></div>
				
				<p class="text-white/40 text-[10px] font-black uppercase tracking-[0.3em] mb-2">Official Community Pass</p>
				<h2 class="text-white text-2xl font-black tracking-tight leading-none">Badminton IL Batam</h2>
				
				<div class="mt-6 flex justify-center">
					{#if participant.has_paid}
						<div class="bg-success text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-xl shadow-success/30 flex items-center gap-2">
							<ShieldCheck size={12} strokeWidth={3} />
							Verified & Paid
						</div>
					{:else}
						<div class="bg-warning text-white text-[10px] font-black px-4 py-1.5 rounded-full uppercase tracking-widest shadow-xl shadow-warning/30 flex items-center gap-2">
							<ClockIcon size={12} strokeWidth={3} />
							Payment Pending
						</div>
					{/if}
				</div>
			</div>

			<!-- Middle Section: Main Content -->
			<div class="p-8 flex flex-col items-center border-b-2 border-dashed border-border/50 relative">
				<!-- Punch holes -->
				<div class="absolute -left-4 -bottom-4 w-8 h-8 bg-bg border-r border-border/20 rounded-full"></div>
				<div class="absolute -right-4 -bottom-4 w-8 h-8 bg-bg border-l border-border/20 rounded-full"></div>

				{#if participant.has_paid}
					<div class="absolute top-4 right-4 rotate-12 opacity-10">
						<ShieldCheck size={120} class="text-success" />
					</div>
				{/if}

				<div class="w-24 h-24 rounded-full bg-navy/5 flex items-center justify-center mb-5 border-4 border-white shadow-lg ring-1 ring-navy/5 relative group">
					<span class="text-4xl font-black text-navy">{participant.name.charAt(0).toUpperCase()}</span>
					{#if participant.has_paid}
						<div class="absolute -bottom-1 -right-1 w-8 h-8 bg-success text-white rounded-full flex items-center justify-center shadow-lg border-2 border-white">
							<ShieldCheck size={16} />
						</div>
					{/if}
				</div>

				<h3 class="text-xl sm:text-2xl font-black text-text-primary mb-1 text-center leading-tight break-words px-4 w-full">{participant.name}</h3>
				<p class="text-navy text-[10px] font-black tracking-[0.2em] mb-6 sm:mb-10 bg-navy/5 px-4 py-1 rounded-full border border-navy/10">ID: {participant.ticket_id}</p>

				<div class="grid grid-cols-2 gap-x-10 gap-y-8 w-full">
					<div class="text-left">
						<p class="text-[9px] font-black text-text-tertiary uppercase tracking-widest mb-1.5">Session Title</p>
						<p class="text-xs font-bold text-text-primary leading-snug">{session?.title}</p>
					</div>
					<div class="text-right">
						<p class="text-[9px] font-black text-text-tertiary uppercase tracking-widest mb-1.5">Court</p>
						<p class="text-xs font-bold text-text-primary">Axton - Ct {session?.court_count || 1}</p>
					</div>
					<div class="text-left">
						<p class="text-[9px] font-black text-text-tertiary uppercase tracking-widest mb-1.5">Schedule</p>
						<p class="text-xs font-bold text-text-primary leading-tight">
							{formatDate(session?.date).split(',')[0]}<br/>
							<span class="text-[10px] text-text-tertiary">{session?.time}</span>
						</p>
					</div>
					<div class="text-right">
						<p class="text-[9px] font-black text-text-tertiary uppercase tracking-widest mb-1.5">Total Bill</p>
						<p class="text-sm font-black text-navy">{formatCurrency(calcPlayerCost(session, [], participant.needs_racket) + (participant.unique_code || 0))}</p>
					</div>
				</div>
			</div>

			<!-- Bottom Section: QR Code / Security -->
			<div class="p-8 flex flex-col items-center bg-gray-50/50">
				<!-- Real QR Code -->
				<div class="relative mb-6 p-2 bg-white rounded-2xl shadow-sm border border-border/50">
					<canvas bind:this={qrCanvas} class="w-32 h-32"></canvas>
					{#if participant.has_paid}
						<div class="absolute inset-0 flex items-center justify-center pointer-events-none">
							<div class="w-10 h-10 bg-white rounded-xl shadow-xl flex items-center justify-center border border-success/20">
								<ShieldCheck size={24} class="text-success" />
							</div>
						</div>
					{/if}
				</div>
				
				<div class="flex items-center gap-6 mt-2">
					<div class="text-center">
						<p class="text-[8px] font-bold text-text-tertiary uppercase tracking-tighter mb-0.5">Player Class</p>
						<p class="text-[10px] font-black text-text-primary uppercase">{participant.needs_racket ? 'Renter' : 'Owner'}</p>
					</div>
					<div class="w-px h-6 bg-border/50"></div>
					<div class="text-center">
						<p class="text-[8px] font-bold text-text-tertiary uppercase tracking-tighter mb-0.5">Verifier</p>
						<p class="text-[10px] font-black text-text-primary uppercase">GOR</p>
					</div>
					<div class="w-px h-6 bg-border/50"></div>
					<div class="text-center">
						<p class="text-[8px] font-bold text-text-tertiary uppercase tracking-tighter mb-0.5">Audit Code</p>
						<p class="text-[10px] font-black text-text-primary uppercase">{participant.unique_code || '---'}</p>
					</div>
				</div>
			</div>
		</div>

		<!-- Action Buttons -->
		<div class="mt-8 grid grid-cols-4 gap-3 w-full max-w-sm no-print">
			<button 
				onclick={handleDownload}
				class="col-span-2 py-4 bg-surface border border-border/50 rounded-2xl shadow-sm flex items-center justify-center gap-2 text-sm font-bold text-text-primary hover:shadow-md transition-all active:scale-95"
			>
				<Download size={18} />
				<span class="sm:inline hidden">Save PDF</span>
				<span class="sm:hidden inline">Pass</span>
			</button>
			<button 
				onclick={() => addToCalendar(session)}
				class="py-4 bg-surface border border-border/50 rounded-2xl shadow-sm flex items-center justify-center text-navy hover:shadow-md transition-all active:scale-95"
				title="Add to Calendar"
			>
				<PlusCircle size={20} />
			</button>
			<button 
				onclick={handleShare}
				class="py-4 bg-navy text-white rounded-2xl shadow-lg shadow-navy/20 flex items-center justify-center transition-all active:scale-95"
				title="Share"
			>
				<Share2 size={20} />
			</button>
		</div>

		<footer class="mt-12 text-center no-print">
			<p class="text-[11px] text-text-tertiary max-w-[240px] leading-relaxed">
				Tunjukkan QR Code ini kepada PIC lapangan untuk verifikasi kehadiran.
			</p>
		</footer>
	{/if}
</div>

<style>
	@media print {
		.no-print { display: none !important; }
		:global(body) { background: white !important; }
		.receipt-card { 
			box-shadow: none !important; 
			border: 1px solid #eee !important;
			margin-top: 50px !important;
		}
	}

	.animate-scale-in {
		animation: scaleIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
	}

	@keyframes scaleIn {
		from { opacity: 0; transform: scale(0.95) translateY(10px); }
		to { opacity: 1; transform: scale(1) translateY(0); }
	}
</style>
