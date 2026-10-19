/**
 * Paket ROLLEN-VERWALTUNG: Rollenübersicht (Rollen · Personen · Matrix), eigene Rolle anlegen und wieder löschen.
 * pnpm browser-check scripts/e2e/rollen.mjs [--no-build]   (SCHEME=light für hell; Bild in .check/shots/rollen-*.png)
 */
import { api, del, launch } from '../lib/e2e.mjs';

let fail = 0;
const ok = (cond, label) => {
  console.log(`${cond ? '✓' : '✗'} ${label}`);
  if (!cond) fail++;
};
const b = await launch();
const { page, goto, login } = await b.session('admin', { width: 1280, height: 900 });

await goto('/admin/roles');
await page.getByText('Matrix', { exact: true }).first().waitFor({ timeout: 20_000 });
ok(
  (await page.getByText('Standard', { exact: true }).count()) > 3,
  'Rollen: Standardrollen gekennzeichnet',
);
await page.getByText('Matrix', { exact: true }).first().click();
await page.getByText('Rolle', { exact: true }).first().waitFor();
ok(
  (await page.getByLabel(/Fulladmin, Verein: voll/).count()) > 0,
  'Matrix: Fulladmin hat alle Rechte im Bereich Verein',
);
await page.getByText('Personen', { exact: true }).first().click();
await page.getByText('Alle mit Rolle').waitFor();
ok(true, 'Personen: Filter sichtbar');

await goto('/admin/role-edit');
await page.getByLabel('Name', { exact: true }).fill('Browser-Testrolle');
await page.getByRole('switch').first().click();
await page.screenshot({ path: '.check/shots/rollen-editor.png' });
await page.getByRole('button', { name: 'Rolle anlegen' }).click();
await page.getByText('Browser-Testrolle').first().waitFor({ timeout: 15_000 });
ok(true, 'Eigene Rolle angelegt und in der Übersicht');
const roles = await api('/admin/roles', login.token);
const mine = roles.roles.find((r) => r.name === 'Browser-Testrolle');
ok(!!mine && !mine.isSystem, 'Server: Rolle ist eine eigene Rolle');
if (mine) await del(`/admin/roles/${mine.key}`, login.token);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (fail || b.errors.length) process.exit(1);
