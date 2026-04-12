<script>
	import { page } from '$app/state';
	import { onMount } from 'svelte';
	import {
		getSession,
		getParticipants,
		addParticipant,
		markPaid,
		calcCourtShare,
		calcRacketShare,
		calcTotalCost,
		calcPlayerCost,
		isRSVPOpen,
		initDB,
		db,
		uploadPaymentProof,
		isSessionPassed,
		triggerConfetti,
		triggerHaptic
	} from '$lib/data/store.svelte.js';
	import {
		ArrowLeft,
		Calendar,
		Users,
		Zap,
		Lock,
		CircleDollarSign,
		QrCode,
		Check,
		CheckCircle,
		Clock,
		X,
		Info,
		Feather,
		Upload
	} from 'lucide-svelte';

	// Reactive session data
	let session = $derived(getSession(page.params.id));
	let sessionParticipants = $derived(getParticipants(page.params.id));

	// RSVP form state
	let playerName = $state('');
	let needsRacket = $state(false);
	let formError = $state('');
	let justJoined = $state(false);

	// QRIS modal state
	let showQrisModal = $state(false);
	let payingParticipantId = $state(null);
	let payingNeedsRacket = $state(false);
	let isUploadingProof = $state(false);
	let proofSuccess = $state(false);
	let isHomePage = $derived(currentPath === "/");
	let myParticipantId = $state(null);

	onMount(() => {
		initDB();
		// 1. Cek dari URL dulu (Paling kuat, misal dari link yang dibagikan)
		const ticketParam = page.url.searchParams.get('ticket');
		if (ticketParam) {
			findAndClaimTicket(ticketParam);
		} else {
			// 2. Cek dari LocalStorage (HP yang sama)
			myParticipantId = localStorage.getItem(`rsvp_${page.params.id}`);
		}
	});

	let recoverTicketId = $state('');
	let recoverError = $state('');

	async function findAndClaimTicket(id) {
		const p = sessionParticipants.find(p => p.ticket_id === id.toUpperCase() || p.id === id);
		if (p) {
			myParticipantId = p.id;
			localStorage.setItem(`rsvp_${page.params.id}`, p.id);
			recoverError = '';
			recoverTicketId = '';
			// Bersihkan URL tanpa reload
			const newUrl = new URL(window.location.href);
			newUrl.searchParams.delete('ticket');
			window.history.replaceState({}, '', newUrl);
		} else if (recoverTicketId) {
			recoverError = 'Ticket ID not found. Please check again.';
		}
	}

	let myRegistration = $derived(sessionParticipants.find(p => p.id === myParticipantId));
	let showReceipt = $state(false);

	let modalCost = $derived.by(() => {
		if (!session) return 0;
		if (payingParticipantId) {
			const p = sessionParticipants.find((p) => p.id === payingParticipantId);
			const base = calcPlayerCost(session, sessionParticipants, p?.needs_racket ?? false);
			return base + (p?.unique_code || 0);
		}
		return costOwnRacket;
	});

	// Derived pricing
	let courtShare = $derived(calcCourtShare(session, sessionParticipants));
	let racketShare = $derived(calcRacketShare(session, sessionParticipants));
	let costOwnRacket = $derived(calcPlayerCost(session, sessionParticipants, false));
	let costRentRacket = $derived(calcPlayerCost(session, sessionParticipants, true));
	let totalCost = $derived(calcTotalCost(session));
	let rentersCount = $derived(sessionParticipants.filter((p) => p.needs_racket).length);

	/**
	 * Format a date string to a readable format
	 * @param {string} dateStr
	 */
	function formatDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'long',
			day: 'numeric',
			month: 'long',
			year: 'numeric'
		});
	}

	/**
	 * Format currency in IDR
	 * @param {number} amount
	 */
	function formatCurrency(amount) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}
	async function handleJoin() {
		const trimmed = playerName.trim();
		if (!trimmed) {
			formError = 'Please enter your name';
			return;
		}
		const duplicate = sessionParticipants.find(
			(p) => p.name.toLowerCase() === trimmed.toLowerCase()
		);
		if (duplicate) {
			formError = 'This name is already registered';
			return;
		}

		const newParticipant = await addParticipant(page.params.id, trimmed, needsRacket);
		if (newParticipant) {
			triggerHaptic('success');
			myParticipantId = newParticipant.id;
			localStorage.setItem(`rsvp_${page.params.id}`, newParticipant.id);
			
			// Tambahkan ke daftar kado tiket global
			const allTickets = JSON.parse(localStorage.getItem('my_tickets') || '[]');
			if (!allTickets.find(t => t.id === newParticipant.ticket_id)) {
				allTickets.push({
					id: newParticipant.ticket_id,
					session: session?.title,
					date: session?.date
				});
				localStorage.setItem('my_tickets', JSON.stringify(allTickets));
			}
			triggerConfetti();
		}
		
		playerName = '';
		needsRacket = false;
		formError = '';
		justJoined = true;
		setTimeout(() => (justJoined = false), 5000);
	}

	function sendWAConfirmation() {
		if (!myRegistration || !session) return;
		
		const status = myRegistration.has_paid ? 'PAID' : 'AWAITING VERIFICATION';
		const text = `Hi Admin, I'm *${myRegistration.name}* confirming my badminton registration:\n\n` +
					 `📍 Session: ${session.title}\n` +
					 `📅 Date: ${formatDate(session.date)}\n` +
					 `💰 Status: ${status}\n\n` +
					 `I have uploaded the payment proof on the website. Please check it!`;
		
		window.open(`https://wa.me/6281234567890?text=${encodeURIComponent(text)}`, '_blank');
	}

	/**
	 * Open QRIS payment modal
	 * @param {string|null} participantId
	 * @param {boolean} racketNeeded
	 */
	function openPayment(participantId, racketNeeded = false) {
		payingParticipantId = participantId;
		payingNeedsRacket = racketNeeded;
		showQrisModal = true;
		proofSuccess = false;
	}

	async function handleProofUpload(e) {
		const file = e.target.files[0];
		if (!file || !payingParticipantId) return;

		isUploadingProof = true;
		try {
			await uploadPaymentProof(payingParticipantId, file);
			proofSuccess = true;
		} catch (err) {
			console.error('Proof upload failed:', err);
		} finally {
			isUploadingProof = false;
		}
	}

	async function confirmPayment() {
		if (payingParticipantId) {
			await markPaid(payingParticipantId);
		}
		showQrisModal = false;
		payingParticipantId = null;
	}

	function closeModal() {
		showQrisModal = false;
		payingParticipantId = null;
	}
