<script>
	import { onMount } from 'svelte';
	import {
		getParticipants,
		createSession,
		toggleLock,
		togglePaid,
		removeParticipant,
		appConfig,
		calcPlayerCost,
		calcTotalCost,
		calcCourtShare,
		calcRacketShare,
		db,
		uploadGalleryImages,
		deleteGalleryImage,
		updateQRIS,
		deleteSession,
		isSessionPassed,
		getCommunityStats,
		triggerConfetti,
		triggerHaptic,
		toggleTheme
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
		LogOut,
		Image as ImageIcon,
		Upload,
		QrCode,
		Sun,
		Moon
	} from 'lucide-svelte';

	import { enhance } from '$app/forms';

	// ── Create Session Form ───────────────────────────────────────
	let newTitle = $state('');
	let newDate = $state(new Date().toISOString().split('T')[0]);
	let newTime = $state('19:00'); // Default 7 PM
	let newEndTime = $state('21:00'); // Default 2 hours later
	let newSubtitle = $state('Mixed Levels');
	let newCourts = $state(1);
	let newRackets = $state(0);
	let formError = $state('');
	let showCreateForm = $state(false);
	let isUploadingQRIS = $state(false);
	let qrisSuccess = $state(false);
	let qrisPreview = $state(null); // Local preview

	// ── Gallery State ─────────────────────────────────────────────
	let isUploading = $state(false);
	let galleryFileRef;
	let localPreviews = $state([]); // Previews for images being uploaded
	let selectedVerification = $state(null); // participant object
	let verificationSession = $state(null);  // current session
	let verificationCost = $state(0);

	function openVerification(participant, session, cost) {
		selectedVerification = participant;
		verificationSession = session;
		verificationCost = cost;
	}

	function closeVerification() {
		selectedVerification = null;
		verificationSession = null;
		verificationCost = 0;
	}

	async function handleVerifyPayment() {
		if (selectedVerification && !selectedVerification.has_paid) {
			triggerHaptic('success');
			await togglePaid(selectedVerification.id);
			selectedVerification.has_paid = true;
			triggerConfetti();
		}
		closeVerification();
	}

	async function handleQRISUpload(e) {
		const file = e.target.files[0];
		if (!file) return;

		// Local preview immediately
		qrisPreview = URL.createObjectURL(file);
		
		isUploadingQRIS = true;
		qrisSuccess = false;
		try {
			await updateQRIS(file);
			qrisSuccess = true;
			setTimeout(() => { qrisSuccess = false; qrisPreview = null; }, 3000);
		} catch (err) {
			console.error('QRIS upload failed:', err);
			alert('Failed to upload QRIS. Check console.');
			qrisPreview = null;
		} finally {
			isUploadingQRIS = false;
		}
	}

	// ── Maps Config ───────────────────────────────────────────────
	let showMapsConfig = $state(false);
	let mapsUrlInput = $state('');

	function openMapsConfig() {
		mapsUrlInput = appConfig.maps_embed_url;
		showMapsConfig = true;
	}

	function saveMapsUrl() {
		const trimmedInput = mapsUrlInput.trim();
		
		// Cek jika input adalah tag <iframe>
		const iframeMatch = trimmedInput.match(/src="([^"]+)"/);
		// Cek jika input adalah koordinat (Lat, Long)
		const coordMatch = trimmedInput.match(/^(-?\d+\.\d+)\s*,\s*(-?\d+\.\d+)$/);

		if (iframeMatch && iframeMatch[1]) {
			appConfig.maps_embed_url = iframeMatch[1];
		} else if (coordMatch) {
			const lat = coordMatch[1];
			const lng = coordMatch[2];
			// Buat URL embed dari koordinat
			appConfig.maps_embed_url = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
		} else {
			// Jika input adalah link biasa
			appConfig.maps_embed_url = trimmedInput;
		}
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
		
		const finalTime = newEndTime ? `${newTime} - ${newEndTime}` : newTime;
		
		await createSession(newTitle.trim(), newDate, finalTime, newSubtitle, newCourts, newRackets);
		
		newTitle = '';
		newDate = new Date().toISOString().split('T')[0];
		newTime = '19:00';
		newEndTime = '21:00';
		newSubtitle = 'Mixed Levels';
		newCourts = 1;
		newRackets = 0;
		formError = '';
		showCreateForm = false;
	}

	function toggleExpand(id) {
		expandedSessionId = expandedSessionId === id ? null : id;
	}



	async function handleUpload(e) {
		const files = Array.from(e.target.files);
		if (!files || files.length === 0) return;

		// Create local previews
		localPreviews = files.map(f => URL.createObjectURL(f));
		
		isUploading = true;
		try {
			await uploadGalleryImages(files);
			// Reset
			e.target.value = '';
			localPreviews = [];
		} catch (err) {
			console.error('Upload failed:', err);
			localPreviews = [];
		} finally {
			isUploading = false;
		}
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
				<div class="flex items-center gap-3">
					<button 
						onclick={toggleTheme}
						class="w-10 h-10 rounded-xl bg-surface border border-border/50 flex items-center justify-center text-text-primary shadow-sm hover:shadow-md transition-all active:scale-95"
					>
						{#if db.theme === 'dark'}
							<Sun size={18} />
						{:else}
							<Moon size={18} />
						{/if}
					</button>

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
			</div>
		</header>

		<!-- Community Insights / Stats -->
		{#if db.isReady}
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8 animate-fade-in-up" style="animation-delay: 100ms">
			<div class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm">
				<p class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1">Total Revenue</p>
				<p class="text-lg font-black text-success leading-tight">{formatCurrency(getCommunityStats().totalRevenue)}</p>
			</div>
			<div class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm">
				<p class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1">Total RSVP</p>
				<p class="text-lg font-black text-text-primary leading-tight">{getCommunityStats().totalPlayers}</p>
			</div>
			<div class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm">
				<p class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1">Unique Players</p>
				<p class="text-lg font-black text-text-primary leading-tight">{getCommunityStats().uniquePlayers}</p>
			</div>
			<div class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm">
				<p class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1">Active Sessions</p>
				<p class="text-lg font-black text-navy leading-tight">{getCommunityStats().activeSessions}</p>
			</div>
		</div>
		{:else}
		<div class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
			{#each Array(4) as _}
			<div class="bg-surface rounded-2xl p-4 border border-border/50 h-20 skeleton"></div>
			{/each}
		</div>
		{/if}

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
					</div>

					<div class="grid grid-cols-2 gap-3">
						<div>
							<label for="session-time" class="block text-xs font-medium text-text-secondary mb-1.5">Starting Time</label>
							<input
								id="session-time"
								type="time"
								bind:value={newTime}
								class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
							/>
						</div>
						<div>
							<label for="session-end-time" class="block text-xs font-medium text-text-secondary mb-1.5">Ending Time</label>
							<input
								id="session-end-time"
								type="time"
								bind:value={newEndTime}
								class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
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

		<!-- Settings & QRIS Module -->
		<div class="bg-surface rounded-3xl border border-border/50 p-6 shadow-sm mt-5 overflow-hidden relative">
			{#if isUploadingQRIS}
				<div class="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center animate-fade-in">
					<div class="w-8 h-8 border-4 border-navy border-t-white rounded-full animate-spin mb-2"></div>
					<p class="text-[10px] font-black text-navy uppercase tracking-widest">Updating QRIS...</p>
				</div>
			{/if}

			<div class="flex items-center gap-3 mb-6">
				<div class="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center text-navy">
					<QrCode size={20} />
				</div>
				<div>
					<h3 class="text-sm font-bold text-text-primary">Payment Settings</h3>
					<p class="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold">QRIS & Global Config</p>
				</div>
			</div>

			<div class="space-y-4">
				<div class="flex items-center gap-4 p-4 bg-bg rounded-2xl border border-border/50 group">
					<div class="w-20 h-20 bg-white rounded-xl border border-border/50 flex items-center justify-center overflow-hidden shadow-inner relative">
						{#if qrisPreview}
							<img src={qrisPreview} alt="Preview" class="w-full h-full object-contain animate-pulse" />
						{:else if db.settings?.qris_url}
							<img src={db.settings.qris_url} alt="QRIS" class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500" />
						{:else}
							<QrCode size={24} class="text-text-tertiary/20" />
						{/if}
					</div>
					<div class="flex-1">
						<p class="text-xs font-bold text-text-primary mb-1">Active QRIS Code</p>
						<p class="text-[10px] text-text-secondary leading-relaxed uppercase tracking-tight font-medium">
							This code is displayed on all participant checkout pages.
						</p>
					</div>
				</div>

				<label class="relative flex items-center justify-center gap-2 py-4 bg-navy text-white text-xs font-black rounded-2xl cursor-pointer hover:bg-navy-dark transition-all active:scale-[0.98] shadow-lg shadow-navy/20 overflow-hidden group">
					<input type="file" accept="image/*" class="hidden" onchange={handleQRISUpload} disabled={isUploadingQRIS} />
					<div class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"></div>
					
					{#if qrisSuccess}
						<Check size={16} strokeWidth={3} class="animate-bounce" />
						<span>SUCCESSFULLY UPDATED</span>
					{:else}
						<Upload size={16} strokeWidth={3} />
						<span>UPDATE QRIS IMAGE</span>
					{/if}
				</label>
			</div>
		</div>

		<!-- Gallery Management Section -->
		<section class="mb-10 animate-fade-in-up" style="animation-delay: 50ms">
			<div class="flex items-center justify-between mb-4 mt-4">
				<h2 class="text-sm font-bold text-text-primary flex items-center gap-2">
					<ImageIcon size={14} class="text-navy" />
					Gallery Photos ({db.gallery.length})
				</h2>
				<button
					onclick={() => galleryFileRef.click()}
					disabled={isUploading}
					class="flex items-center gap-2 px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy/90 transition-all active:scale-95 disabled:opacity-50"
				>
					{#if isUploading}
						<div class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
						Uploading...
					{:else}
						<Upload size={14} />
						Upload Photos
					{/if}
				</button>
				<input
					type="file"
					multiple
					accept="image/*"
					bind:this={galleryFileRef}
					onchange={handleUpload}
					class="hidden"
				/>
			</div>

			{#if db.gallery.length === 0 && localPreviews.length === 0}
				<div class="bg-surface rounded-3xl border border-border/50 p-8 text-center shadow-sm">
					<div class="w-12 h-12 rounded-2xl bg-bg flex items-center justify-center mx-auto mb-3">
						<ImageIcon size={20} class="text-text-tertiary" />
					</div>
					<p class="text-sm text-text-secondary font-bold">No gallery photos yet</p>
					<p class="text-[10px] text-text-tertiary mt-1 uppercase tracking-widest">Upload community memories</p>
				</div>
			{:else}
				<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
					<!-- Existing Photos -->
					{#each db.gallery as photo (photo.id)}
						<div class="relative group aspect-square rounded-2xl overflow-hidden bg-bg border border-border/50 shadow-sm animate-scale-in">
							<img 
								src={photo.url} 
								alt="Gallery" 
								class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" 
								onerror={(e) => { 
									// Optional: try to append another cache buster on first fail
									if (!e.currentTarget.dataset.retried) {
										e.currentTarget.dataset.retried = "true";
										e.currentTarget.src = photo.url + '&retry=' + Date.now();
									} else {
										e.currentTarget.src = 'https://placehold.co/400x400/f3f4f6/a1a1aa?text=Error'; 
									}
								}}
							/>
							<div class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
								<button
									onclick={() => deleteGalleryImage(photo.id, photo.url)}
									class="w-8 h-8 bg-danger text-white rounded-xl flex items-center justify-center shadow-lg active:scale-90 hover:bg-danger-dark transition-all"
								>
									<Trash2 size={14} />
								</button>
							</div>
						</div>
					{/each}

					<!-- Incoming Previews (while uploading) -->
					{#each localPreviews as preview}
						<div class="relative aspect-square rounded-2xl overflow-hidden bg-bg border border-border/50 shadow-sm animate-pulse">
							<img src={preview} alt="Loading..." class="w-full h-full object-cover opacity-50 grayscale" />
							<div class="absolute inset-0 flex items-center justify-center">
								<div class="w-6 h-6 border-2 border-navy border-t-white rounded-full animate-spin"></div>
							</div>
						</div>
					{/each}
				</div>
			{/if}

		</section>

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
										{#if isSessionPassed(session)}
											<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-text-tertiary/10 text-text-tertiary text-[9px] font-bold">
												✓ ENDED
											</span>
										{:else if session.is_locked}
											<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-[9px] font-bold">
												<Lock size={8} />
												LOCKED
											</span>
										{/if}
									</div>
									<div class="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-tertiary mt-1">
										<span class="flex items-center gap-1">
											<Calendar size={11} />
											{formatDate(session.date)} · {session.time}
										</span>
										<span class="flex items-center gap-1">
											<Users size={11} />
											{sessionParticipants.length} ({renters} rent)
										</span>
									</div>
									<div class="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-[10px] text-text-tertiary">
										<span>{session.court_count} court{session.court_count > 1 ? 's' : ''}</span>
										<span>·</span>
										<span>{session.racket_count} racket{session.racket_count > 1 ? 's' : ''}</span>
										<span>·</span>
										<span class="font-medium text-navy/70">{formatCurrency(total)}</span>
									</div>
								</div>

								<!-- Actions -->
								<div class="flex items-center gap-2">
									<button
										onclick={async () => { if (confirm(`Delete "${session.title}"? This will also remove all participants. This cannot be undone.`)) { await deleteSession(session.id); } }}
										class="w-9 h-9 rounded-xl bg-danger/5 flex items-center justify-center text-danger hover:bg-danger/10 transition-all active:scale-90"
										title="Delete Session"
									>
										<Trash2 size={16} />
									</button>

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
												<div class="w-8 h-8 rounded-full {participant?.needs_racket ? 'bg-navy/10' : 'bg-navy/5'} flex items-center justify-center flex-shrink-0">
													<span class="text-xs font-bold text-navy">
														{participant?.name?.charAt(0)?.toUpperCase() || '?'}
													</span>
												</div>

												<!-- Name & Proof -->
												<div class="flex-1 min-w-0">
													<div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
														<p class="text-sm font-medium text-text-primary truncate max-w-[100px] sm:max-w-none">{participant?.name || 'Unknown'}</p>
														{#if participant?.payment_proof_url}
															<button 
																onclick={() => openVerification(participant, session, cost)}
																class="flex items-center gap-1 px-1.5 py-0.5 bg-navy/5 text-navy text-[9px] font-bold rounded-lg hover:bg-navy/10 transition-colors border border-navy/10 whitespace-nowrap"
															>
																<ImageIcon size={10} />
																<span class="hidden xs:inline">Review</span> Proof
															</button>
														{/if}
													</div>
													<div class="flex items-center gap-2 mt-0.5">
														{#if participant?.needs_racket}
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

	<!-- Payment Verification Modal -->
	{#if selectedVerification}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end sm:justify-center p-4">
			<div class="bg-surface w-full max-w-md mx-auto rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in" onclick={(e) => e.stopPropagation()}>
				<!-- Header -->
				<div class="p-4 border-b border-border/50 flex justify-between items-center bg-bg/50">
					<h3 class="font-bold text-text-primary flex items-center gap-2">
						Payment Verification
					</h3>
					<button onclick={closeVerification} class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border/50 shadow-sm text-text-secondary hover:text-text-primary transition-colors">
						<Plus size={16} class="rotate-45" />
					</button>
				</div>

				<!-- Content -->
				<div class="p-5 overflow-y-auto max-h-[70vh]">
					<div class="aspect-[3/4] bg-bg rounded-2xl border border-border/50 overflow-hidden mb-5">
						<img 
							src={selectedVerification.payment_proof_url} 
							alt="Payment Proof" 
							class="w-full h-full object-contain"
							onerror={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = 'https://placehold.co/600x800/f3f4f6/a1a1aa?text=Image+Not+Found+(404)'; }}
						/>
					</div>
					
					<div class="bg-bg rounded-2xl p-4 border border-border/50 space-y-3">
						<div class="flex justify-between items-center">
							<span class="text-xs text-text-secondary">Participant</span>
							<span class="text-sm font-bold text-text-primary">{selectedVerification?.name || 'Unknown'}</span>
						</div>
						<div class="flex justify-between items-center">
							<span class="text-xs text-text-secondary">Expected Amount</span>
							<span class="text-base font-black text-navy">{formatCurrency(verificationCost)}</span>
						</div>
						<div class="pt-3 mt-3 border-t border-border/50 flex justify-between items-center flex-wrap gap-2">
							<span class="px-2.5 py-1 rounded-md bg-white border border-border/50 text-[10px] font-bold text-text-secondary">
								{selectedVerification.needs_racket ? '🎾 Racket Rent (+20K)' : '🏸 Own Racket'}
							</span>
							<span class="px-2.5 py-1 rounded-md bg-white border border-border/50 text-[10px] font-bold text-text-secondary">
								Status: {selectedVerification.has_paid ? 'PAID' : 'PENDING'}
							</span>
						</div>
					</div>
				</div>

				<!-- Actions -->
				<div class="p-4 bg-bg/50 border-t border-border/50 grid grid-cols-2 gap-3">
					<button 
						onclick={async () => { await togglePaid(selectedVerification.id); selectedVerification.has_paid = !selectedVerification.has_paid; }}
						class="py-3 rounded-2xl font-bold text-sm transition-all shadow-sm {selectedVerification.has_paid ? 'bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white' : 'bg-surface text-text-primary border border-border hover:bg-bg'}"
					>
						{selectedVerification.has_paid ? 'Revoke Payment' : 'Reject / Ignore'}
					</button>
					<button 
						onclick={handleVerifyPayment}
						class="py-3 rounded-2xl font-bold text-sm bg-navy text-white transition-all shadow-md active:scale-95 hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
						disabled={selectedVerification.has_paid}
					>
						{selectedVerification.has_paid ? 'Already Verified' : 'Verify & Approve'}
					</button>
				</div>
			</div>
		</div>
	{/if}
