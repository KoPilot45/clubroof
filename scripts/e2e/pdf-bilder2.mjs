/** Ergänzende Bilder für das PDF: Termin-Detail, Anmeldung, heller Stil */
import { launch } from '../lib/e2e.mjs';
const b = await launch();
const { page, goto } = await b.session('trainer');
await goto('/termine'); await page.waitForTimeout(2800);
await page.getByText('18:00', { exact: false }).filter({ visible: true }).first().click();
await page.waitForTimeout(2500);
await page.screenshot({ path: '.check/pdf/termin-detail.png' });
const a = await b.anonymous();
await a.goto('/login'); await a.page.waitForTimeout(2500);
await a.page.screenshot({ path: '.check/pdf/login.png' });
await b.close();
