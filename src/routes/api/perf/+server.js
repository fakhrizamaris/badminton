import { json } from '@sveltejs/kit';

export async function POST({ request }) {
	try {
		const body = await request.json();

		// Minimal schema guard so malformed payloads are ignored safely.
		if (!body?.name || typeof body?.value !== 'number') {
			return json({ ok: true }, { status: 202 });
		}

		console.log('[web-vital]', {
			name: body.name,
			value: body.value,
			path: body.path || 'unknown',
			ts: body.ts || Date.now()
		});

		return json({ ok: true }, { status: 202 });
	} catch {
		return json({ ok: true }, { status: 202 });
	}
}
