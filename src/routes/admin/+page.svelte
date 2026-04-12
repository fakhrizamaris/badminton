<script>
	import { onMount } from 'svelte';
	import {
		sessions,
		getParticipants,
		createSession,
		toggleLock,
		togglePaid,
		removeParticipant,
		appConfig,
		calcPlayerCost,
		calcTotalCost,
		db
	} from '$lib/data/store.svelte.js';
	import {
		Plus,
		Lock,
		Unlock,
		Trash2,
		Users,
		ChevronDown,
		ChevronUp,
		Check,
		X,
		Calendar,
		CircleDollarSign,
		Shield,
		Map,
		LogOut
	} from 'lucide-svelte';

	import { enhance } from '$app/forms';

	// ── Create Session Form ───────────────────────────────────────
	let newTitle = $state('');
	let newDate = $state('');
	let newTime = $state('7PM');
	let newSubtitle = $state('Mixed Levels');
	let newCourts = $state(1);
	let newRackets = $state(0);
	let formError = $state('');
	let showCreateForm = $state(false);

	// ── Maps Config ───────────────────────────────────────────────
	let showMapsConfig = $state(false);
	let mapsUrlInput = $state('');

	function openMapsConfig() {
		mapsUrlInput = appConfig.maps_embed_url;
		showMapsConfig = true;
	}

	function saveMapsUrl() {
		appConfig.maps_embed_url = mapsUrlInput;
		showMapsConfig = false;
	}

	// ── Expanded session ──────────────────────────────────────────
	let expandedSessionId = $state(null);

	function formatCurrency(amount) {
		return new Intl.NumberFormat('id-ID', {
			style: 'currency',
			currency: 'IDR',
			minimumFractionDigits: 0,
			maximumFractionDigits: 0
		}).format(amount);
	}

	function formatDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			day: 'numeric',
			month: 'short'
		});
	}

	async function handleCreate() {
		if (!newTitle.trim()) {
			formError = 'Title is required';
			return;
		}
		if (!newDate) {
			formError = 'Date is required';
			return;
		}
		await createSession(newTitle.trim(), newDate, newTime, newSubtitle, newCourts, newRackets);
		newTitle = '';
		newDate = '';
		newTime = '7PM';
		newSubtitle = 'Mixed Levels';
		newCourts = 1;
		newRackets = 0;
		formError = '';
		showCreateForm = false;
	}

	function toggleExpand(id) {
		expandedSessionId = expandedSessionId === id ? null : id;
	}
</script>

<svelte:head>
	<title>Admin Dashboard — Badminton Split-Bill</title>
