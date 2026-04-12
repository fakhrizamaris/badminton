<script>
	import { db, getParticipants, appConfig } from '$lib/data/store.svelte.js';
	import { MapPin, Calendar, Users, ChevronRight, Lock, Phone, Mail } from 'lucide-svelte';
	import heroLogo from '$lib/assets/logo.png';

	/**
	 * Format date for schedule cards (e.g. "Fri, Apr 18")
	 * @param {string} dateStr
	 */
	function formatShortDate(dateStr) {
		const date = new Date(dateStr + 'T00:00:00');
		return date.toLocaleDateString('en-US', {
			weekday: 'short',
			month: 'short',
			day: 'numeric'
		});
	}

	// Smooth scroll to section
	function scrollToSection(e, id) {
		e.preventDefault();
		if (id) {
			const el = document.getElementById(id);
			if (el) {
				const y = el.getBoundingClientRect().top + window.scrollY - 80;
				window.scrollTo({ top: y, behavior: 'smooth' });
			}
		} else {
			window.scrollTo({ top: 0, behavior: 'smooth' });
		}
		// Scale URL back to clean root
		history.replaceState(null, '', '/');
	}

	// Only show non-locked sessions in upcoming
	let upcomingSessions = $derived(db.sessions.filter((s) => !s.is_locked));
	let allSessions = $derived(db.sessions);

	// Gallery data (points to folders in /static/)
	const galleryData = [
		{
			date: '11 April 2026',
			images: [
				'/11-April-2026/1.jpeg',
				'/11-April-2026/2.jpeg',
				'/11-April-2026/3.jpeg',
				'/11-April-2026/4.jpeg',
				'/11-April-2026/5.jpeg',
				'/11-April-2026/6.jpeg'
			]
		},
		{
			date: '4 April 2026',
			images: [
				'/4-April-2026/1.jpeg',
				'/4-April-2026/2.jpeg',
				'/4-April-2026/3.jpeg'
			]
		}
	];

</script>

<svelte:head>
	<title>Home — Badminton Split-Bill</title>
	<meta
		name="description"
		content="Join the Apple Academy Batam badminton community. RSVP for weekly sessions at Axton Badminton Hall, Botania 1."
	/>
</svelte:head>

<!-- Top Navigation Bar -->
<nav class="sticky top-0 z-40 px-4 pt-4 pb-2 animate-fade-in">
	<div class="max-w-5xl mx-auto bg-navy rounded-full px-2 py-2 flex items-center justify-between shadow-lg shadow-navy/25">
		<div class="flex items-center gap-1">
			<a href="/" onclick={(e) => scrollToSection(e, null)} class="px-4 py-2 text-white/90 text-sm font-medium rounded-full hover:bg-white/10 transition-colors">
				Home
			</a>
			<a href="#schedule" onclick={(e) => scrollToSection(e, 'schedule')} class="px-4 py-2 text-white/90 text-sm font-medium rounded-full hover:bg-white/10 transition-colors">
				Schedule
			</a>
			<a href="#gallery" onclick={(e) => scrollToSection(e, 'gallery')} class="px-4 py-2 text-white/90 text-sm font-medium rounded-full hover:bg-white/10 transition-colors">
				Gallery
			</a>
			<a href="#location" onclick={(e) => scrollToSection(e, 'location')} class="px-4 py-2 text-white/90 text-sm font-medium rounded-full hover:bg-white/10 transition-colors hidden sm:block">
				Location
			</a>
			<a href="#faq" onclick={(e) => scrollToSection(e, 'faq')} class="px-4 py-2 text-white/90 text-sm font-medium rounded-full hover:bg-white/10 transition-colors hidden md:block">
				FAQ
			</a>
			<a href="#contact" onclick={(e) => scrollToSection(e, 'contact')} class="px-4 py-2 text-white/90 text-sm font-medium rounded-full hover:bg-white/10 transition-colors">
				Contact
			</a>
		</div>
		<a
			href="#schedule"
			onclick={(e) => scrollToSection(e, 'schedule')}
			class="px-5 py-2 bg-white text-navy text-sm font-bold rounded-full hover:bg-white/90 transition-colors shadow-sm"
		>
			Join Now
		</a>
	</div>
</nav>

