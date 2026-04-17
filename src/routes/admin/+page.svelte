<script>
	import { onMount } from "svelte";
	import {
		getParticipants,
		createSession,
		toggleLock,
		togglePaid,
		removeParticipant,
		appConfig,
		calcPlayerCost,
		calcTotalCost,
		db,
		uploadGalleryImages,
		deleteGalleryImage,
		updateQRIS,
		deleteSession,
		toggleSessionShuttlecock,
		updateSessionConfig,
		isSessionPassed,
		getCommunityStats,
		triggerConfetti,
		triggerHaptic,
		toggleTheme,
		rejectPayment,
		updateMapsUrl,
		getParticipantByTicket,
		showToast,
		askConfirm,
	} from "$lib/data/store.svelte.js";

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
		Map,
		LogOut,
		Clock as ClockIcon,
		Image as ImageIcon,
		Upload,
		QrCode,
		Sun,
		Moon,
		Search,
	} from "lucide-svelte";

	import { enhance } from "$app/forms";

	// ── QR Scanner ───────────────────────────────────────────────
	let showScanner = $state(false);
	let scannerObj = null;

	async function startScanner() {
		showScanner = true;
		const { Html5Qrcode } = await import(
			"https://cdn.jsdelivr.net/npm/html5-qrcode@2.3.8/+esm"
		);

		setTimeout(() => {
			scannerObj = new Html5Qrcode("reader");
			scannerObj
				.start(
					{ facingMode: "environment" },
					{ fps: 10, qrbox: { width: 250, height: 250 } },
					(decodedText) => {
						handleScanSuccess(decodedText);
					},
					() => {},
				)
				.catch((err) => {
					console.error("Scanner error:", err);
					showToast(
						"Gagal mengakses kamera. Pastikan izin kamera aktif.",
						"error",
					);
					stopScanner();
				});
		}, 300);
	}

	function stopScanner() {
		if (scannerObj) {
			scannerObj
				.stop()
				.then(() => {
					scannerObj = null;
					showScanner = false;
				})
				.catch(() => {
					showScanner = false;
				});
		} else {
			showScanner = false;
		}
	}

	function handleScanSuccess(text) {
		triggerHaptic("success");
		// Cari ID di URL atau teks mentah
		let tid = "";
		if (text.includes("/ticket/")) {
			tid = text.split("/ticket/")[1].split("?")[0];
		} else {
			tid = text.trim().toUpperCase();
		}

		const p = getParticipantByTicket(tid);
		if (p) {
			const s = db.sessions.find((s) => s.id === p.session_id);
			if (s) {
				const cost = calcPlayerCost(
					s,
					getParticipants(s.id),
					p.needs_racket,
				);
				stopScanner();
				openVerification(p, s, cost);
				return;
			}
		}
		showToast("Tiket tidak valid atau tidak ditemukan.", "error");
	}

	// ── Search & Filter ──────────────────────────────────────────
	let searchQuery = $state("");

	function getFilteredParticipants(sessionId) {
		const raw = getParticipants(sessionId);
		if (!searchQuery.trim()) return raw;

		const q = searchQuery.toLowerCase().trim();
		return raw.filter(
			(p) =>
				p.name.toLowerCase().includes(q) ||
				(p.ticket_id && p.ticket_id.toLowerCase().includes(q)),
		);
	}

	// ── Session Form ──────────────────────────────────────────────
	let newTitle = $state("");
	let newDate = $state(new Date().toISOString().split("T")[0]);
	let newTime = $state("19:00");
	let newEndTime = $state("21:00");
	let newSubtitle = $state("Mixed Levels");
	let newCourts = $state(1);
	let newRackets = $state(0);
	let newBuyShuttlecock = $state(false);
	let formError = $state("");
	let showCreateForm = $state(false);

	// ── QRIS ─────────────────────────────────────────────────────
	let isUploadingQRIS = $state(false);
	let qrisSuccess = $state(false);
	let qrisPreview = $state(null);

	// ── Gallery ───────────────────────────────────────────────────
	let isUploading = $state(false);
	let galleryFileRef;
	let localPreviews = $state([]);

	// ── Verification Modal ────────────────────────────────────────
	let selectedVerification = $state(null);
	let verificationCost = $state(0);

	function openVerification(participant, session, cost) {
		selectedVerification = participant;
		verificationCost = cost;
	}

	function closeVerification() {
		selectedVerification = null;
		verificationCost = 0;
	}

	async function handleVerifyPayment() {
		if (selectedVerification && !selectedVerification.has_paid) {
			triggerHaptic("success");
			await togglePaid(selectedVerification.id);
			triggerConfetti();
		}
		closeVerification();
	}

	async function handleRejectPayment() {
		if (selectedVerification) {
			const confirmed = await askConfirm({
				title: "Tolak Pembayaran?",
				message: `Tolak verifikasi pembayaran untuk ${selectedVerification.name}?`,
				confirmText: "Ya, Tolak",
				type: "danger",
			});

			if (confirmed) {
				triggerHaptic("error");
				await rejectPayment(selectedVerification.id);
				closeVerification();
				showToast("Pembayaran ditolak", "info");
			}
		}
	}

	// ── QRIS Upload ───────────────────────────────────────────────
	async function handleQRISUpload(e) {
		const file = e.target.files[0];
		if (!file) return;

		qrisPreview = URL.createObjectURL(file);
		isUploadingQRIS = true;
		qrisSuccess = false;

		try {
			await updateQRIS(file);
			qrisSuccess = true;
			setTimeout(() => {
				qrisSuccess = false;
			}, 3000);
		} catch (err) {
			console.error("QRIS upload failed:", err);
			showToast("Gagal upload QRIS. Cek console untuk detail.", "error");
			qrisPreview = null;
		} finally {
			isUploadingQRIS = false;
			e.target.value = "";
		}
	}

	// ── Maps Config ───────────────────────────────────────────────
	let showMapsConfig = $state(false);
	let mapsUrlInput = $state("");
	let isSavingMaps = $state(false);

	function openMapsConfig() {
		mapsUrlInput = db.settings?.maps_url || appConfig.maps_embed_url;
		showMapsConfig = true;
	}

	async function saveMapsUrl() {
		if (!mapsUrlInput.trim()) return;

		isSavingMaps = true;
		try {
			await updateMapsUrl(mapsUrlInput);
			showMapsConfig = false;
			showToast("Lokasi peta berhasil diperbarui!", "success");
		} catch (err) {
			console.error("Save maps failed:", err);
			// Tampilkan detail error agar tahu apakah itu masalah RLS, kolom, atau koneksi
			showToast(
				`Gagal memperbarui peta: ${err.message || "Cek koneksi database."}`,
				"error",
			);
		} finally {
			isSavingMaps = false;
		}
	}

	// ── Session List ──────────────────────────────────────────────
	let expandedSessionId = $state(null);
	let editSessionId = $state(null);
	let editCourts = $state(1);
	let editRackets = $state(0);
	let editShuttlecock = $state(false);
	let isSavingSessionConfig = $state(false);

	function toggleExpand(id) {
		expandedSessionId = expandedSessionId === id ? null : id;
		if (expandedSessionId !== id) {
			editSessionId = null;
		}
	}

	function openSessionEditor(session) {
		editSessionId = session.id;
		editCourts = session.court_count || 1;
		editRackets = session.racket_count || 0;
		editShuttlecock = !!session.buy_shuttlecock;
	}

	function cancelSessionEditor() {
		editSessionId = null;
	}

	async function saveSessionEditor(session) {
		isSavingSessionConfig = true;
		try {
			await updateSessionConfig(session.id, {
				court_count: editCourts,
				racket_count: editRackets,
				buy_shuttlecock: editShuttlecock,
			});
			showToast("Session config updated", "success");
			editSessionId = null;
		} catch (err) {
			console.error("Failed to update session config:", err);
			showToast("Failed to update session config", "error");
		} finally {
			isSavingSessionConfig = false;
		}
	}

	function formatCurrency(amount) {
		return new Intl.NumberFormat("id-ID", {
			style: "currency",
			currency: "IDR",
			minimumFractionDigits: 0,
			maximumFractionDigits: 0,
		}).format(amount);
	}

	function formatDate(dateStr) {
		return new Date(dateStr + "T00:00:00").toLocaleDateString("en-US", {
			weekday: "short",
			day: "numeric",
			month: "short",
		});
	}

	async function handleCreate() {
		if (!newTitle.trim()) {
			formError = "Title wajib diisi";
			return;
		}
		if (!newDate) {
			formError = "Tanggal wajib diisi";
			return;
		}

		const finalTime = newEndTime ? `${newTime} - ${newEndTime}` : newTime;
		const created = await createSession(
			newTitle.trim(),
			newDate,
			finalTime,
			newSubtitle,
			newCourts,
			newRackets,
		);
		if (created && newBuyShuttlecock) {
			await toggleSessionShuttlecock(created.id);
		}

		newTitle = "";
		newDate = new Date().toISOString().split("T")[0];
		newTime = "19:00";
		newEndTime = "21:00";
		newSubtitle = "Mixed Levels";
		newCourts = 1;
		newRackets = 0;
		newBuyShuttlecock = false;
		formError = "";
		showCreateForm = false;
	}

	// ── Gallery Upload ────────────────────────────────────────────
	async function handleUpload(e) {
		const files = Array.from(e.target.files);
		if (!files.length) return;

		localPreviews = files.map((f) => URL.createObjectURL(f));
		isUploading = true;

		try {
			await uploadGalleryImages(files);
			e.target.value = "";
			localPreviews = [];
		} catch (err) {
			console.error("Upload gagal:", err);
			setTimeout(() => {
				localPreviews = [];
			}, 3000);
		} finally {
			isUploading = false;
		}
	}

	/**
	 * Buat URL gambar gallery dengan cache-bust menggunakan photo.id.
	 */
	function getGalleryImageUrl(url, id) {
		if (!url) return "";
		// Hilangkan query param lama jika ada
		const cleanUrl = url.split("?")[0];
		// Gunakan id record sebagai version (v) yang stabil
		return `${cleanUrl}?v=${id}`;
	}
	// ── Verification Queue ───────────────────────────────────────
	let pendingVerifications = $derived(
		db.sessions.flatMap((s) =>
			getParticipants(s.id)
				.filter((p) => p.payment_proof_url && !p.has_paid)
				.map((p) => ({
					...p,
					sessionTitle: s.title,
					sessionDate: s.date,
					cost: calcPlayerCost(
						s,
						getParticipants(s.id),
						p.needs_racket,
					),
				})),
		),
	);
