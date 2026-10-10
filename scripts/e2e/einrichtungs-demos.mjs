/** Browserprüfung der Einrichtungs-Demos (Verein, Mannschaft): durchklicken bis „Verlassen“. */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const a = await b.anonymous();

for (const [path, title, steps] of [
  ['/demo/club', 'Verein einrichten (Demo)', 5],
  ['/demo/team', 'Mannschaft einrichten (Demo)', 5],
]) {
  await a.goto(path);
  await text(a.page, title, { exact: true }).waitFor({ timeout: 20_000 });
  ok(
    await text(a.page, 'Demo – es wird nichts gespeichert', {}).isVisible(),
    `${title}: Hinweis „nichts gespeichert“`,
  );
  for (let i = 1; i < steps; i++) await button(a.page, 'Weiter').click();
  await text(a.page, 'Zusammenfassung', {}).waitFor({ timeout: 5_000 });
  await button(a.page, 'Demo abschließen').click();
  await text(a.page, 'Einrichtungs-Demo abgeschlossen', { exact: true }).waitFor({
    timeout: 5_000,
  });
  ok(true, `${title}: Abschlusshinweis`);
  await button(a.page, 'Verlassen').click();
  await a.page.waitForURL(/\/login/, { timeout: 10_000 });
  ok(a.page.url().includes('/login'), `${title}: „Verlassen“ führt zur Anmeldung`);
}
await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