</script>

<svelte:head>
	<title>{session ? session.title : 'Session'} — Badminton Split-Bill</title>
</svelte:head>

{#if !db.isReady}
	<div class="max-w-4xl mx-auto px-5 pt-32 text-center animate-pulse">
		<div class="w-12 h-12 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
		<p class="text-text-secondary text-sm font-medium">Loading session data...</p>
	</div>
{:else if !session}
	<div class="max-w-4xl mx-auto px-5 pt-20 text-center">
		<p class="text-text-secondary text-lg">Session not found.</p>
		<a href="/" class="inline-block mt-4 text-navy font-semibold text-sm">← Back to Home</a>
	</div>
{:else}
	<div class="max-w-4xl mx-auto px-5">

		<!-- Header -->
		<header class="pt-6 pb-4 flex items-center gap-3 animate-fade-in">
			<a
				href="/"
				class="w-10 h-10 rounded-xl bg-surface border border-border/50 flex items-center justify-center shadow-sm hover:shadow-md transition-all active:scale-95"
			>
				<ArrowLeft size={18} class="text-text-primary" />
			</a>
			<div class="flex-1 min-w-0">
				<h1 class="text-base sm:text-lg font-bold text-text-primary truncate">{session.title}</h1>
				<p class="text-[10px] sm:text-xs text-text-secondary">{formatDate(session.date)} · {session.time}</p>
				
				<!-- RSVP Deadline Status -->
				{#if !session.is_locked}
					<div class="mt-1.5 flex items-center gap-2">
						{#if isRSVPOpen(session)}
							<div class="w-1.5 h-1.5 rounded-full bg-success animate-pulse"></div>
							<p class="text-[10px] font-bold text-success uppercase tracking-widest">RSVP Open (H-1)</p>
						{:else}
							<div class="w-1.5 h-1.5 rounded-full bg-danger"></div>
							<p class="text-[10px] font-bold text-danger uppercase tracking-widest">Deadline Passed</p>
						{/if}
					</div>
				{/if}
			</div>
			{#if session.is_locked}
				<span class="inline-flex items-center gap-1 px-3 py-1.5 rounded-full bg-warning/10 text-warning text-xs font-semibold">
					<Lock size={12} />
					Locked
				</span>
			{/if}
		</header>

		<!-- Session Ended Banner -->
		{#if isSessionPassed(session)}
			<div class="bg-text-tertiary/5 border border-border/50 rounded-2xl p-4 mb-5 flex items-center gap-3 animate-fade-in">
				<div class="w-10 h-10 rounded-xl bg-text-tertiary/10 flex items-center justify-center flex-shrink-0">
					<Check size={20} class="text-text-tertiary" />
				</div>
				<div>
					<p class="text-sm font-bold text-text-secondary">Session Ended</p>
					<p class="text-[11px] text-text-tertiary">This session has concluded. You can still view the details below.</p>
				</div>
			</div>
		{/if}

		<!-- Session Info Cards -->
		<div class="grid grid-cols-3 gap-3 mb-5 animate-fade-in-up" style="animation-delay: 80ms">
			<div class="bg-surface rounded-2xl border border-border/50 p-3 text-center shadow-sm">
				<div class="w-8 h-8 rounded-xl bg-navy/5 flex items-center justify-center mx-auto mb-2">
					<Calendar size={16} class="text-navy" />
				</div>
				<p class="text-lg font-bold text-text-primary">{session.court_count}</p>
				<p class="text-[10px] text-text-tertiary font-medium">Courts</p>
			</div>
			<div class="bg-surface rounded-2xl border border-border/50 p-3 text-center shadow-sm">
				<div class="w-8 h-8 rounded-xl bg-navy/5 flex items-center justify-center mx-auto mb-2">
					<Zap size={16} class="text-navy" />
				</div>
				<p class="text-lg font-bold text-text-primary">{session.racket_count}</p>
				<p class="text-[10px] text-text-tertiary font-medium">Rackets</p>
			</div>
			<div class="bg-surface rounded-2xl border border-border/50 p-3 text-center shadow-sm">
				<div class="w-8 h-8 rounded-xl bg-navy/5 flex items-center justify-center mx-auto mb-2">
					<Users size={16} class="text-navy" />
				</div>
				<p class="text-lg font-bold text-text-primary">{sessionParticipants.length}</p>
				<p class="text-[10px] text-text-tertiary font-medium">Players</p>
			</div>
		</div>

		<!-- Personal Status Banner (LocalStorage Recognition) -->
		{#if myRegistration}
			<div class="mb-5 animate-scale-in">
				<div class="bg-navy rounded-3xl p-5 shadow-xl shadow-navy/20 border border-white/10 relative overflow-hidden group">
					<!-- Apple Identity Glow -->
					<div class="absolute -top-10 -right-10 w-32 h-32 bg-white/10 blur-[40px] rounded-full group-hover:scale-125 transition-transform duration-700"></div>
					
					<div class="flex items-center justify-between mb-4 relative z-10">
						<div class="flex items-center gap-2">
							<div class="px-2 py-0.5 rounded-md bg-white/10 border border-white/10 text-[9px] font-bold text-white/50 uppercase tracking-widest">
								Pass ID: {myRegistration.id.slice(0, 8)}
							</div>
						</div>
						{#if myRegistration.has_paid}
							<a 
								href="/ticket/{myRegistration.ticket_id}"
								class="text-[9px] font-bold text-navy bg-white px-3 py-1.5 rounded-full flex items-center gap-1.5 hover:bg-white/90 transition-all shadow-lg active:scale-95"
							>
								<CheckCircle size={10} /> View Membership Pass
							</a>
						{/if}
					</div>
					
					<div class="flex items-end justify-between relative z-10">
						<div class="min-w-0">
							<p class="text-[10px] font-semibold text-white/40 uppercase tracking-wider mb-1">Registered Player</p>
							<h4 class="text-white text-lg sm:text-xl font-bold leading-none tracking-tight truncate">{myRegistration?.name || 'Loading...'}</h4>
							<div class="flex items-center gap-2 mt-2">
								<span class="text-[10px] text-white/60 bg-white/5 px-2 py-0.5 rounded-md border border-white/5 font-mono">
									Ticket ID: {myRegistration?.ticket_id || '---'}
								</span>
							</div>
						</div>
						
						<div class="text-right">
							{#if myRegistration.has_paid}
								<div class="flex flex-col items-end gap-1">
									<div class="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center border border-success/30 text-success mb-1">
										<Check size={18} strokeWidth={3} />
									</div>
									<p class="text-[10px] font-bold text-success uppercase tracking-widest">Verified</p>
								</div>
							{:else if myRegistration.payment_proof_url}
								<div class="flex flex-col items-end gap-1">
									<div class="w-8 h-8 rounded-full bg-warning/20 flex items-center justify-center border border-warning/30 text-warning mb-1">
										<Clock size={18} />
									</div>
									<p class="text-[10px] font-bold text-warning uppercase tracking-widest text-center">In Review</p>
								</div>
							{:else}
								<button 
									onclick={() => openPayment(myRegistration.id, myRegistration.needs_racket)}
									class="flex flex-col items-end gap-2 group/btn"
								>
									<span class="text-[10px] font-bold text-white/40 group-hover/btn:text-white/60 transition-colors">Transfer ID: Rp ...{myRegistration.unique_code}</span>
									<div class="px-5 py-2.5 bg-white text-navy font-bold text-xs rounded-xl shadow-lg border border-white active:scale-95 transition-all">
										Pay Fees
									</div>
								</button>
							{/if}
						</div>
					</div>
				</div>
			</div>
		{/if}

		<!-- Price Card: Two-Tier Pricing -->
		<div
			class="rounded-3xl overflow-hidden mb-5 animate-fade-in-up {session.is_locked ? 'bg-navy shadow-lg shadow-navy/25' : 'bg-surface border border-border/50 shadow-sm'}"
			style="animation-delay: 160ms"
		>
			<div class="p-5">
				<div class="flex items-center gap-2 mb-4">
					<CircleDollarSign size={16} class={session.is_locked ? 'text-white/60' : 'text-navy'} />
					<p class="text-xs font-semibold {session.is_locked ? 'text-white/60' : 'text-text-secondary'} uppercase tracking-wider">
						{session.is_locked ? 'Final Locked Bill' : 'Estimated Price'}
					</p>
				</div>

				<!-- Two price tiers -->
				<div class="grid grid-cols-2 gap-3 mb-4">
					<!-- Own racket -->
					<div class="rounded-2xl p-3 {session.is_locked ? 'bg-white/10' : 'bg-bg'}">
						<p class="text-[10px] font-medium {session.is_locked ? 'text-white/50' : 'text-text-tertiary'} flex items-center gap-1.5 uppercase tracking-wider mb-1">
							<Feather size={12} /> Own Racket
						</p>
						<p class="text-lg sm:text-xl font-bold {session.is_locked ? 'text-white' : 'text-text-primary'} tracking-tight">
							{formatCurrency(costOwnRacket)}
						</p>
						<p class="text-[10px] {session.is_locked ? 'text-white/40' : 'text-text-tertiary'} mt-0.5">
							per person
						</p>
					</div>

					<!-- Renting racket -->
					<div class="rounded-2xl p-3 {session.is_locked ? 'bg-white/10' : 'bg-bg'}">
						<p class="text-[10px] font-medium {session.is_locked ? 'text-white/50' : 'text-text-tertiary'} flex items-center gap-1.5 uppercase tracking-wider mb-1">
							<Zap size={12} class={session.is_locked ? 'text-white/50' : 'text-navy'} /> Rent Racket
						</p>
						<p class="text-lg sm:text-xl font-bold {session.is_locked ? 'text-white' : 'text-navy'} tracking-tight">
							{formatCurrency(costRentRacket)}
						</p>
						<p class="text-[10px] {session.is_locked ? 'text-white/40' : 'text-text-tertiary'} mt-0.5">
							per person
						</p>
					</div>
				</div>

				<!-- Simplified Breakdown -->
				<div class="pt-3 border-t {session.is_locked ? 'border-white/10' : 'border-border/50'} space-y-1.5">
					<div class="flex justify-between text-[10px] uppercase tracking-wider font-bold">
						<span class={session.is_locked ? 'text-white/40' : 'text-text-tertiary'}>
							Total Court Fees
						</span>
						<span class={session.is_locked ? 'text-white/60' : 'text-text-secondary'}>
							{formatCurrency(session.court_count * 77000)}
						</span>
					</div>
					<div class="flex justify-between text-[10px] uppercase tracking-wider font-bold">
						<span class={session.is_locked ? 'text-white/40' : 'text-text-tertiary'}>
							Total Racket Rental
						</span>
						<span class={session.is_locked ? 'text-white/60' : 'text-text-secondary'}>
							{formatCurrency(session.racket_count * 20000)}
						</span>
					</div>
					<div class="flex justify-between text-xs font-black pt-2 border-t {session.is_locked ? 'border-white/10' : 'border-border/30'}">
						<span class={session.is_locked ? 'text-white/50' : 'text-text-tertiary'}>
							GRAND TOTAL
						</span>
						<span class={session.is_locked ? 'text-white' : 'text-navy'}>
							{formatCurrency(totalCost)}
						</span>
					</div>
				</div>

				<!-- Info note -->
				{#if !session.is_locked}
					<div class="flex flex-col gap-2 mt-3 p-3 rounded-xl bg-navy/5">
						<div class="flex items-start gap-2">
							<div class="w-1.5 h-1.5 rounded-full bg-navy mt-1.5 flex-shrink-0"></div>
							<p class="text-[11px] text-text-secondary leading-relaxed">
								The more players join, the <strong>cheaper</strong> it gets per person!
							</p>
						</div>
						<div class="flex items-start gap-2 pt-2 border-t border-navy/10">
							<div class="w-1.5 h-1.5 rounded-full bg-navy mt-1.5 flex-shrink-0"></div>
							<p class="text-[11px] text-text-secondary leading-relaxed">
								Court fees are split <strong>equally among everyone</strong>. Racket fees only apply to <strong>those who rent</strong>.
							</p>
						</div>
					</div>
				{/if}
			</div>

			{#if session.is_locked}
				<div class="px-5 pb-5">
					<button
						onclick={() => openPayment(null, false)}
						class="w-full py-3.5 px-6 bg-white text-navy font-semibold text-sm rounded-2xl shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
					>
						<span class="flex items-center justify-center gap-2">
							<QrCode size={18} />
							Pay via QRIS
						</span>
					</button>
				</div>
			{/if}
		</div>

		<!-- RSVP Form (only if not locked and not ended) -->
		{#if !session.is_locked && !isSessionPassed(session)}
			<div class="bg-surface rounded-3xl border border-border/50 shadow-sm p-5 mb-5 animate-fade-in-up" style="animation-delay: 240ms">
				<div class="flex items-center justify-between mb-4">
					<h3 class="text-sm font-bold text-text-primary">Join this Session</h3>
					<span class="px-2 py-0.5 rounded-full bg-warning/10 text-warning text-[10px] font-bold">
						CONFIRM FIRST
					</span>
				</div>

				<p class="text-[11px] text-text-tertiary mb-4 leading-relaxed">
					Please confirm with the Admin/Group before RSVPing to ensure the court booking is synchronized.
				</p>

				<!-- Success Toast -->
				{#if justJoined}
					<div class="mb-4 p-3 rounded-2xl bg-success/10 border border-success/20 flex items-center gap-2 animate-scale-in">
						<CheckCircle size={16} class="text-success" />
						<span class="text-sm text-success font-medium">You've joined! 🎉</span>
					</div>
				{/if}

				<form onsubmit={(e) => { e.preventDefault(); handleJoin(); }} class="space-y-4">
					<!-- Name Input -->
					<div>
						<label for="player-name" class="block text-xs font-medium text-text-secondary mb-1.5">
							Your Name
						</label>
						<input
							id="player-name"
							type="text"
							bind:value={playerName}
							placeholder="Enter your name"
							class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
						/>
					</div>

					<!-- Racket Toggle -->
					<div class="flex flex-col gap-2 p-3 bg-bg rounded-2xl">
						<div class="flex items-center justify-between">
							<div>
								<p class="text-sm font-medium text-text-primary">Need a racket?</p>
								<p class="text-xs text-text-tertiary mt-0.5">Split rental Rp 20k/racket</p>
							</div>
							<button
								type="button"
								role="switch"
								aria-label="Toggle if you need a racket"
								aria-checked={needsRacket}
								onclick={() => (needsRacket = !needsRacket)}
								class="relative w-12 h-7 rounded-full transition-colors duration-200 {needsRacket ? 'bg-navy' : 'bg-text-tertiary/30'}"
							>
								<span
									class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 {needsRacket ? 'translate-x-5' : 'translate-x-0'}"
								></span>
							</button>
						</div>
						<div class="pt-2 border-t border-border/50">
							<p class="text-[10px] text-text-tertiary leading-relaxed italic">
								* Max 20 rackets available. 1 racket can be shared between 2-4 people for maximum efficiency.
							</p>
						</div>
					</div>

					<!-- Cost preview -->
					<div class="p-3 rounded-2xl bg-navy/5 text-center">
						<p class="text-[10px] text-text-tertiary uppercase tracking-wider font-medium">Your estimated cost</p>
						<p class="text-lg font-bold text-navy mt-0.5">
							{formatCurrency(calcPlayerCost(session, sessionParticipants, needsRacket))}
						</p>
					</div>

					<!-- Error message -->
					{#if formError}
						<p class="text-xs text-danger font-medium animate-scale-in">{formError}</p>
					{/if}

					<!-- Submit Button -->
					<button
						type="submit"
						class="w-full py-3.5 bg-navy text-white font-semibold text-sm rounded-2xl shadow-sm shadow-navy/20 hover:shadow-md hover:shadow-navy/30 transition-all active:scale-[0.98]"
					>
						Join Session
					</button>
				</form>

				<!-- Recovery Link -->
				<div class="mt-6 pt-5 border-t border-border/30">
					{#if !recoverTicketId && !recoverError}
						<button 
							onclick={() => (recoverTicketId = ' ')} 
							class="w-full text-center text-[10px] text-text-tertiary hover:text-navy transition-colors font-medium uppercase tracking-widest"
						>
							Already joined? Recover Access
						</button>
					{:else}
						<div class="space-y-3 animate-fade-in">
							<p class="text-[10px] font-bold text-text-secondary uppercase tracking-widest text-center">Enter your 6-digit Ticket ID</p>
							<div class="flex gap-2">
								<input 
									type="text" 
									bind:value={recoverTicketId}
									placeholder="e.g. XJ29S1"
									class="flex-1 px-4 py-2 bg-bg rounded-xl border border-border/50 text-sm font-mono text-center uppercase focus:ring-2 focus:ring-navy/20 focus:outline-none"
								/>
								<button 
									onclick={() => findAndClaimTicket(recoverTicketId)}
									class="px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl active:scale-95 transition-all"
								>
									Find
								</button>
							</div>
							{#if recoverError}
								<p class="text-[10px] text-danger font-bold text-center">{recoverError}</p>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		{/if}

		<!-- Participants List -->
		<section class="pb-8 animate-fade-in-up" style="animation-delay: 320ms">
			<h3 class="text-sm font-bold text-text-primary mb-3 flex items-center gap-2">
				<Users size={14} class="text-navy" />
				Players ({sessionParticipants.length})
			</h3>

			{#if sessionParticipants.length === 0}
				<div class="bg-surface rounded-3xl border border-border/50 p-8 text-center shadow-sm">
					<div class="w-12 h-12 rounded-2xl bg-bg flex items-center justify-center mx-auto mb-3">
						<Users size={20} class="text-text-tertiary" />
					</div>
					<p class="text-sm text-text-secondary">No players yet</p>
					<p class="text-xs text-text-tertiary mt-1">Be the first to join!</p>
				</div>
			{:else}
				<div class="bg-surface rounded-3xl border border-border/50 shadow-sm overflow-hidden divide-y divide-border/50">
					{#each sessionParticipants as participant (participant.id)}
						{@const playerCost = calcPlayerCost(session, sessionParticipants, participant?.needs_racket ?? false)}
						<div class="flex items-center gap-3 px-4 py-3.5">
							<!-- Avatar Circle -->
							<div class="w-9 h-9 rounded-full {participant?.needs_racket ? 'bg-navy/10' : 'bg-navy/5'} flex items-center justify-center flex-shrink-0">
								<span class="text-xs font-bold text-navy">
									{participant?.name?.charAt(0)?.toUpperCase() || '?'}
								</span>
							</div>

							<!-- Name & Info -->
							<div class="flex-1 min-w-0">
								<p class="text-sm font-medium text-text-primary truncate">{participant?.name || 'Unknown'}</p>
								<div class="flex items-center gap-2 mt-0.5">
									{#if participant?.needs_racket}
										<span class="text-[10px] text-navy/60 flex items-center gap-1"><Zap size={10} /> Rent racket</span>
									{:else}
										<span class="text-[10px] text-text-tertiary flex items-center gap-1"><Feather size={10} /> Own racket</span>
									{/if}
									<span class="text-[10px] text-text-tertiary font-medium">· {formatCurrency(playerCost)}</span>
								</div>
							</div>

							<!-- Payment Status -->
							{#if session?.is_locked}
								{#if participant?.has_paid}
									<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-success/10 text-success text-[11px] font-semibold">
										<Check size={12} />
										Paid
									</span>
								{:else}
									<button
										onclick={() => openPayment(participant?.id, participant?.needs_racket ?? false)}
										class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-danger/10 text-danger text-[11px] font-semibold hover:bg-danger/20 transition-colors active:scale-95"
									>
										<Clock size={12} />
										Unpaid
									</button>
								{/if}
							{:else}
								<span class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-navy/5 text-navy text-[11px] font-semibold">
									<Check size={12} />
									Joined
								</span>
							{/if}
						</div>
					{/each}
				</div>
			{/if}
		</section>
	</div>

	<!-- QRIS Payment Modal -->
	{#if showQrisModal}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm animate-fade-in"
			onclick={closeModal}
		></div>

		<div class="fixed inset-x-0 bottom-0 z-50 animate-slide-up">
			<div class="max-w-md mx-auto bg-surface rounded-t-3xl shadow-2xl">
				<!-- Handle bar -->
				<div class="flex justify-center pt-3 pb-2">
					<div class="w-10 h-1 rounded-full bg-text-tertiary/30"></div>
				</div>

				<div class="px-6 pb-8 pt-2">
					<!-- Close button -->
					<div class="flex items-center justify-between mb-5">
						<h3 class="text-lg font-bold text-text-primary">Pay via QRIS</h3>
						<button
							onclick={closeModal}
							class="w-8 h-8 rounded-full bg-bg flex items-center justify-center hover:bg-border/50 transition-colors"
						>
							<X size={16} class="text-text-secondary" />
						</button>
					</div>

					<!-- Amount -->
					<div class="text-center mb-6">
						<p class="text-xs text-text-secondary uppercase tracking-wider font-medium mb-1">Amount Due</p>
						<p class="text-3xl font-bold text-text-primary">{formatCurrency(modalCost)}</p>
					</div>

					<div class="bg-bg rounded-2xl border border-border/50 p-6 text-center mb-6">
						{#if db.settings?.qris_url}
							<!-- Dynamic QRIS -->
							<div class="aspect-square bg-white rounded-2xl flex flex-col items-center justify-center p-4 border border-border/50 mb-4 shadow-inner overflow-hidden">
								<img src={db.settings.qris_url} alt="QRIS Code" class="w-full h-full object-contain" />
							</div>
							<p class="text-[10px] text-text-secondary text-center uppercase tracking-widest font-bold mb-4">
								Scan QRIS to Pay
							</p>
						{:else}
							<!-- Fallback Message -->
							<div class="aspect-square bg-white rounded-2xl flex flex-col items-center justify-center p-8 border border-border/50 mb-4 shadow-inner">
								<QrCode size={48} class="text-navy/20 mb-3" />
								<p class="text-[11px] text-text-secondary text-center font-medium leading-relaxed">
									QRIS image pending.<br/>
									Please <strong>transfer via GoPay</strong> directly to <strong>Zulkifli</strong>'s WhatsApp number.
								</p>
							</div>
						{/if}

						<!-- Upload Proof Section -->
						<div class="pt-4 border-t border-border/50">
							<p class="text-[10px] font-bold text-text-secondary uppercase tracking-widest mb-3">Upload Transfer Proof</p>
							
							{#if proofSuccess}
								<div class="p-3 bg-success/10 rounded-xl flex items-center justify-center gap-2 animate-scale-in">
									<CheckCircle size={16} class="text-success" />
									<p class="text-[11px] font-bold text-success capitalize">Proof uploaded! Waiting for admin.</p>
								</div>
							{:else}
								<label class="relative flex items-center justify-center gap-2 w-full p-3 bg-surface border-2 border-dashed border-border rounded-xl cursor-pointer hover:border-navy/30 transition-colors group">
									<input type="file" accept="image/*" class="hidden" onchange={handleProofUpload} disabled={isUploadingProof} />
									{#if isUploadingProof}
										<div class="w-4 h-4 border-2 border-navy/30 border-t-navy rounded-full animate-spin"></div>
										<span class="text-xs font-semibold text-text-secondary">Uploading...</span>
									{:else}
										<Upload size={16} class="text-text-tertiary group-hover:text-navy transition-colors" />
										<span class="text-xs font-semibold text-text-secondary">Choose Screenshot</span>
									{/if}
								</label>
							{/if}
						</div>
					</div>

					<button
						onclick={closeModal}
						class="w-full py-3.5 bg-navy text-white font-bold text-sm rounded-2xl shadow-lg shadow-navy/20 active:scale-95 transition-all"
					>
						Done
					</button>
				</div>
			</div>
		</div>
	{/if}

	<!-- Digital Pass / Receipt Backdrop -->
	{#if showReceipt && myRegistration && myRegistration.has_paid}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 z-[100] bg-black/80 backdrop-blur-xl animate-fade-in flex items-center justify-center p-6"
			onclick={() => (showReceipt = false)}
		>
			<div class="w-full max-w-sm bg-white rounded-[2rem] overflow-hidden shadow-2xl animate-scale-in flex flex-col items-stretch">
				<!-- Top: Pass Header -->
				<div class="bg-navy p-6 text-center relative overflow-hidden">
					<div class="absolute -top-10 -right-10 w-24 h-24 bg-white/10 blur-2xl rounded-full"></div>
					<p class="text-white/50 text-[10px] font-bold uppercase tracking-[0.2em] mb-1">Official Member Pass</p>
					<h2 class="text-white text-xl font-bold tracking-tight">Badminton IL Batam</h2>
				</div>

				<!-- Middle: Pass Info -->
				<div class="p-8 flex flex-col items-center border-b-2 border-dashed border-border/50 relative">
					<!-- Punch holes for effect -->
					<div class="absolute -left-3 -bottom-3 w-6 h-6 bg-black rounded-full"></div>
					<div class="absolute -right-3 -bottom-3 w-6 h-6 bg-black rounded-full"></div>

					<div class="w-20 h-20 rounded-full bg-navy/5 flex items-center justify-center mb-4 border border-navy/10">
						<span class="text-3xl font-black text-navy">{myRegistration.name.charAt(0).toUpperCase()}</span>
					</div>

					<h3 class="text-2xl font-black text-text-primary mb-1">{myRegistration.name}</h3>
					<div class="px-4 py-1.5 bg-success text-white text-[10px] font-black rounded-full uppercase tracking-widest shadow-lg shadow-success/20 mb-8">
						Verified & Paid
					</div>

					<div class="grid grid-cols-2 gap-x-12 gap-y-6 w-full text-center">
						<div>
							<p class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Session</p>
							<p class="text-xs font-bold text-text-primary leading-tight">{session.title}</p>
						</div>
						<div>
							<p class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Status</p>
							<p class="text-xs font-bold text-text-primary">Player</p>
						</div>
						<div>
							<p class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Date</p>
							<p class="text-xs font-bold text-text-primary">{formatDate(session.date).split(',')[0]}</p>
						</div>
						<div>
							<p class="text-[9px] font-bold text-text-tertiary uppercase tracking-widest mb-1">Amount</p>
							<p class="text-xs font-bold text-text-primary">{formatCurrency(calcPlayerCost(session, sessionParticipants, myRegistration.needs_racket) + myRegistration.unique_code)}</p>
						</div>
					</div>
				</div>

				<!-- Bottom: QR/Barcode vibe -->
				<div class="p-8 flex flex-col items-center">
					<div class="w-full h-12 flex gap-1 mb-3 opacity-30">
						{#each Array(40) as _}
							<div class="flex-1 bg-black rounded-full" style="height: {Math.random() * 100}%"></div>
						{/each}
					</div>
					<p class="text-[9px] font-mono text-text-tertiary uppercase tracking-widest">#{myRegistration?.id?.slice(0, 18).toUpperCase()}</p>
					
					<button 
						onclick={() => (showReceipt = false)}
						class="mt-8 text-text-tertiary hover:text-navy transition-colors text-xs font-bold"
					>
						Tap anywhere to close
					</button>
				</div>
			</div>
		</div>
	{/if}
{/if}