</script>

<!-- QR Scanner Modal -->
{#if showScanner}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center p-6 animate-fade-in"
	>
		<div class="w-full max-w-sm flex flex-col items-center">
			<div class="mb-8 text-center">
				<h3 class="text-white text-xl font-black mb-2">
					Scan Member Pass
				</h3>
				<p class="text-white/50 text-xs">
					Arahkan kamera ke QR Code di HP peserta
				</p>
			</div>

			<div
				id="reader"
				class="w-full aspect-square bg-white/5 rounded-3xl overflow-hidden border-2 border-white/20 shadow-2xl relative"
			>
				<!-- Guide Overlay -->
				<div
					class="absolute inset-0 border-[40px] border-black/40 pointer-events-none"
				></div>
			</div>

			<button
				onclick={stopScanner}
				class="mt-12 w-16 h-16 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all"
			>
				<X size={28} />
			</button>
		</div>
	</div>
{/if}

<svelte:head>
	<title>Admin Dashboard — Badminton Split-Bill</title>
</svelte:head>

<div class="max-w-4xl mx-auto px-5">
	<!-- Header -->
	<header class="pt-8 pb-5 animate-fade-in">
		<div
			class="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
		>
			<div>
				<h1 class="text-2xl font-bold text-text-primary leading-tight">
					Admin Dashboard
				</h1>
				<p class="text-sm text-text-secondary mt-1">
					Manage sessions & participants
				</p>
			</div>

			<div class="flex flex-wrap items-center gap-3">
				<!-- Search -->
				<div class="relative flex-1 min-w-[180px]">
					<Search
						class="absolute left-3 top-1/2 -translate-y-1/2 text-text-tertiary"
						size={14}
					/>
					<input
						type="text"
						bind:value={searchQuery}
						placeholder="ID or Player Name..."
						class="w-full pl-9 pr-4 py-2.5 bg-surface border border-border/50 rounded-xl text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/10 shadow-sm"
					/>
				</div>

				<button
					onclick={startScanner}
					class="w-11 h-11 bg-navy text-white rounded-xl flex items-center justify-center shadow-lg shadow-navy/10 active:scale-95 transition-all"
					title="Scan Member Pass"
				>
					<QrCode size={20} />
				</button>

				<button
					onclick={toggleTheme}
					class="w-11 h-11 rounded-xl bg-surface border border-border/50 flex items-center justify-center text-text-primary shadow-sm active:scale-95"
				>
					{#if db.theme === "dark"}<Sun size={20} />{:else}<Moon
							size={20}
						/>{/if}
				</button>

				<form method="POST" action="/admin/login?/logout" use:enhance>
					<button
						type="submit"
						class="w-11 h-11 rounded-xl bg-danger/5 flex items-center justify-center text-danger hover:bg-danger/10 transition-all active:scale-95"
						title="Logout"
					>
						<LogOut size={20} />
					</button>
				</form>
			</div>
		</div>
	</header>

	<!-- Stats -->
	{#if db.isReady}
		<div
			class="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6 animate-fade-in-up"
			style="animation-delay:100ms"
		>
			<div
				class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm"
			>
				<p
					class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1"
				>
					Total Revenue
				</p>
				<p class="text-lg font-black text-success leading-tight">
					{formatCurrency(getCommunityStats().totalRevenue)}
				</p>
			</div>
			<div
				class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm"
			>
				<p
					class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1"
				>
					Total RSVP
				</p>
				<p class="text-lg font-black text-text-primary leading-tight">
					{getCommunityStats().totalPlayers}
				</p>
			</div>
			<div
				class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm"
			>
				<p
					class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1"
				>
					Unique Players
				</p>
				<p class="text-lg font-black text-text-primary leading-tight">
					{getCommunityStats().uniquePlayers}
				</p>
			</div>
			<div
				class="bg-surface rounded-2xl p-4 border border-border/50 shadow-sm"
			>
				<p
					class="text-[10px] font-black text-text-tertiary uppercase tracking-widest mb-1 text-navy"
				>
					Pending Proofs
				</p>
				<p
					class="text-lg font-black {pendingVerifications.length > 0
						? 'text-warning'
						: 'text-text-tertiary'} leading-tight"
				>
					{pendingVerifications.length}
				</p>
			</div>
		</div>

		<!-- Verification Queue -->
		{#if pendingVerifications.length > 0}
			<section class="mb-8 animate-scale-in">
				<div class="flex items-center justify-between mb-3 px-1">
					<h2
						class="text-[10px] sm:text-xs font-black text-warning uppercase tracking-[0.2em] flex items-center gap-2"
					>
						<ClockIcon size={14} /> Pending Verifications
					</h2>
					<span
						class="px-2 py-0.5 rounded-full bg-warning text-white text-[9px] sm:text-[10px] font-bold animate-pulse"
					>
						{pendingVerifications.length} WAITING
					</span>
				</div>
				<div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
					{#each pendingVerifications as p}
						<button
							onclick={() => openVerification(p, null, p.cost)}
							class="flex items-center gap-3 p-2.5 sm:p-3 bg-warning/5 border border-warning/20 rounded-2xl hover:bg-warning/10 transition-all text-left group"
						>
							<div
								class="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-warning/20 flex items-center justify-center text-warning font-black text-xs sm:text-sm"
							>
								{p.name.charAt(0).toUpperCase()}
							</div>
							<div class="flex-1 min-w-0">
								<p
									class="text-[11px] sm:text-xs font-bold text-text-primary truncate"
								>
									{p.name}
								</p>
								<p
									class="text-[8px] sm:text-[9px] text-text-tertiary uppercase tracking-tight truncate"
								>
									{p.sessionTitle}
								</p>
							</div>
							<div class="text-right">
								<p
									class="text-[9px] sm:text-[10px] font-black text-navy"
								>
									{formatCurrency(p.cost)}
								</p>
								<span
									class="text-[7px] sm:text-[8px] font-bold text-warning uppercase"
									>Review Proof →</span
								>
							</div>
						</button>
					{/each}
				</div>
			</section>
		{/if}
	{/if}

	<!-- Action Buttons -->
	<div class="grid grid-cols-2 gap-3 mb-5 animate-fade-in-up">
		<button
			onclick={() => (showCreateForm = !showCreateForm)}
			class="py-3 rounded-2xl text-sm font-semibold transition-all active:scale-[0.98] flex items-center justify-center gap-2 {showCreateForm
				? 'bg-text-tertiary/10 text-text-secondary'
				: 'bg-navy text-white shadow-sm shadow-navy/20'}"
		>
			{#if showCreateForm}<X size={16} />Cancel{:else}<Plus
					size={16}
				/>New Session{/if}
		</button>
		<button
			onclick={openMapsConfig}
			class="py-3 bg-surface border border-border/50 rounded-2xl text-sm font-semibold text-text-primary shadow-sm transition-all active:scale-[0.98] flex items-center justify-center gap-2 hover:shadow-md"
		>
			<Map size={16} />Edit Maps
		</button>
	</div>

	<!-- Create Session Form -->
	{#if showCreateForm}
		<div
			class="bg-surface rounded-3xl border border-border/50 shadow-sm p-5 mb-5 animate-scale-in"
		>
			<h3 class="text-sm font-bold text-text-primary mb-4">
				New Session
			</h3>
			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleCreate();
				}}
				class="space-y-4"
			>
				<div>
					<label
						for="session-title"
						class="block text-xs font-medium text-text-secondary mb-1.5"
						>Title</label
					>
					<input
						id="session-title"
						type="text"
						bind:value={newTitle}
						placeholder="e.g. Friday Night Smash 🏸"
						class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
					/>
				</div>
				<div>
					<label
						for="session-date"
						class="block text-xs font-medium text-text-secondary mb-1.5"
						>Date</label
					>
					<input
						id="session-date"
						type="date"
						bind:value={newDate}
						class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label
							for="session-time"
							class="block text-xs font-medium text-text-secondary mb-1.5"
							>Start</label
						>
						<input
							id="session-time"
							type="time"
							bind:value={newTime}
							class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
						/>
					</div>
					<div>
						<label
							for="session-end"
							class="block text-xs font-medium text-text-secondary mb-1.5"
							>End</label
						>
						<input
							id="session-end"
							type="time"
							bind:value={newEndTime}
							class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
						/>
					</div>
				</div>
				<div>
					<label
						for="session-subtitle"
						class="block text-xs font-medium text-text-secondary mb-1.5"
						>Subtitle</label
					>
					<input
						id="session-subtitle"
						type="text"
						bind:value={newSubtitle}
						placeholder="e.g. Mixed Levels"
						class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
					/>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label
							for="court-count"
							class="block text-xs font-medium text-text-secondary mb-1.5"
							>Courts (× Rp 77K)</label
						>
						<input
							id="court-count"
							type="number"
							min="1"
							max="10"
							bind:value={newCourts}
							class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
						/>
					</div>
					<div>
						<label
							for="racket-count"
							class="block text-xs font-medium text-text-secondary mb-1.5"
							>Rackets (× Rp 20K)</label
						>
						<input
							id="racket-count"
							type="number"
							min="0"
							max="20"
							bind:value={newRackets}
							class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all"
						/>
					</div>
				</div>
				<div
					class="flex items-center justify-between p-3 bg-bg rounded-2xl border border-border/50"
				>
					<div>
						<p class="text-sm font-medium text-text-primary">
							Beli shuttlecock sesi ini?
						</p>
						<p class="text-xs text-text-tertiary mt-0.5">
							Tambahan biaya tetap Rp 140.000/sesi, dibagi rata
							peserta.
						</p>
					</div>
					<button
						type="button"
						role="switch"
						aria-label="Toggle pembelian shuttlecock"
						aria-checked={newBuyShuttlecock}
						onclick={() => (newBuyShuttlecock = !newBuyShuttlecock)}
						class="relative w-12 h-7 rounded-full transition-colors duration-200 {newBuyShuttlecock
							? 'bg-navy'
							: 'bg-text-tertiary/30'}"
					>
						<span
							class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 {newBuyShuttlecock
								? 'translate-x-5'
								: 'translate-x-0'}"
						></span>
					</button>
				</div>
				{#if formError}
					<p class="text-xs text-danger font-medium animate-scale-in">
						{formError}
					</p>
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

	<!-- Maps URL Config -->
	{#if showMapsConfig}
		<div
			class="bg-surface rounded-3xl border border-border/50 shadow-sm p-5 mb-5 animate-scale-in"
		>
			<h3 class="text-sm font-bold text-text-primary mb-4">
				Google Maps Embed URL
			</h3>
			<textarea
				bind:value={mapsUrlInput}
				rows="3"
				placeholder="Paste embed URL / iframe tag / koordinat lat,lng"
				class="w-full px-4 py-3 bg-bg rounded-2xl border border-border/50 text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 transition-all resize-none"
			></textarea>
			<div class="grid grid-cols-2 gap-3 mt-3">
				<button
					disabled={isSavingMaps}
					onclick={() => (showMapsConfig = false)}
					class="py-2.5 bg-bg rounded-2xl text-sm font-medium text-text-secondary hover:bg-border/30 transition-all disabled:opacity-50"
					>Cancel</button
				>
				<button
					disabled={isSavingMaps}
					onclick={saveMapsUrl}
					class="py-2.5 bg-navy text-white rounded-2xl text-sm font-semibold shadow-sm hover:shadow-md transition-all flex items-center justify-center gap-2 disabled:opacity-50"
				>
					{#if isSavingMaps}
						<div
							class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"
						></div>
						Saving...
					{:else}
						Save URL
					{/if}
				</button>
			</div>
		</div>
	{/if}

	<!-- QRIS Settings -->
	<div
		class="bg-surface rounded-3xl border border-border/50 p-6 shadow-sm mt-5 overflow-hidden relative"
	>
		{#if isUploadingQRIS}
			<div
				class="absolute inset-0 bg-white/60 backdrop-blur-[2px] z-10 flex flex-col items-center justify-center animate-fade-in"
			>
				<div
					class="w-8 h-8 border-4 border-navy border-t-white rounded-full animate-spin mb-2"
				></div>
				<p
					class="text-[10px] font-black text-navy uppercase tracking-widest"
				>
					Updating QRIS...
				</p>
			</div>
		{/if}
		<div class="flex items-center gap-3 mb-6">
			<div
				class="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center text-navy"
			>
				<QrCode size={20} />
			</div>
			<div>
				<h3 class="text-sm font-bold text-text-primary">
					Payment Settings
				</h3>
				<p
					class="text-[10px] text-text-tertiary uppercase tracking-wider font-semibold"
				>
					QRIS & Global Config
				</p>
			</div>
		</div>
		<div class="space-y-4">
			<div
				class="flex items-center gap-4 p-4 bg-bg rounded-2xl border border-border/50 group"
			>
				<div
					class="w-20 h-20 bg-white rounded-xl border border-border/50 flex items-center justify-center overflow-hidden shadow-inner"
				>
					{#if qrisPreview}
						<img
							src={qrisPreview}
							alt="Preview"
							class="w-full h-full object-contain"
						/>
					{:else if db.settings?.qris_url}
						<!--
							Cache-bust QRIS menggunakan updated_at dari settings,
							bukan timestamp yang disimpan di URL.
						-->
						<img
							src={db.settings.qris_url.split("?")[0]}
							alt="QRIS"
							class="w-full h-full object-contain group-hover:scale-110 transition-transform duration-500"
							onerror={(e) => {
								e.currentTarget.src =
									"https://placehold.co/80x80/f3f4f6/a1a1aa?text=QRIS";
							}}
						/>
					{:else}
						<QrCode size={24} class="text-text-tertiary/20" />
					{/if}
				</div>
				<div class="flex-1">
					<p class="text-xs font-bold text-text-primary mb-1">
						Active QRIS Code
					</p>
					<p
						class="text-[10px] text-text-secondary leading-relaxed uppercase tracking-tight font-medium"
					>
						Tampil di semua halaman checkout peserta.
					</p>
				</div>
			</div>
			<label
				class="relative flex items-center justify-center gap-2 py-4 bg-navy text-white text-xs font-black rounded-2xl cursor-pointer hover:bg-navy-dark transition-all active:scale-[0.98] shadow-lg shadow-navy/20 overflow-hidden group"
			>
				<input
					type="file"
					accept="image/*"
					class="hidden"
					onchange={handleQRISUpload}
					disabled={isUploadingQRIS}
				/>
				<div
					class="absolute inset-0 bg-white/10 translate-y-full group-hover:translate-y-0 transition-transform duration-300"
				></div>
				{#if qrisSuccess}
					<Check
						size={16}
						strokeWidth={3}
						class="animate-bounce"
					/><span>BERHASIL DIPERBARUI</span>
				{:else}
					<Upload size={16} strokeWidth={3} /><span
						>UPDATE QRIS IMAGE</span
					>
				{/if}
			</label>
		</div>
	</div>

	<!-- Gallery Management -->
	<section class="mb-10 animate-fade-in-up" style="animation-delay:50ms">
		<div class="flex items-center justify-between mb-4 mt-6">
			<h2
				class="text-sm font-bold text-text-primary flex items-center gap-2"
			>
				<ImageIcon size={14} class="text-navy" />
				Gallery Photos ({db.gallery.length})
			</h2>
			<button
				onclick={() => galleryFileRef.click()}
				disabled={isUploading}
				class="flex items-center gap-2 px-4 py-2 bg-navy text-white text-xs font-bold rounded-xl hover:bg-navy/90 transition-all active:scale-95 disabled:opacity-50"
			>
				{#if isUploading}
					<div
						class="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin"
					></div>
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

		<!-- Info: folder otomatis -->
		<div
			class="mb-4 px-4 py-3 bg-navy/5 rounded-2xl border border-navy/10 flex items-start gap-2"
		>
			<span class="text-navy text-sm mt-0.5">📁</span>
			<p class="text-[11px] text-text-secondary leading-relaxed">
				Foto yang diupload hari ini akan masuk ke folder
				<span class="font-bold text-navy font-mono">
					gallery/{new Date()
						.getDate()
						.toString()
						.padStart(2, "0")}-{new Date().toLocaleString("en-US", {
						month: "long",
					})}-{new Date().getFullYear()}/
				</span>
				secara otomatis.
			</p>
		</div>

		{#if db.gallery.length === 0 && localPreviews.length === 0}
			<div
				class="bg-surface rounded-3xl border border-border/50 p-8 text-center shadow-sm"
			>
				<div
					class="w-12 h-12 rounded-2xl bg-bg flex items-center justify-center mx-auto mb-3"
				>
					<ImageIcon size={20} class="text-text-tertiary" />
				</div>
				<p class="text-sm text-text-secondary font-bold">
					Belum ada foto gallery
				</p>
				<p
					class="text-[10px] text-text-tertiary mt-1 uppercase tracking-widest"
				>
					Upload foto komunitas
				</p>
			</div>
		{:else}
			<div class="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
				<!-- Foto yang sudah ada di DB -->
				{#each db.gallery as photo (photo.id)}
					<div
						class="relative group aspect-square rounded-2xl overflow-hidden bg-bg border border-border/50 shadow-sm animate-scale-in"
					>
						<!--
							FIX UTAMA: gunakan getGalleryImageUrl() untuk cache-bust dengan photo.id.
							- Bersihkan URL dari query param lama dulu (url.split('?')[0])
							- Tambahkan ?v=<photo.id> yang stabil dan unik
							- Ini mencegah 400 error dari Supabase CDN akibat ?t= timestamp lama
						-->
						<img
							src={getGalleryImageUrl(photo.url, photo.id)}
							alt="Gallery"
							class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110 [will-change:transform]"
							loading="lazy"
							onerror={(e) => {
								if (!e.currentTarget.dataset.retried) {
									// Retry sekali dengan cache-bust baru
									e.currentTarget.dataset.retried = "true";
									e.currentTarget.src = `${photo.url.split("?")[0]}?retry=${Date.now()}`;
								} else {
									e.currentTarget.src =
										"https://placehold.co/400x400/f3f4f6/a1a1aa?text=Error";
								}
							}}
						/>
						<!-- Folder label -->
						{#if photo.folder}
							<div
								class="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/50 backdrop-blur-sm rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
							>
								<span
									class="text-[8px] text-white font-bold truncate max-w-[60px] block"
									>{photo.folder}</span
								>
							</div>
						{/if}
						<div
							class="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-end p-2"
						>
							<button
								onclick={() =>
									deleteGalleryImage(photo.id, photo.url)}
								class="w-7 h-7 bg-danger text-white rounded-lg flex items-center justify-center shadow-lg active:scale-90 hover:bg-red-700 transition-all"
							>
								<Trash2 size={12} />
							</button>
						</div>
					</div>
				{/each}

				<!-- Preview sementara saat upload berlangsung -->
				{#each localPreviews as preview}
					<div
						class="relative aspect-square rounded-2xl overflow-hidden bg-bg border border-border/50 shadow-sm"
					>
						<img
							src={preview}
							alt="Uploading..."
							class="w-full h-full object-cover opacity-50 grayscale"
						/>
						<div
							class="absolute inset-0 flex flex-col items-center justify-center gap-1"
						>
							<div
								class="w-5 h-5 border-2 border-navy border-t-white rounded-full animate-spin"
							></div>
							<span class="text-[8px] text-navy font-bold"
								>Uploading</span
							>
						</div>
					</div>
				{/each}
			</div>
		{/if}
	</section>

	<!-- Sessions List -->
	<section class="pb-8">
		<h2
			class="text-sm font-bold text-text-primary mb-3 animate-fade-in-up"
			style="animation-delay:100ms"
		>
			All Sessions ({db.sessions.length})
		</h2>

		{#if !db.isReady}
			<div class="py-10 text-center animate-pulse">
				<div
					class="w-8 h-8 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3"
				></div>
				<p class="text-sm font-medium text-text-secondary">
					Loading...
				</p>
			</div>
		{:else}
			<div class="space-y-3 stagger">
				{#each db.sessions as session (session.id)}
					{@const sessionParticipants = getParticipants(session.id)}
					{@const total = calcTotalCost(session)}
					{@const renters = sessionParticipants.filter(
						(p) => p.needs_racket,
					).length}
					{@const expanded = expandedSessionId === session.id}

					<div
						class="bg-surface rounded-3xl border border-border/50 shadow-sm overflow-hidden animate-fade-in-up"
					>
						<div class="p-4">
							<div class="flex items-center gap-3">
								<div class="flex-1 min-w-0">
									<div class="flex items-center gap-2 mb-1">
										<h3
											class="text-sm font-semibold text-text-primary truncate"
										>
											{session.title}
										</h3>
										{#if isSessionPassed(session)}
											<span
												class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-text-tertiary/10 text-text-tertiary text-[9px] font-bold"
												>✓ ENDED</span
											>
										{:else if session.is_locked}
											<span
												class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-[9px] font-bold"
												><Lock size={8} />LOCKED</span
											>
										{/if}
									</div>
									<div
										class="flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] sm:text-xs text-text-tertiary mt-1"
									>
										<span class="flex items-center gap-1"
											><Calendar size={11} />{formatDate(
												session.date,
											)} · {session.time}</span
										>
										<span class="flex items-center gap-1"
											><Users
												size={11}
											/>{sessionParticipants.length} ({renters}
											rent)</span
										>
									</div>
									<div
										class="flex flex-wrap items-center gap-x-2 mt-1 text-[9px] sm:text-[10px] text-text-tertiary"
									>
										<span
											>{session.court_count} court{session.court_count >
											1
												? "s"
												: ""}</span
										>
										<span>·</span>
										<span
											>{session.racket_count} racket{session.racket_count !==
											1
												? "s"
												: ""}</span
										>
										<span>·</span>
										<span
											>{session.buy_shuttlecock
												? "shuttlecock on"
												: "shuttlecock off"}</span
										>
										<span>·</span>
										<span class="font-medium text-navy/70"
											>{formatCurrency(total)}</span
										>
									</div>
								</div>
								<div class="flex items-center gap-1.5 sm:gap-2">
									<button
										onclick={async () =>
											await toggleSessionShuttlecock(
												session.id,
											)}
										class="px-2.5 h-8 sm:h-9 rounded-xl text-[10px] sm:text-xs font-semibold border transition-all active:scale-90 {session.buy_shuttlecock
											? 'bg-navy/10 text-navy border-navy/20'
											: 'bg-bg text-text-secondary border-border/60'}"
									>
										{session.buy_shuttlecock
											? "Shuttlecock: ON"
											: "Shuttlecock: OFF"}
									</button>
									<button
										onclick={() =>
											openSessionEditor(session)}
										class="px-2.5 h-8 sm:h-9 rounded-xl text-[10px] sm:text-xs font-semibold border transition-all active:scale-90 bg-bg text-text-secondary border-border/60"
									>
										Edit
									</button>
									<button
										onclick={async () => {
											const confirmed = await askConfirm({
												title: "Hapus Sesi?",
												message: `Hapus "${session.title}"? Semua peserta juga akan dihapus.`,
												confirmText: "Hapus Sesi",
												type: "danger",
											});
											if (confirmed) {
												try {
													await deleteSession(
														session.id,
													);
													showToast(
														"Sesi berhasil dihapus",
														"success",
													);
												} catch (err) {
													console.error(
														"Delete session failed:",
														err,
													);
													showToast(
														`Gagal hapus sesi: ${err.message || "cek koneksi/permission database"}`,
														"error",
													);
												}
											}
										}}
										class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-danger/5 flex items-center justify-center text-danger hover:bg-danger/10 transition-all active:scale-90"
										><Trash2 size={15} /></button
									>
									<button
										onclick={async () =>
											await toggleLock(session.id)}
										class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl flex items-center justify-center transition-all active:scale-90 {session.is_locked
											? 'bg-warning/10 text-warning'
											: 'bg-success/10 text-success'}"
										>{#if session.is_locked}<Unlock
												size={15}
											/>{:else}<Lock
												size={15}
											/>{/if}</button
									>
									<button
										onclick={() => toggleExpand(session.id)}
										class="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-bg flex items-center justify-center transition-all active:scale-90 text-text-secondary"
										>{#if expanded}<ChevronUp
												size={15}
											/>{:else}<ChevronDown
												size={15}
											/>{/if}</button
									>
								</div>
							</div>
						</div>

						{#if expanded}
							<div class="border-t border-border/50">
								{#if editSessionId === session.id}
									<div
										class="p-4 border-b border-border/40 bg-bg/40"
									>
										<p
											class="text-[10px] uppercase tracking-widest font-black text-text-tertiary mb-3"
										>
											Session Config Editor
										</p>
										<div
											class="grid grid-cols-2 gap-3 mb-3"
										>
											<div>
												<label
													for="edit-courts"
													class="block text-[10px] font-semibold text-text-tertiary mb-1"
													>Courts</label
												>
												<input
													id="edit-courts"
													type="number"
													min="1"
													max="10"
													bind:value={editCourts}
													class="w-full px-3 py-2 bg-surface rounded-xl border border-border/60 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
												/>
											</div>
											<div>
												<label
													for="edit-rackets"
													class="block text-[10px] font-semibold text-text-tertiary mb-1"
													>Rackets</label
												>
												<input
													id="edit-rackets"
													type="number"
													min="0"
													max="20"
													bind:value={editRackets}
													class="w-full px-3 py-2 bg-surface rounded-xl border border-border/60 text-xs text-text-primary focus:outline-none focus:ring-2 focus:ring-navy/20"
												/>
											</div>
										</div>
										<div
											class="flex items-center justify-between p-3 bg-surface rounded-xl border border-border/60 mb-3"
										>
											<div>
												<p
													class="text-xs font-semibold text-text-primary"
												>
													Buy shuttlecock
												</p>
												<p
													class="text-[10px] text-text-tertiary"
												>
													Enable session shuttlecock
													fee
												</p>
											</div>
											<button
												type="button"
												role="switch"
												aria-label="Toggle shuttlecock fee"
												aria-checked={editShuttlecock}
												onclick={() =>
													(editShuttlecock =
														!editShuttlecock)}
												class="relative w-12 h-7 rounded-full transition-colors duration-200 {editShuttlecock
													? 'bg-navy'
													: 'bg-text-tertiary/30'}"
											>
												<span
													class="absolute top-0.5 left-0.5 w-6 h-6 bg-white rounded-full shadow-sm transition-transform duration-200 {editShuttlecock
														? 'translate-x-5'
														: 'translate-x-0'}"
												></span>
											</button>
										</div>
										<div class="grid grid-cols-2 gap-2">
											<button
												onclick={cancelSessionEditor}
												class="py-2.5 rounded-xl bg-surface border border-border/60 text-xs font-semibold text-text-secondary"
												>Cancel</button
											>
											<button
												disabled={isSavingSessionConfig}
												onclick={async () =>
													await saveSessionEditor(
														session,
													)}
												class="py-2.5 rounded-xl bg-navy text-white text-xs font-bold disabled:opacity-60"
											>
												{isSavingSessionConfig
													? "Saving..."
													: "Save Changes"}
											</button>
										</div>
									</div>
								{/if}
								{#if sessionParticipants.length === 0}
									<div class="p-4 text-center">
										<p class="text-xs text-text-tertiary">
											Belum ada peserta
										</p>
									</div>
								{:else}
									<div class="divide-y divide-border/50">
										{#each getFilteredParticipants(session.id) as participant (participant.id)}
											{@const cost = calcPlayerCost(
												session,
												getParticipants(session.id),
												participant.needs_racket,
											)}
											<div
												class="flex items-center gap-3 px-4 py-3 hover:bg-bg/40 transition-colors"
											>
												<div
													class="flex flex-1 items-center gap-3 cursor-pointer min-w-0"
													onclick={() =>
														openVerification(
															participant,
															session,
															cost,
														)}
												>
													<div
														class="w-8 h-8 rounded-full {participant?.needs_racket
															? 'bg-navy/10'
															: 'bg-navy/5'} flex items-center justify-center flex-shrink-0"
													>
														<span
															class="text-xs font-bold text-navy"
															>{participant?.name
																?.charAt(0)
																?.toUpperCase() ||
																"?"}</span
														>
													</div>
													<div
														class="flex-1 min-w-0 pr-2"
													>
														<p
															class="text-[13px] font-bold text-text-primary truncate"
														>
															{participant?.name ||
																"Unknown"}
														</p>
														<p
															class="text-[9px] text-text-tertiary font-black tracking-wider uppercase"
														>
															ID: {participant?.ticket_id ||
																"---"}
														</p>
													</div>
												</div>
												<div
													class="flex items-center gap-2 mt-0.5"
												>
													<span
														class="text-[9px] sm:text-[10px] {participant?.needs_racket
															? 'text-navy/60'
															: 'text-text-tertiary'}"
														>{participant?.needs_racket
															? "🏸 Rent"
															: "🏸 Own"}</span
													>
													<span
														class="text-[9px] sm:text-[10px] text-text-tertiary font-medium"
														>{formatCurrency(
															cost,
														)}</span
													>
												</div>
												<div
													class="flex flex-col items-end gap-1"
												>
													<button
														onclick={async () =>
															await togglePaid(
																participant.id,
															)}
														class="flex items-center gap-1 px-2 py-0.5 sm:px-2.5 sm:py-1 rounded-full text-[9px] sm:text-[11px] font-semibold transition-all active:scale-95 {participant.has_paid
															? 'bg-success/10 text-success'
															: participant.payment_status ===
																  'rejected'
																? 'bg-danger/10 text-danger border border-danger/20'
																: 'bg-text-tertiary/10 text-text-secondary'}"
													>
														{#if participant.has_paid}<Check
																size={12}
															/>Lunas{:else if participant.payment_status === "rejected"}<X
																size={10}
															/>Ditolak{:else}<ClockIcon
																size={10}
															/>Verify{/if}
													</button>
												</div>
												<button
													onclick={async () =>
														await removeParticipant(
															participant.id,
														)}
													class="w-8 h-8 rounded-xl bg-danger/5 flex items-center justify-center text-danger hover:bg-danger/10 transition-all active:scale-90"
													><Trash2
														size={14}
													/></button
												>
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
	<div
		class="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm animate-fade-in flex flex-col justify-end sm:justify-center p-4"
	>
		<div
			class="bg-surface w-full max-w-md mx-auto rounded-3xl shadow-2xl overflow-hidden animate-slide-up sm:animate-scale-in"
			onclick={(e) => e.stopPropagation()}
		>
			<div
				class="p-4 border-b border-border/50 flex justify-between items-center bg-bg/50"
			>
				<h3 class="font-bold text-text-primary">
					Payment Verification
				</h3>
				<button
					onclick={closeVerification}
					class="w-8 h-8 flex items-center justify-center rounded-full bg-surface border border-border/50 shadow-sm text-text-secondary hover:text-text-primary transition-colors"
				>
					<Plus size={16} class="rotate-45" />
				</button>
			</div>
			<div class="p-5 overflow-y-auto max-h-[70vh]">
				<div
					class="aspect-[3/4] bg-bg rounded-2xl border border-border/50 overflow-hidden mb-5"
				>
					<!--
						Cache-bust proof image menggunakan participant.id — bukan timestamp di URL.
					-->
					<img
						src={selectedVerification.payment_proof_url}
						alt="Payment Proof"
						class="w-full h-full object-contain"
						onerror={(e) => {
							e.currentTarget.onerror = null;
							e.currentTarget.src =
								"https://placehold.co/600x800/f3f4f6/a1a1aa?text=Proof+Not+Found";
						}}
					/>
				</div>
				<div
					class="bg-bg rounded-2xl p-4 border border-border/50 space-y-3"
				>
					<div class="flex justify-between items-center">
						<span class="text-xs text-text-secondary">Peserta</span>
						<span class="text-sm font-bold text-text-primary"
							>{selectedVerification?.name}</span
						>
					</div>
					<div class="flex justify-between items-center">
						<span class="text-xs text-text-secondary">Tagihan</span>
						<span class="text-base font-black text-navy"
							>{formatCurrency(verificationCost)}</span
						>
					</div>
					<div
						class="pt-3 border-t border-border/50 flex justify-between flex-wrap gap-2"
					>
						<span
							class="px-2.5 py-1 rounded-md bg-white border border-border/50 text-[10px] font-bold text-text-secondary"
						>
							{selectedVerification.needs_racket
								? "🏸 Sewa Raket"
								: "🏸 Raket Sendiri"}
						</span>
						<span
							class="px-2.5 py-1 rounded-md bg-white border border-border/50 text-[10px] font-bold text-text-secondary"
						>
							{selectedVerification.has_paid
								? "LUNAS"
								: "PENDING"}
						</span>
					</div>
				</div>
			</div>
			<div
				class="p-4 bg-bg/50 border-t border-border/50 grid grid-cols-2 gap-3"
			>
				{#if selectedVerification.has_paid}
					<button
						onclick={async () => {
							await togglePaid(selectedVerification.id);
							closeVerification();
						}}
						class="py-3 rounded-2xl font-bold text-sm transition-all shadow-sm bg-danger/10 text-danger border border-danger/20 hover:bg-danger hover:text-white"
						>Cabut Verifikasi</button
					>
					<button
						disabled
						class="py-3 rounded-2xl font-bold text-sm bg-success/20 text-success border border-success/30 cursor-not-allowed opacity-70"
						>Sudah Lunas</button
					>
				{:else}
					<button
						onclick={handleRejectPayment}
						class="py-3 rounded-2xl font-bold text-sm transition-all shadow-sm bg-danger text-white hover:bg-red-700 active:scale-95"
						>Tolak Bukti</button
					>
					<button
						onclick={handleVerifyPayment}
						class="py-3 rounded-2xl font-bold text-sm bg-navy text-white transition-all shadow-md active:scale-95 hover:shadow-lg"
						>Setujui Sekarang</button
					>
				{/if}
			</div>
		</div>
	</div>
{/if}