<div class="max-w-5xl mx-auto px-5">

	<!-- Hero Section -->
	<section id="home" class="pt-10 pb-12 animate-fade-in-up">
		<div class="flex items-center gap-6">
			<!-- Left: Text -->
			<div class="flex-1">
				<h1 class="text-3xl sm:text-4xl font-extrabold text-text-primary tracking-tight leading-tight">
					Weekly<br />Badminton<br />Community
				</h1>
				<p class="text-sm sm:text-base text-text-secondary mt-3 leading-relaxed">
					Join us every week for fun, social games at Axton Badminton Hall.
				</p>
				<a
					href="#schedule"
					onclick={(e) => scrollToSection(e, 'schedule')}
					class="inline-block mt-5 px-6 py-3 bg-navy text-white text-sm font-semibold rounded-full shadow-md shadow-navy/20 hover:shadow-lg hover:shadow-navy/30 transition-all active:scale-[0.97]"
				>
					See Upcoming Schedule
				</a>
			</div>

			<!-- Right: Logo/Hero image -->
			<div class="flex-shrink-0 w-32 h-32 sm:w-40 sm:h-40">
				<!-- Using logo.png (background visually removed using multiply blend mode) -->
				<img
					src={heroLogo}
					alt="Apple Academy Badminton Logo"
					class="w-full h-full object-contain rounded-2xl mix-blend-multiply"
				/>
			</div>
		</div>
	</section>

	<!-- Upcoming Schedule -->
	<section id="schedule" class="pb-12 animate-fade-in-up" style="animation-delay: 120ms">
		<h2 class="text-xl sm:text-2xl font-bold text-text-primary mb-5">Upcoming Schedule</h2>

		{#if !db.isReady}
			<div class="py-10 text-center animate-pulse">
				<div class="w-10 h-10 border-4 border-navy border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
				<p class="text-sm font-medium text-text-secondary">Loading schedule...</p>
			</div>
		{:else if allSessions.length === 0}
			<div class="bg-surface rounded-3xl border border-border/50 p-8 text-center shadow-sm">
				<p class="text-sm text-text-secondary">No sessions scheduled yet.</p>
			</div>
		{:else}
			<!-- Horizontal scroll container -->
			<div class="flex gap-4 overflow-x-auto pb-4 -mx-5 px-5 snap-x snap-mandatory scrollbar-hide">
				{#each allSessions as session (session.id)}
					{@const sessionParticipants = getParticipants(session.id)}

					<a
						href="/session/{session.id}"
						class="group flex-shrink-0 w-56 bg-surface rounded-3xl border border-border/50 shadow-sm p-5 transition-all duration-300 hover:shadow-md hover:scale-[1.02] active:scale-[0.98] snap-start {session.is_locked ? 'opacity-70' : ''}"
					>
						<!-- Date & Time -->
						<div class="mb-3">
							<p class="text-base font-bold text-text-primary">
								{formatShortDate(session.date)}, {session.time}
							</p>
							<p class="text-xs text-text-secondary mt-0.5">{session.subtitle}</p>
						</div>

						<!-- Meta info -->
						<div class="flex items-center gap-3 mb-4 text-[11px] text-text-tertiary">
							<span class="flex items-center gap-1">
								<Users size={11} />
								{sessionParticipants.length}
							</span>
							<span class="flex items-center gap-1">
								<Calendar size={11} />
								{session.court_count} ct
							</span>
							{#if session.is_locked}
								<span class="flex items-center gap-1 text-warning">
									<Lock size={10} />
									Locked
								</span>
							{/if}
						</div>

						<!-- CTA Button -->
						<div
							class="w-full py-2.5 rounded-xl text-center text-sm font-semibold transition-colors {session.is_locked
								? 'bg-text-tertiary/10 text-text-tertiary'
								: 'bg-navy text-white group-hover:bg-navy-light'}"
						>
							{session.is_locked ? 'View Bill' : 'Book Spot'}
						</div>
					</a>
				{/each}
			</div>

			<!-- All sessions list (vertical, for completeness below) -->
			<div class="mt-6 space-y-3 stagger">
				{#each allSessions as session (session.id)}
					{@const sessionParticipants = getParticipants(session.id)}

					<a
						href="/session/{session.id}"
						class="group flex items-center gap-4 bg-surface rounded-2xl border border-border/50 shadow-sm p-4 transition-all duration-300 hover:shadow-md active:scale-[0.98] animate-fade-in-up {session.is_locked ? 'opacity-70' : ''}"
					>
						<!-- Date Badge -->
						<div class="flex-shrink-0 w-12 h-12 rounded-xl {session.is_locked ? 'bg-text-tertiary/10' : 'bg-navy'} flex flex-col items-center justify-center">
							<span class="text-[9px] font-bold {session.is_locked ? 'text-text-tertiary' : 'text-white/70'} tracking-wider">
								{formatShortDate(session.date).split(',')[0].trim().toUpperCase()}
							</span>
							<span class="text-base font-bold {session.is_locked ? 'text-text-secondary' : 'text-white'} -mt-0.5">
								{new Date(session.date + 'T00:00:00').getDate()}
							</span>
						</div>

						<!-- Info -->
						<div class="flex-1 min-w-0">
							<div class="flex items-center gap-2">
								<h3 class="text-sm font-semibold text-text-primary truncate">{session.title}</h3>
								{#if session.is_locked}
									<span class="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-warning/10 text-warning text-[9px] font-bold flex-shrink-0">
										<Lock size={8} />
										Locked
									</span>
								{/if}
							</div>
							<div class="flex items-center gap-3 mt-1 text-[11px] text-text-tertiary">
								<span>{session.time}</span>
								<span>{sessionParticipants.length} joined</span>
								<span>{session.court_count} court{session.court_count > 1 ? 's' : ''}</span>
							</div>
						</div>

						<ChevronRight size={16} class="text-text-tertiary group-hover:text-navy transition-colors flex-shrink-0" />
					</a>
				{/each}
			</div>
		{/if}
	</section>

	</div>

	<!-- Gallery Section (Full Width, Modern Masonry) -->
	<section id="gallery" class="w-full bg-navy flex flex-col lg:flex-row relative z-10">
		<!-- Left: Sticky Text -->
		<div class="w-full lg:w-1/3 lg:h-screen lg:sticky top-0 p-8 lg:p-12 xl:p-16 flex flex-col justify-center">
			<h2 class="text-4xl lg:text-5xl font-bold mb-6 text-white leading-tight">Our Energy<br/>& Spirit</h2>
			<p class="text-white/80 leading-relaxed text-sm lg:text-base mb-12">
				Feel the passion, the friendship, and the unrelenting drive on the court. This collection is a tribute to the vibrant community that gathers weekly, celebrating every smash, every laugh, and the pure joy of badminton. Explore our shared moments and the memories we've built together.
			</p>
			
			<div class="hidden lg:flex flex-wrap items-center gap-6 text-sm font-medium">
				<a href="/" onclick={(e) => scrollToSection(e, null)} class="text-white/60 hover:text-white transition-colors">Home</a>
				<a href="#gallery" onclick={(e) => scrollToSection(e, 'gallery')} class="text-white transition-colors border-b-2 border-white pb-1">Gallery</a>
				<a href="#schedule" onclick={(e) => scrollToSection(e, 'schedule')} class="text-white/60 hover:text-white transition-colors">Schedule</a>
				<a href="#location" onclick={(e) => scrollToSection(e, 'location')} class="text-white/60 hover:text-white transition-colors">Location</a>
				<a href="#faq" onclick={(e) => scrollToSection(e, 'faq')} class="text-white/60 hover:text-white transition-colors">FAQ</a>
				<a href="#contact" onclick={(e) => scrollToSection(e, 'contact')} class="text-white/60 hover:text-white transition-colors">Contact</a>
			</div>
			
			<div class="lg:absolute bottom-12 left-12 xl:left-16 hidden lg:flex flex-col items-center opacity-70">
				<span class="text-xs text-white uppercase tracking-widest mb-2 font-medium">Scroll to Explore</span>
				<div class="w-px h-8 bg-white/50"></div>
			</div>
		</div>

		<!-- Right: Masonry Grid -->
		<div class="w-full lg:w-2/3 bg-bg p-4 sm:p-6 lg:p-8 min-h-screen">
			<div class="columns-2 md:columns-3 gap-4 lg:gap-6 space-y-4 lg:space-y-6">
				{#each galleryData as group}
					{#each group.images as img, i}
						<div class="break-inside-avoid relative group rounded-2xl overflow-hidden cursor-pointer shadow-sm hover:shadow-2xl transition-all duration-500">
							<img 
								src={img} 
								alt="Session {group.date} - Photo {i+1}"
								class="w-full h-auto object-cover transform transition-transform duration-700 group-hover:scale-105"
								loading="lazy"
							/>
							<div class="absolute inset-x-0 bottom-0 pt-16 pb-4 px-4 bg-gradient-to-t from-black/80 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300">
								<span class="text-white text-xs sm:text-sm font-semibold">{group.date}</span>
							</div>
						</div>
					{/each}
				{/each}
			</div>
		</div>
	</section>

	<div class="max-w-5xl mx-auto px-5 pt-16">

	<!-- Location Section -->
	<section id="location" class="pb-12 animate-fade-in-up" style="animation-delay: 240ms">
		<h2 class="text-xl sm:text-2xl font-bold text-text-primary mb-5">
			Location: Axton Botania Badminton Hall
		</h2>

		<div class="bg-surface rounded-3xl border border-border/50 shadow-sm overflow-hidden">
			<!-- Venue Info -->
			<div class="p-4 flex items-center gap-3 border-b border-border/50">
				<div class="w-10 h-10 rounded-xl bg-navy/5 flex items-center justify-center flex-shrink-0">
					<MapPin size={18} class="text-navy" />
				</div>
				<div>
					<p class="text-sm font-semibold text-text-primary">Axton Botania Badminton Hall</p>
					<p class="text-xs text-text-secondary">Belian, Batam Kota</p>
				</div>
			</div>

			<!-- Google Maps Embed -->
			<iframe
				title="Axton Badminton Hall Location"
				src={appConfig.maps_embed_url}
				class="w-full h-52 border-0"
				allowfullscreen=""
				loading="lazy"
				referrerpolicy="no-referrer-when-downgrade"
			></iframe>
		</div>
	</section>

	<!-- FAQ Section -->
	<section id="faq" class="pb-16 pt-8 animate-fade-in-up" style="animation-delay: 240ms">
		<h2 class="text-xl sm:text-2xl font-bold text-text-primary mb-6">Pertanyaan Umum (FAQ)</h2>
		<div class="space-y-4">
			<div class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm">
				<h3 class="font-bold text-text-primary text-sm mb-2">Bagaimana cara perhitungan biaya split-bill?</h3>
				<p class="text-sm text-text-secondary">Biaya dibagi secara adil. Total biaya sewa lapangan dibagi rata ke seluruh peserta, sedangkan biaya sewa raket hanya dibagi kepada peserta yang menyewa raket saja.</p>
			</div>
			<div class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm">
				<h3 class="font-bold text-text-primary text-sm mb-2">Kapan batas waktu (deadline) RSVP?</h3>
				<p class="text-sm text-text-secondary">Anda harus melakukan RSVP paling lambat H-1 (24 jam sebelum sesi dimulai) agar admin dapat menghitung dan memesan jumlah lapangan serta raket yang sesuai.</p>
			</div>
			<div class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm">
				<h3 class="font-bold text-text-primary text-sm mb-2">Mengapa penyewaan raket dibatasi?</h3>
				<p class="text-sm text-text-secondary">Terdapat batas kuota sekitar 20 raket. Untuk efisiensi, satu raket sewaan sebaiknya digunakan bergantian untuk 2-4 pemain dalam sesi tersebut.</p>
			</div>
			<div class="bg-surface rounded-2xl border border-border/50 p-5 shadow-sm">
				<h3 class="font-bold text-text-primary text-sm mb-2">Bagaimana cara pembayarannya?</h3>
				<p class="text-sm text-text-secondary">Pembayaran dilakukan melalui QRIS atau transfer manual ke koordinator setelah nominal akhir muncul di detail sesi (setelah RSVP ditutup).</p>
			</div>
		</div>
	</section>

	<!-- Footer / Contact -->
	<footer id="contact" class="pb-28 pt-8 border-t border-border/50 animate-fade-in-up" style="animation-delay: 280ms">
		<div class="flex flex-col sm:flex-row items-center justify-between gap-6 text-sm">
			<div class="text-center sm:text-left">
				<p class="text-text-primary font-bold mb-1">Badminton Community</p>
				<p class="text-text-tertiary text-xs">© {new Date().getFullYear()} Badminton Community. All rights reserved.</p>
			</div>
			
			<div class="flex flex-col sm:items-end gap-2 text-center sm:text-right text-xs">
				<span class="text-text-secondary font-semibold border-b border-border/50 pb-1 mb-1 inline-block">Coordinators (WhatsApp)</span>
				<div class="flex flex-col gap-2">
					<a href="https://wa.me/6281355831833" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center sm:justify-end gap-1.5 text-text-primary hover:text-navy font-medium transition-colors">
						<Phone size={12} class="text-navy" />
						Zulkifli: +62 813-5583-1833
					</a>
					<a href="https://wa.me/6281312503080" target="_blank" rel="noopener noreferrer" class="flex items-center justify-center sm:justify-end gap-1.5 text-text-primary hover:text-navy font-medium transition-colors">
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
