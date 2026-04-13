<script>
	import { onMount } from "svelte";
	import {
		db,
		getParticipants,
		appConfig,
		isSessionPassed,
		toggleTheme,
	} from "$lib/data/store.svelte.js";
	import {
		MapPin,
		Calendar,
		Users,
		ChevronRight,
		Lock,
		Phone,
		Mail,
		Sun,
		Moon,
		Menu,
		X,
	} from "lucide-svelte";
	import heroLogo from "$lib/assets/logo.png";

	let myTickets = $state([]);
	let isMenuOpen = $state(false);
	let showPasses = $state(false);
	let isDesktopSchedule = $state(false);
	let gallerySentinel;
	let galleryObserver;

	const GALLERY_BATCH_SIZE = 12;
	let visibleGalleryCount = $state(GALLERY_BATCH_SIZE);

	onMount(() => {
		myTickets = JSON.parse(localStorage.getItem("my_tickets") || "[]");

		const mediaQuery = window.matchMedia("(min-width: 1024px)");
		const syncViewport = () => {
			isDesktopSchedule = mediaQuery.matches;
		};
		syncViewport();
		mediaQuery.addEventListener("change", syncViewport);

		galleryObserver = new IntersectionObserver(
			(entries) => {
				if (!entries[0]?.isIntersecting) return;
				loadMoreGallery();
			},
			{ rootMargin: "240px" },
		);

		if (gallerySentinel) {
			galleryObserver.observe(gallerySentinel);
		}

		return () => {
			mediaQuery.removeEventListener("change", syncViewport);
			galleryObserver?.disconnect();
		};
	});

	/**
	 * Format date for schedule cards (e.g. "Fri, Apr 18")
	 * @param {string} dateStr
	 */
	function formatShortDate(dateStr) {
		const date = new Date(dateStr + "T00:00:00");
		return date.toLocaleDateString("en-US", {
			weekday: "short",
			month: "short",
			day: "numeric",
		});
	}

	// Smooth scroll to section
	function scrollToSection(e, id) {
		e.preventDefault();
		isMenuOpen = false; // Always close mobile menu
		if (id) {
			const el = document.getElementById(id);
			if (el) {
				const y = el.getBoundingClientRect().top + window.scrollY - 80;
				window.scrollTo({ top: y, behavior: "smooth" });
			}
		} else {
			window.scrollTo({ top: 0, behavior: "smooth" });
		}
		// Scale URL back to clean root
		history.replaceState(null, "", "/");
	}

	let allSessions = $derived(db.sessions);

	let participantCountBySession = $derived.by(() => {
		const counts = new Map();
		for (const p of db.participants) {
			counts.set(p.session_id, (counts.get(p.session_id) || 0) + 1);
		}
		return counts;
	});

	function getParticipantCount(sessionId) {
		return participantCountBySession.get(sessionId) || 0;
	}

	// Gallery data (points to folders in /static/)
	const galleryData = [
		{
			date: "11 April 2026",
			images: [
				"/11-April-2026/1.jpeg",
				"/11-April-2026/2.jpeg",
				"/11-April-2026/3.jpeg",
				"/11-April-2026/4.jpeg",
				"/11-April-2026/5.jpeg",
				"/11-April-2026/6.jpeg",
			],
		},
		{
			date: "4 April 2026",
			images: [
				"/4-April-2026/1.jpeg",
				"/4-April-2026/2.jpeg",
				"/4-April-2026/3.jpeg",
			],
		},
	];

	function getSupabaseGalleryThumbUrl(url, id) {
		const cleanUrl = (url || "").split("?")[0];
		if (!cleanUrl.includes("/storage/v1/object/public/gallery/")) {
			return cleanUrl;
		}
		const transformed = cleanUrl.replace(
			"/storage/v1/object/public/gallery/",
			"/storage/v1/render/image/public/gallery/",
		);
		return `${transformed}?width=720&quality=60&format=origin&v=${id}`;
	}

	// Combine static and dynamic gallery with thumbnail + full image variants.
	let combinedGallery = $derived([
		...db.gallery.map((img) => ({
			thumbUrl: getSupabaseGalleryThumbUrl(img.url, img.id),
			fullUrl: `${img.url.split("?")[0]}?v=${img.id}`,
			date: (img.folder || "").replace(/-/g, " ") || "Gallery",
		})),
		...galleryData.flatMap((group) =>
			group.images.map((src) => ({
				thumbUrl: `/thumbs${src}`,
				fullUrl: src,
				date: group.date,
			})),
		),
	]);

	let visibleGallery = $derived(
		combinedGallery.slice(0, visibleGalleryCount),
	);
	let hasMoreGallery = $derived(visibleGalleryCount < combinedGallery.length);

	function loadMoreGallery() {
		if (!hasMoreGallery) return;
		visibleGalleryCount = Math.min(
			visibleGalleryCount + GALLERY_BATCH_SIZE,
			combinedGallery.length,
		);
	}

	// Lightbox State
	let selectedImage = $state(null);
	function openLightbox(img) {
		selectedImage = img;
		document.body.style.overflow = "hidden";
	}
	function closeLightbox() {
		selectedImage = null;
		document.body.style.overflow = "auto";
	}

	$effect(() => {
		visibleGalleryCount = Math.min(
			Math.max(GALLERY_BATCH_SIZE, visibleGalleryCount),
			combinedGallery.length || GALLERY_BATCH_SIZE,
		);
	});