</svelte:head>

	<!-- Authenticated Admin Dashboard -->
	<div class="max-w-4xl mx-auto px-5">

		<!-- Header -->
		<header class="pt-8 pb-5 animate-fade-in">
			<div class="flex items-center justify-between">
				<div>
					<h1 class="text-2xl font-bold text-text-primary">Admin Dashboard</h1>
					<p class="text-sm text-text-secondary mt-1">Manage sessions & participants</p>
				</div>
				<form method="POST" action="/admin/login?/logout" use:enhance>
					<button
						type="submit"
						class="w-10 h-10 rounded-xl bg-danger/5 flex items-center justify-center text-danger hover:bg-danger/10 transition-all active:scale-95"
						title="Logout"
					>
						<LogOut size={18} />
					</button>
				</form>
			</div>
		</header>

		<!-- Action Buttons -->
		<div class="grid grid-cols-2 gap-3 mb-5 animate-fade-in-up">
			<button
				onclick={() => (showCreateForm = !showCreateForm)}
				class="py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 {showCreateForm ? 'bg-text-tertiary/10 text-text-secondary' : 'bg-navy text-white shadow-sm shadow-navy/20'}"
			>
				{#if showCreateForm}
					<X size={16} />
					Cancel
				{:else}
					<Plus size={16} />
					New Session
				{/if}
			</button>

			<button
				onclick={openMapsConfig}
				class="py-3 bg-surface border border-border/50 rounded-2xl text-sm font-semibold text-text-primary shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 hover:shadow-md"
			>
				<Map size={16} />
				Edit Maps
			</button>
		</div>

		<!-- Create Session Form -->
		{#if showCreateForm}
			<div class="bg-surface rounded-3xl border border-border/50 shadow-sm p-5 mb-5 animate-scale-in">
				<h3 class="text-sm font-bold text-text-primary mb-4">New Session</h3>

				<form onsubmit={(e) => { e.preventDefault(); handleCreate(); }} class="space-y-4">
					<div>
						<label for="session-title" class="block text-xs font-medium text-text-secondary mb-1.5">Title</label>
						<input
							id="session-title"
							type="text"
							bind:value={newTitle}
							placeholder="e.g. Friday Night Smash 🏸"
							class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
						/>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="session-date" class="block text-xs font-medium text-text-secondary mb-1.5">Date</label>
							<input
								id="session-date"
								type="date"
								bind:value={newDate}
								class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
							/>
						</div>
						<div>
							<label for="session-time" class="block text-xs font-medium text-text-secondary mb-1.5">Time</label>
							<input
								id="session-time"
								type="text"
								bind:value={newTime}
								placeholder="e.g. 7PM"
								class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
							/>
						</div>
					</div>

					<div>
						<label for="session-subtitle" class="block text-xs font-medium text-text-secondary mb-1.5">Subtitle</label>
						<input
							id="session-subtitle"
							type="text"
							bind:value={newSubtitle}
							placeholder="e.g. Mixed Levels"
							class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
						/>
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="court-count" class="block text-xs font-medium text-text-secondary mb-1.5">
								Courts (× Rp 77K)
							</label>
							<input
								id="court-count"
								type="number"
								min="1"
								max="10"
								bind:value={newCourts}
								class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
							/>
						</div>
						<div>
							<label for="racket-count" class="block text-xs font-medium text-text-secondary mb-1.5">
								Rackets (× Rp 20K)
							</label>
							<input
								id="racket-count"
								type="number"
								min="0"
								max="20"
								bind:value={newRackets}
								class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
							/>
						</div>
					</div>

					{#if formError}
						<p class="text-xs text-danger font-medium animate-scale-in">{formError}</p>
					{/if}

					<button
						type="submit"
						class="w-full py-3.5 bg-navy text-white font-semibold text-sm rounded-2xl shadow-sm shadow-navy/20 hover:shadow-md transition-all active:scale-[0.98]"
					>
						Create Session
					</button>
				</form>
			</div>
		{/if}

		<!-- Maps URL Config Modal -->
		{#if showMapsConfig}
			<div class="bg-surface rounded-3xl border border-border/50 shadow-sm p-5 mb-5 animate-scale-in">
				<h3 class="text-sm font-bold text-text-primary mb-4">Google Maps Embed URL</h3>
				<textarea
					bind:value={mapsUrlInput}
					rows="3"
					placeholder="Paste your Google Maps embed URL here"
					class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all resize-none"
				></textarea>
				<div class="grid grid-cols-2 gap-3 mt-3">
					<button
						onclick={() => (showMapsConfig = false)}
						class="py-2.5 bg-bg rounded-2xl text-sm font-medium text-text-secondary hover:bg-border/30 transition-all"
					>
						Cancel
					</button>
					<button
						onclick={saveMapsUrl}
						class="py-2.5 bg-navy text-white rounded-2xl text-sm font-semibold shadow-sm hover:shadow-md transition-all"
					>
						Save URL
					</button>
				</div>
			</div>
		{/if}

		<!-- Sessions List -->
		<section class="pb-8">
			<h2 class="text-sm font-bold text-text-primary mb-3 animate-fade-in-up" style="animation-delay: 100ms">
				All Sessions ({db.sessions.length})
			</h2>

			{#if !db.isReady}
				<div class="py-10 text-center animate-pulse">
					<div class="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
					<p class="text-sm font-medium text-text-secondary">Loading admin data...</p>
				</div>
			{:else}
				<div class="space-y-3 stagger">
					{#each db.sessions as session (session.id)}
						{@const sessionParticipants = getParticipants(session.id)}
					{@const total = calcTotalCost(session)}
					{@const renters = sessionParticipants.filter(p => p.needs_racket).length}
					{@const isExpanded = expandedSessionId === session.id}

					<div class="bg-surface rounded-3xl border border-border/50 shadow-sm overflow-hidden animate-fade-in-up">
						<!-- Session Header -->
						<div class="p-4">
							<div class="flex items-center gap-3">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<h3 class="text-sm font-semibold text-text-primary truncate">{session.title}</h3>
										{#if session.is_locked}
											<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-[9px] font-bold">
												<Lock size={8} />
												LOCKED
											</span>
										{/if}
									</div>
									<div class="flex items-center gap-3 text-xs text-text-tertiary">
										<span class="flex items-center gap-1">
											<Calendar size={11} />
											{formatDate(session.date)} · {session.time}
										</span>
										<span class="flex items-center gap-1">
											<Users size={11} />
											{sessionParticipants.length} ({renters} rent)
										</span>
									</div>
									<div class="flex items-center gap-3 mt-1 text-[10px] text-text-tertiary">
										<span>{session.court_count} court{session.court_count > 1 ? 's' : ''}</span>
										<span>·</span>
										<span>{session.racket_count} racket{session.racket_count > 1 ? 's' : ''}</span>
										<span>·</span>
										<span class="font-medium">{formatCurrency(total)}</span>
									</div>
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-2">
									<button
										onclick={async () => await toggleLock(session.id)}
										class="w-9 h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 {session.is_locked ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'}"
										title={session.is_locked ? 'Unlock Session' : 'Lock Session'}
									>
										{#if session.is_locked}
											<Unlock size={16} />
										{:else}
											<Lock size={16} />
										{/if}
									</button>

									<button
										onclick={() => toggleExpand(session.id)}
										class="w-9 h-9 rounded-xl bg-bg flex items-center justify-center transition-all active:scale-90 text-text-secondary"
									>
										{#if isExpanded}
											<ChevronUp size={16} />
										{:else}
											<ChevronDown size={16} />
										{/if}
									</button>
								</div>
							</div>
						</div>

						<!-- Expanded Participant List -->
						{#if isExpanded}
							<div class="border-t border-border/50">
								{#if sessionParticipants.length === 0}
									<div class="p-4 text-center">
										<p class="text-xs text-text-tertiary">No participants yet</p>
									</div>
								{:else}
									<div class="divide-y divide-border/50">
										{#each sessionParticipants as participant (participant.id)}
											{@const cost = calcPlayerCost(session, sessionParticipants, participant.needs_racket)}
											<div class="flex items-center gap-3 px-4 py-3">
												<!-- Avatar -->
												<div class="w-8 h-8 rounded-full {participant.needs_racket ? 'bg-navy/10' : 'bg-navy/5'} flex items-center justify-center flex-shrink-0">
													<span class="text-xs font-bold text-navy">
														{participant.name.charAt(0).toUpperCase()}
													</span>
												</div>

												<!-- Name -->
												<div class="flex-1 min-w-0">
													<p class="text-sm font-medium text-text-primary truncate">{participant.name}</p>
													<div class="flex items-center gap-2 mt-0.5">
														{#if participant.needs_racket}
															<span class="text-[10px] text-navy/60">🎾 Rent</span>
														{:else}
															<span class="text-[10px] text-text-tertiary">🏸 Own</span>
														{/if}
														<span class="text-[10px] text-text-tertiary font-medium">{formatCurrency(cost)}</span>
													</div>
												</div>

												<!-- Paid Toggle -->
												<button
													onclick={async () => await togglePaid(participant.id)}
													class="flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-semibold transition-all active:scale-95 {participant.has_paid ? 'bg-success/10 text-success' : 'bg-danger/10 text-danger'}"
												>
													{#if participant.has_paid}
														<Check size={12} />
														Paid
													{:else}
														<X size={12} />
														Unpaid
													{/if}
												</button>

												<!-- Remove -->
												<button
													onclick={async () => await removeParticipant(participant.id)}
													class="w-8 h-8 rounded-xl bg-danger/5 flex items-center justify-center text-danger hover:bg-danger/10 transition-all active:scale-90"
													title="Remove participant"
												>
													<Trash2 size={14} />
												</button>
											</div>
										{/each}
									</div>
								{/if}
							</div>
						{/if}
					</div>
				{/each}
			</div>
			{/if}
		</section>
	</div>
