<script>
	import { enhance } from "$app/forms";
	import { Shield, Lock, Mail } from "lucide-svelte";

	let { form } = $props();
	let isLoading = $state(false);
</script>

<svelte:head>
	<title>Admin Login — Badminton Split-Bill</title>
</svelte:head>

<div class="max-w-md mx-auto px-5 pt-32 animate-fade-in">
	<div class="text-center mb-8">
		<div
			class="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-navy mb-4 shadow-lg shadow-navy/20"
		>
			<Shield size={28} class="text-white" />
		</div>
		<h1 class="text-2xl font-bold text-text-primary">Admin Access</h1>
		<p class="text-sm text-text-secondary mt-1">
			Masuk dengan email & password admin Supabase
		</p>
	</div>

	<form
		method="POST"
		action="?/login"
		use:enhance={() => {
			isLoading = true;
			return async ({ update }) => {
				isLoading = false;
				await update();
			};
		}}
		class="bg-surface rounded-3xl border border-border/50 shadow-sm p-6 space-y-4"
	>
		<div>
			<label
				for="admin-email"
				class="block text-xs font-medium text-text-secondary mb-1.5"
			>
				Email Admin
			</label>
			<div class="relative">
				<div
					class="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
				>
					<Mail size={16} />
				</div>
				<input
					id="admin-email"
					name="email"
					type="email"
					autocomplete="email"
					required
					placeholder="admin@email.com"
					class="w-full pl-12 pr-4 py-3.5 bg-bg rounded-2xl border border-border/50 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
				/>
			</div>
		</div>

		<div>
			<label
				for="admin-password"
				class="block text-xs font-medium text-text-secondary mb-1.5"
			>
				Password
			</label>
			<div class="relative">
				<div
					class="absolute left-4 top-1/2 -translate-y-1/2 text-text-tertiary"
				>
					<Lock size={16} />
				</div>
				<input
					id="admin-password"
					name="password"
					type="password"
					autocomplete="current-password"
					required
					placeholder="Masukkan password"
					class="w-full pl-12 pr-4 py-3.5 bg-bg rounded-2xl border border-border/50 text-base text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-navy/20 focus:border-navy/30 transition-all"
				/>
			</div>
			{#if form?.error}
				<p
					class="text-xs text-danger font-medium mt-2 animate-scale-in"
				>
					{form.error}
				</p>
			{/if}
		</div>

		<button
			type="submit"
			disabled={isLoading}
			class="w-full py-3.5 bg-navy text-white font-bold text-sm rounded-2xl shadow-sm shadow-navy/20 hover:shadow-md transition-all active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
		>
			{#if isLoading}
				<div
					class="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"
				></div>
				Verifying...
			{:else}
				Login to Dashboard
			{/if}
		</button>
	</form>

	<div class="mt-8 text-center">
		<a
			href="/"
			class="text-sm font-semibold text-text-tertiary hover:text-navy transition-colors"
		>
			← Back to Public Site
		</a>
	</div>
</div>
