/** Bild für Paket KP (neben die Vorlage): Kader-Pop-up des Trainers. */
import { api, launch, text } from '../lib/e2e.mjs';
const b = await launch();
const { page, goto, login } = await b.session('trainer');
const events = await api('/events', login.token);
const ev = events.find((e) => e.type === 'match' && e.status === 'scheduled' && e.counts);
await goto(`/events/${ev.id}`);
await text(page, 'Kader ›', { exact: true }).click({ timeout: 15_000 });
await page.waitForTimeout(1500);
await b.shot(page, 'kp-popup', false);
await b.close();