</script>

<svelte:window
	onclick={(e) => {
		if (showPasses && !e.target.closest(".passes-dropdown-container"))
			showPasses = false;
	}}
/>

<svelte:head>
	<title>Home — Badminton Split-Bill</title>
	<meta
		name="description"
		content="Join the Apple Academy Batam badminton community. RSVP for weekly sessions at Axton Badminton Hall, Botania 1."
	/>
</svelte:head>

<!-- Top Navigation Bar -->
<nav class="fixed top-0 left-0 right-0 z-50 px-5 pt-5 pointer-events-none">
	<div
		class="max-w-5xl mx-auto flex items-center justify-between pointer-events-auto"
	>
		<!-- Desktop Capsule Nav -->
		<div
			class="bg-navy/95 backdrop-blur-md rounded-full px-2 py-2 flex items-center gap-1 shadow-xl shadow-navy/20 border border-white/10 hidden sm:flex"
		>
			<a
				href="/"
				onclick={(e) => scrollToSection(e, null)}
				class="px-5 py-2 text-white/90 text-[13px] font-bold rounded-full hover:bg-white/10 transition-colors"
				>Home</a
			>
			<a
				href="#schedule"
				onclick={(e) => scrollToSection(e, "schedule")}
				class="px-5 py-2 text-white/90 text-[13px] font-bold rounded-full hover:bg-white/10 transition-colors"
				>Schedule</a
			>
			<a
				href="#gallery"
				onclick={(e) => scrollToSection(e, "gallery")}
				class="px-5 py-2 text-white/90 text-[13px] font-bold rounded-full hover:bg-white/10 transition-colors"
				>Gallery</a
			>
			<a
				href="#location"
				onclick={(e) => scrollToSection(e, "location")}
				class="px-5 py-2 text-white/90 text-[13px] font-bold rounded-full hover:bg-white/10 transition-colors"
				>Location</a
			>
			<a
				href="#contact"
				onclick={(e) => scrollToSection(e, "contact")}
				class="px-5 py-2 text-white/90 text-[13px] font-bold rounded-full hover:bg-white/10 transition-colors"
				>Contact</a
			>
		</div>

		<!-- Mobile Burger Button -->
		<button
			onclick={() => (isMenuOpen = !isMenuOpen)}
			class="sm:hidden w-12 h-12 bg-navy text-white rounded-2xl flex items-center justify-center shadow-lg shadow-navy/20 active:scale-90 transition-all"
		>
			{#if isMenuOpen}
				<X size={24} />
			{:else}
				<Menu size={24} />
			{/if}
		</button>

		<!-- Right Side: Theme + Passes -->
		<div class="flex items-center gap-2">
			<!-- Theme Toggle -->
			<button
				onclick={toggleTheme}
				class="w-12 h-12 bg-surface border border-border/50 rounded-2xl flex items-center justify-center text-text-primary shadow-sm hover:shadow-md transition-all active:scale-90"
			>
				{#if db.theme === "dark"}
					<Sun size={20} />
				{:else}
					<Moon size={20} />
				{/if}
			</button>

			{#if myTickets.length > 0}
				<div class="relative passes-dropdown-container">
					<button
						onclick={(e) => {
							e.stopPropagation();
							showPasses = !showPasses;
						}}
						class="h-12 px-5 bg-navy text-white text-[13px] font-black rounded-2xl shadow-lg shadow-navy/10 flex items-center gap-2 hover:bg-navy/90 transition-all active:scale-95"
					>
						Passes
						<span
							class="flex h-4 w-4 items-center justify-center rounded-full bg-white text-[9px] font-black text-navy text-center"
						>
							{myTickets.length}
						</span>
					</button>

					<!-- Dropdown Desktop -->
					<div
						class="absolute top-full right-0 mt-3 w-64 bg-surface rounded-2xl shadow-2xl border border-border/50 overflow-hidden transition-all transform origin-top-right z-[100]
						{showPasses
							? 'opacity-100 pointer-events-auto scale-100'
							: 'opacity-0 pointer-events-none scale-95'}"
					>
						<div class="p-4 bg-bg border-b border-border/50">
							<p
								class="text-[10px] font-black text-text-tertiary uppercase tracking-widest"
							>
								Your Active Passes
							</p>
						</div>
						<div
							class="max-h-60 overflow-y-auto divide-y divide-border/30"
						>
							{#each myTickets as t}
								<a
									href="/ticket/{t.id}"
									onclick={() => (showPasses = false)}
									class="block p-4 hover:bg-navy/5 transition-all group/item"
								>
									<div
										class="flex justify-between items-start"
									>
										<div class="min-w-0 pr-3">
											<p
												class="text-xs font-bold text-text-primary truncate"
											>
												{t.session || "Session"}
											</p>
											<p
												class="text-[10px] text-text-tertiary mt-1 font-mono uppercase"
											>
												#{t.id}
											</p>
										</div>
										<div
											class="w-8 h-8 rounded-xl bg-navy/5 flex items-center justify-center text-navy group-hover/item:bg-navy group-hover/item:text-white transition-all"
										>
											<ChevronRight size={16} />
										</div>
									</div>
								</a>
							{/each}
						</div>
					</div>
				</div>
			{/if}
		</div>
	</div>

	<!-- Mobile Menu Overlay -->
	{#if isMenuOpen}
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<div
			class="fixed inset-0 bg-bg/95 backdrop-blur-xl z-[45] sm:hidden animate-fade-in pointer-events-auto"
			onclick={() => (isMenuOpen = false)}
		>
			<div
				class="flex flex-col items-center justify-center h-full gap-8 p-10 stagger"
			>
				<a
					href="/"
					onclick={(e) => scrollToSection(e, null)}
					class="text-3xl font-black text-text-primary hover:text-navy transition-colors"
					>Home</a
				>
				<a
					href="#schedule"
					onclick={(e) => scrollToSection(e, "schedule")}
					class="text-3xl font-black text-text-primary hover:text-navy transition-colors"
					>Schedule</a
				>
				<a
					href="#gallery"
					onclick={(e) => scrollToSection(e, "gallery")}
					class="text-3xl font-black text-text-primary hover:text-navy transition-colors"
					>Gallery</a
				>
				<a
					href="#location"
					onclick={(e) => scrollToSection(e, "location")}
					class="text-3xl font-black text-text-primary hover:text-navy transition-colors"
					>Location</a
				>
				<a
					href="#contact"
					onclick={(e) => scrollToSection(e, "contact")}
					class="text-3xl font-black text-text-primary hover:text-navy transition-colors"
					>Contact</a
				>

				<div class="h-px w-20 bg-border/50 my-4"></div>

				{#if myTickets.length > 0}
					<p
						class="text-[10px] font-black text-text-tertiary uppercase tracking-[0.2em]"
					>
						Your Passes
					</p>
					<div class="flex flex-col items-center gap-4 w-full">
						{#each myTickets as t}
							<a
								href="/ticket/{t.id}"
								class="text-sm font-bold text-navy bg-navy/5 px-6 py-3 rounded-2xl w-full text-center"
								>{t.session}</a
							>
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</nav>

<div class="max-w-5xl mx-auto px-5 pt-28 sm:pt-32">
	<!-- Hero Section -->
	<section id="home" class="pt-6 sm:pt-10 pb-10 sm:pb-12 animate-fade-in-up">
		<div
			class="flex flex-col-reverse sm:flex-row items-center sm:items-start gap-6 sm:gap-10"
		>
			<!-- Left: Text -->
			<div class="flex-1 text-center sm:text-left">
				<h1
					class="text-2xl sm:text-4xl font-extrabold text-text-primary tracking-tight leading-tight"
				>
					Weekly<br class="hidden sm:block" /> Badminton<br
						class="hidden sm:block"
					/> Community
				</h1>
				<p
					class="text-sm sm:text-base text-text-secondary mt-3 leading-relaxed max-w-sm mx-auto sm:mx-0"
				>
					Join us every week for fun, social games at Axton Badminton
					Hall.
				</p>
				<a
					href="#schedule"
					onclick={(e) => scrollToSection(e, "schedule")}
					class="inline-block mt-5 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-full shadow-md shadow-navy/20 hover:shadow-lg hover:shadow-navy/30 transition-all active:scale-[0.97]"
				>
					See Upcoming Schedule
				</a>
			</div>

			<!-- Right: Visual (Logo + Floating Cards) -->
			<div
				class="flex-1 flex justify-center lg:justify-end animate-fade-in relative min-h-[250px] sm:min-h-[400px]"
			>
				<!-- Background Glow -->
				<div
					class="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-48 sm:w-80 sm:h-80 bg-navy/20 blur-[100px] rounded-full pointer-events-none"
				></div>

				<div
					class="relative w-28 h-28 sm:w-48 sm:h-48 lg:w-64 lg:h-64 z-10"
				>
					<!-- Main Logo -->
					<div
						class="w-full h-full p-4 bg-white/5 backdrop-blur-sm rounded-[2rem] border border-white/10 shadow-2xl flex items-center justify-center overflow-hidden group"
					>
						<img
							src={heroLogo}
							alt="Apple Academy Badminton Logo"
							class="w-full h-full object-contain mix-blend-multiply group-hover:scale-110 transition-transform duration-700"
						/>
					</div>

					<!-- Floating Card 1: Levels -->
					<div
						class="absolute -top-10 -right-20 sm:-top-12 sm:-right-28 bg-white/10 backdrop-blur-xl border border-white/20 p-2 sm:p-4 rounded-2xl shadow-2xl animate-float-slow z-20 whitespace-nowrap"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-navy/20 flex items-center justify-center text-navy"
							>
								<Users size={16} strokeWidth={3} />
							</div>
							<div>
								<p
									class="text-[8px] sm:text-[10px] font-black text-text-tertiary uppercase tracking-widest"
								>
									Community
								</p>
								<p
									class="text-[10px] sm:text-sm font-black text-text-primary"
								>
									All Levels Welcome
								</p>
							</div>
						</div>
					</div>

					<!-- Floating Card 2: Schedule -->
					<div
						class="absolute -bottom-14 -left-20 sm:-bottom-20 sm:-left-36 bg-white/10 backdrop-blur-xl border border-white/20 p-2 sm:p-4 rounded-2xl shadow-2xl animate-float z-20 whitespace-nowrap"
						style="animation-delay: 1.5s"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-success/20 flex items-center justify-center text-success"
							>
								<Calendar size={16} strokeWidth={3} />
							</div>
							<div>
								<p
									class="text-[8px] sm:text-[10px] font-black text-text-tertiary uppercase tracking-widest"
								>
									Typical Days
								</p>
								<p
									class="text-[10px] sm:text-sm font-black text-text-primary"
								>
									Sat & Sun Sessions
								</p>
							</div>
						</div>
					</div>

					<!-- Floating Card 3: Location -->
					<div
						class="absolute top-1/2 -left-40 sm:-left-56 -translate-y-1/2 bg-white/10 backdrop-blur-xl border border-white/20 p-2 sm:p-4 rounded-2xl shadow-2xl animate-float-fast z-20 hidden lg:block whitespace-nowrap"
						style="animation-delay: 0.5s"
					>
						<div class="flex items-center gap-3">
							<div
								class="w-6 h-6 sm:w-8 sm:h-8 rounded-full bg-warning/20 flex items-center justify-center text-warning"
							>
								<MapPin size={16} strokeWidth={3} />
							</div>
							<div>
								<p
									class="text-[8px] sm:text-[10px] font-black text-text-tertiary uppercase tracking-widest"
								>
									Venue
								</p>
								<p
									class="text-[10px] sm:text-sm font-black text-text-primary"
								>
									Axton Badminton Hall, Botania 1
								</p>
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- Upcoming Schedule -->
	<section
		id="schedule"
		class="pb-12 animate-fade-in-up"
		style="animation-delay: 120ms"
	>
		<h2 class="text-xl sm:text-2xl font-bold text-text-primary mb-5">
			Upcoming Schedule
		</h2>

		{#if !db.isSessionsReady}
			<div class="py-10 text-center animate-pulse">
				<div
					class="w-10 h-10 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3"
				></div>
				<p class="text-sm font-medium text-text-secondary">
					Loading schedule...
				</p>
			</div>
		{:else if allSessions.length === 0}
			<div
				class="bg-surface rounded-3xl border border-border/50 p-8 text-center shadow-sm"
			>
				<p class="text-sm text-text-secondary">
					No sessions scheduled yet.
				</p>
			</div>
		{:else if isDesktopSchedule}
			<div class="space-y-3 stagger">
				{#each allSessions as session (session.id)}
					{@const participantCount = getParticipantCount(session.id)}
					{@const passed = isSessionPassed(session)}

					<a
						href="/session/{session.id}"
						class="group flex items-center gap-4 bg-surface rounded-2xl border border-border/50 shadow-sm p-4 transition-all duration-300 animate-fade-in-up {passed
							? 'opacity-50 grayscale pointer-events-none'
							: session.is_locked
								? 'opacity-70 hover:shadow-md active:scale-[0.98]'
								: 'hover:shadow-md active:scale-[0.98]'}"
					>
						<div
							class="flex-shrink-0 w-12 h-12 rounded-xl {passed
								? 'bg-text-tertiary/10'
								: session.is_locked
									? 'bg-text-tertiary/10'
									: 'bg-navy'} flex flex-col items-center justify-center"
						>
							<span
								class="text-[9px] font-bold {passed ||
								session.is_locked
									? 'text-text-tertiary'
									: 'text-white/70'} tracking-wider"
							>
								{formatShortDate(session.date)
									.split(",")[0]
									.trim()
									.toUpperCase()}
							</span>
							<span
								class="text-base font-bold {passed ||
								session.is_locked
									? 'text-text-secondary'
									: 'text-white'} -mt-0.5"
							>
								{new Date(session.date + "T00:00:00").getDate()}
							</span>
						</div>

						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<h3
									class="text-sm font-semibold text-text-primary truncate"
								>
									{session.title}
								</h3>
								{#if passed}
									<span
										class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-text-tertiary/10 text-text-tertiary text-[9px] font-bold flex-shrink-0"
										>✓ Ended</span
									>
								{:else if session.is_locked}
									<span
										class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-[9px] font-bold flex-shrink-0"
										><Lock size={8} />Locked</span
									>
								{/if}
							</div>
							<div
								class="flex items-center gap-3 mt-1 text-[11px] text-text-tertiary"
							>
								<span>{session.time}</span>
								<span>{participantCount} joined</span>
								<span
									>{session.court_count} court{session.court_count >
									1
										? "s"
										: ""}</span
								>
							</div>
						</div>

						<ChevronRight
							size={16}
							class="text-text-tertiary group-hover:text-navy transition-colors flex-shrink-0"
						/>
					</a>
				{/each}
			</div>
		{:else}
			<div
				class="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide"
			>
				{#each allSessions as session (session.id)}
					{@const participantCount = getParticipantCount(session.id)}
					{@const passed = isSessionPassed(session)}

					<a
						href="/session/{session.id}"
						class="group flex-shrink-0 w-56 bg-surface rounded-3xl border border-border/50 shadow-sm p-5 transition-all duration-300 snap-start {passed
							? 'opacity-50 grayscale pointer-events-none'
							: session.is_locked
								? 'opacity-70 hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'
								: 'hover:shadow-md hover:scale-[1.02] active:scale-[0.98]'}"
					>
						<div class="mb-3">
							<p class="text-base font-bold text-text-primary">
								{formatShortDate(session.date)}, {session.time}
							</p>
							<p class="text-xs text-text-secondary mt-0.5">
								{session.subtitle}
							</p>
						</div>

						<div
							class="flex items-center gap-3 mb-4 text-[11px] text-text-tertiary"
						>
							<span class="flex items-center gap-1"
								><Users size={11} />{participantCount}</span
							>
							<span class="flex items-center gap-1"
								><Calendar size={11} />{session.court_count} ct</span
							>
							{#if passed}
								<span
									class="flex items-center gap-1 text-text-tertiary"
									>✓ Completed</span
								>
							{:else if session.is_locked}
								<span
									class="flex items-center gap-1 text-warning"
									><Lock size={10} />Locked</span
								>
							{/if}
						</div>

						<div
							class="w-full py-2.5 rounded-xl text-center text-sm font-semibold transition-colors {passed
								? 'bg-text-tertiary/10 text-text-tertiary'
								: session.is_locked
									? 'bg-text-tertiary/10 text-text-tertiary'
									: 'bg-navy text-white group-hover:bg-navy-light'}"
						>
							{passed
								? "Session Ended"
								: session.is_locked
									? "View Bill"
									: "Book Spot"}
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</section>
</div>

<!-- Gallery Section (Full Width, Modern Masonry) -->
<section
	id="gallery"
	class="w-full bg-navy flex flex-col lg:flex-row relative z-10"
>
	<!-- Left: Sticky Text -->
	<div
		class="w-full lg:w-1/3 lg:h-screen lg:sticky top-0 p-8 lg:p-12 xl:p-16 flex flex-col justify-center"
	>
		<h2
			class="text-4xl lg:text-5xl font-bold mb-6 text-white leading-tight"
		>
			Our Energy<br />& Spirit
		</h2>
		<p class="text-white/80 leading-relaxed text-sm lg:text-base mb-12">
			Feel the passion, the friendship, and the unrelenting drive on the
			court. This collection is a tribute to the vibrant community that
			gathers weekly, celebrating every smash, every laugh, and the pure
			joy of badminton. Explore our shared moments and the memories we've
			built together.
		</p>

		<div class="mt-4 flex flex-col gap-1 opacity-40">
			<span class="text-[10px] font-black tracking-[0.3em] text-white"
				>MEMORIES / 2026</span
			>
			<span class="text-[10px] font-black tracking-[0.3em] text-white"
				>COMMUNITY GALLERY</span
			>
		</div>

		<div
			class="lg:absolute bottom-12 left-12 xl:left-16 hidden lg:flex flex-col items-center opacity-70 mt-20"
		>
			<span
				class="text-[10px] text-white uppercase tracking-[0.3em] mb-4 font-black"
				>Scroll to Explore</span
			>
			<div class="w-px h-12 bg-white/30"></div>
		</div>
	</div>

	<!-- Right: Masonry Grid -->
	<div class="w-full lg:w-2/3 bg-bg p-4 sm:p-6 lg:p-8 min-h-screen">
		<div
			class="columns-2 md:columns-3 gap-4 lg:gap-6 space-y-4 lg:space-y-6"
		>
			{#each visibleGallery as img, i}
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div
					class="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500 animate-scale-in"
					onclick={() => openLightbox(img)}
				>
					<img
						src={img.thumbUrl}
						srcset="{img.thumbUrl} 720w, {img.fullUrl} 1400w"
						sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
						alt="Gallery moment {i}"
						class="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105 [will-change:transform]"
						loading="lazy"
						decoding="async"
						fetchpriority="low"
					/>
					<div
						class="absolute inset-x-0 bottom-0 pt-16 pb-4 px-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"
					>
						<span
							class="text-white text-xs sm:text-sm font-semibold"
							>{img.date}</span
						>
					</div>
				</div>
			{/each}
		</div>

		{#if hasMoreGallery}
			<div class="mt-6 flex justify-center">
				<button
					onclick={loadMoreGallery}
					class="px-5 py-2.5 bg-navy text-white text-xs font-bold rounded-xl shadow-sm hover:shadow-md active:scale-95 transition-all"
				>
					Load More Photos
				</button>
			</div>
		{/if}

		<div bind:this={gallerySentinel} class="h-2"></div>
	</div>
</section>

<!-- Lightbox Component -->
{#if selectedImage}
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<div
		class="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-5 sm:p-10 animate-fade-in"
		onclick={closeLightbox}
	>
		<button
			class="absolute top-6 right-6 w-12 h-12 bg-white/10 hover:bg-white/20 text-white rounded-full flex items-center justify-center backdrop-blur-md transition-all z-[110]"
			onclick={closeLightbox}
		>
			<X size={24} />
		</button>

		<div
			class="relative max-w-5xl w-full max-h-full flex flex-col items-center animate-scale-in"
			onclick={(e) => e.stopPropagation()}
		>
			<img
				src={selectedImage.fullUrl}
				alt="Preview"
				class="max-w-full max-h-[80vh] object-contain rounded-2xl shadow-2xl border border-white/10"
			/>
			<div class="mt-6 text-center">
				<p class="text-white text-lg font-bold">{selectedImage.date}</p>
				<p class="text-white/50 text-xs mt-1 uppercase tracking-widest">
					Badminton Community Moments
				</p>
			</div>
		</div>
	</div>
{/if}

<div class="max-w-5xl mx-auto px-5 pt-16">
	<!-- Location Section -->
	<section
		id="location"
		class="pb-12 animate-fade-in-up"
		style="animation-delay: 240ms"
	>
		<h2 class="text-xl sm:text-2xl font-bold text-text-primary mb-5">
			Location: Axton Botania Badminton Hall
		</h2>

		<div
			class="bg-surface rounded-3xl border border-border/50 shadow-sm overflow-hidden"
		>
			<!-- Venue Info -->
			<div class="p-4 flex items-center gap-3 border-b border-border/50">
				<div
					class="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0"
				>
					<MapPin size={18} class="text-navy" />
				</div>
				<div>
					<p class="text-sm font-semibold text-text-primary">
						Axton Botania Badminton Hall
					</p>
					<p class="text-xs text-text-secondary">
						Belian, Batam Kota
					</p>
				</div>
			</div>

			<!-- Google Maps Embed -->
			<iframe
				title="Axton Badminton Hall Location"
				src={db.settings?.maps_url || appConfig.maps_embed_url}
				class="w-full h-52 border-0"
				allowfullscreen=""
				loading="lazy"
				referrerpolicy="no-referrer-when-downgrade"
			></iframe>
		</div>
	</section>

	<!-- FAQ Section -->
	<section
		id="faq"
		class="pb-16 pt-8 animate-fade-in-up"
		style="animation-delay: 240ms"
	>
		<h2 class="text-xl sm:text-2xl font-bold text-text-primary mb-6">
			Frequently Asked Questions (FAQ)
		</h2>
		<div class="space-y-4">
			<div
				class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm"
			>
				<h3 class="font-bold text-text-primary text-sm mb-2">
					How is the split-bill calculated?
				</h3>
				<p class="text-sm text-text-secondary">
					Costs are divided fairly. The total court rental fee is
					split among all participants, while racket rental fees are
					only charged to those who rent one.
				</p>
			</div>
			<div
				class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm"
			>
				<h3 class="font-bold text-text-primary text-sm mb-2">
					When is the RSVP deadline?
				</h3>
				<p class="text-sm text-text-secondary">
					RSVP must be completed at least 24 hours before the session
					starts to allow coordinators to reserve the correct number
					of courts and rackets.
				</p>
			</div>
			<div
				class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm"
			>
				<h3 class="font-bold text-text-primary text-sm mb-2">
					Why is racket rental limited?
				</h3>
				<p class="text-sm text-text-secondary">
					We have a limited stock of community rackets. For
					efficiency, one rented racket may be shared among 2-4
					players during the session if needed.
				</p>
			</div>
			<div
				class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm"
			>
				<h3 class="font-bold text-text-primary text-sm mb-2">
					How do I make a payment?
				</h3>
				<p class="text-sm text-text-secondary">
					Payments are made via QRIS or manual transfer to the
					coordinator after the final amount is shown in your session
					pass (once RSVP is closed).
				</p>
			</div>
		</div>
	</section>

	<!-- Footer / Contact -->
	<footer
		id="contact"
		class="pb-10 pt-8 border-t border-border/50 animate-fade-in-up"
		style="animation-delay: 280ms"
	>
		<div
			class="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm"
		>
			<div class="text-center sm:text-left">
				<p class="text-text-primary font-bold mb-1">
					Badminton Community
				</p>
				<p class="text-text-tertiary text-xs">
					© {new Date().getFullYear()} Badminton Community. All rights
					reserved.
				</p>
			</div>

			<div
				class="flex flex-col sm:items-end gap-2 text-center sm:text-right text-xs"
			>
				<span
					class="text-text-secondary font-semibold border-b border-border/50 pb-1 mb-1 inline-block"
					>Coordinators (WhatsApp)</span
				>
				<div class="flex flex-col gap-2">
					<a
						href="https://wa.me/6281355831833"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center justify-center sm:justify-end gap-1.5 text-text-primary hover:text-navy font-medium transition-colors"
					>
						<Phone size={12} class="text-navy" />
						Zulkifli: +62 813-5583-1833
					</a>
					<a
						href="https://wa.me/6281312503080"
						target="_blank"
						rel="noopener noreferrer"
						class="flex items-center justify-center sm:justify-end gap-1.5 text-text-primary hover:text-navy font-medium transition-colors"
					>
						<Phone size={12} class="text-navy" />
						Darren Christian: +62 813-1250-3080
					</a>
				</div>
			</div>
		</div>
	</footer>
</div>

<style>
	/* Hide scrollbar for horizontal scroll */
	.scrollbar-hide {
		-ms-overflow-style: none;
		scrollbar-width: none;
	}
	.scrollbar-hide::-webkit-scrollbar {
		display: none;
	}
</style>
