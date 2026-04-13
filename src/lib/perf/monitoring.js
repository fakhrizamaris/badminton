export function startPerformanceMonitoring() {
	if (typeof window === 'undefined') return () => {};
	if (window.__perfMonitoringStarted) return () => {};

	window.__perfMonitoringStarted = true;

	let clsValue = 0;
	let inpMax = 0;
	const observers = [];

	const report = (name, value) => {
		const metric = {
			name,
			value: Number(value?.toFixed ? value.toFixed(2) : value),
			path: window.location.pathname,
			ts: Date.now()
		};

		if (import.meta.env.DEV) {
			console.log('[perf]', metric);
		}

		try {
			navigator.sendBeacon('/api/perf', JSON.stringify(metric));
		} catch {
			// Ignore telemetry errors.
		}
	};

	const lcpObserver = new PerformanceObserver((entryList) => {
		const entries = entryList.getEntries();
		const last = entries[entries.length - 1];
		if (last) report('LCP', last.startTime);
	});
	lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
	observers.push(lcpObserver);

	const paintObserver = new PerformanceObserver((entryList) => {
		for (const entry of entryList.getEntries()) {
			if (entry.name === 'first-contentful-paint') {
				report('FCP', entry.startTime);
			}
		}
	});
	paintObserver.observe({ type: 'paint', buffered: true });
	observers.push(paintObserver);

	const clsObserver = new PerformanceObserver((entryList) => {
		for (const entry of entryList.getEntries()) {
			if (!entry.hadRecentInput) {
				clsValue += entry.value;
			}
		}
		report('CLS', clsValue);
	});
	clsObserver.observe({ type: 'layout-shift', buffered: true });
	observers.push(clsObserver);

	const inpObserver = new PerformanceObserver((entryList) => {
		for (const entry of entryList.getEntries()) {
			if (!entry.interactionId) continue;
			if (entry.duration > inpMax) {
				inpMax = entry.duration;
				report('INP', inpMax);
			}
		}
	});
	inpObserver.observe({ type: 'event', durationThreshold: 40, buffered: true });
	observers.push(inpObserver);

	return () => {
		for (const observer of observers) {
			observer.disconnect();
		}
	};
}
