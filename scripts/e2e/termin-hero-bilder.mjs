/** Bilder für Paket TH (neben den Entwurf): Termin-Hero und Helfer-Wischleiste. */
import { api, launch } from '../lib/e2e.mjs';
const b = await launch();
const { page, goto, login } = await b.session('trainer');
const events = await api('/events', login.token);
const match = events.find((e) => e.type === 'match' && e.status === 'scheduled' && e.counts);
await goto(`/events/${match.id}`);
await page.waitForTimeout(2500);
await b.shot(page, 'th-hero', false);
await goto('/verein');
await page.waitForTimeout(2500);
await b.shot(page, 'th-verein', true);
await b.close();
