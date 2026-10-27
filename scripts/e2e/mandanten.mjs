/**
 * Mandantenbetrieb in der Oberfläche: Vereinswechsel am Logo und Konto ohne Verein.
 * pnpm browser-check scripts/e2e/mandanten.mjs [--no-build]
 * Legt zwei Hilfsdaten an (zweiter Verein, Konto ohne Verein) und räumt sie wieder auf.
 */
import { execFileSync } from 'node:child_process';
import { API, button, launch, text } from '../lib/e2e.mjs';

const url = process.env.DATABASE_URL ?? 'postgres://clubroof:clubroof@localhost:5432/clubroof';
const sql = (q) => execFileSync('psql', [url, '-At', '-c', q], { encoding: 'utf8' }).trim();
const cleanup = () => {
  sql("delete from clubs where slug = 'e2e-zweitverein'");
  sql("delete from users where email = 'ohne-verein@example.org'");
};
cleanup();
sql(
  "insert into clubs (name, short_name, slug, color_theme) values ('FC Zweitverein', 'FC Zweit', 'e2e-zweitverein', 'red')",
);
sql(
  "insert into persons (club_id, user_id, first_name, last_name) select c.id, u.id, 'Trainer', 'Zweit' from clubs c, users u where c.slug = 'e2e-zweitverein' and u.email = 'trainer@sv-gruen-weiss.example'",
);
sql(
  "insert into users (email, display_name, password_hash) select 'ohne-verein@example.org', 'Ohne Verein', password_hash from users where email = 'trainer@sv-gruen-weiss.example'",
);

const b = await launch();
try {
  const { page, goto } = await b.session('trainer');
  await goto('/');
  await button(page, 'Verein wechseln').waitFor({ timeout: 20_000 });
  console.log('✓ Wechsel-Symbol am Vereinslogo');
  await page.screenshot({ path: '.check/mandanten-kopf.png', clip: { x: 0, y: 0, width: 390, height: 140 } });
  await button(page, 'Verein wechseln').click();
  await text(page, 'Verein wählen').waitFor({ timeout: 10_000 });
  await page.screenshot({ path: '.check/mandanten-auswahl.png' });
  await button(page, 'FC Zweitverein').click();
  await text(page, 'FC Zweitverein').first().waitFor({ timeout: 15_000 });
  console.log('✓ Vereinswechsel öffnet den zweiten Verein');
  await page.screenshot({ path: '.check/mandanten-wechsel.png' });
} finally {
  await b.close();
}

// Konto ohne Verein
const b2 = await launch();
try {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ohne-verein@example.org', password: 'clubroof-demo' }),
  });
  const login = await res.json();
  if (login.me !== null) throw new Error('Konto ohne Verein sollte me: null liefern');
  const { page, goto } = await b2.anonymous();
  await page.addInitScript((tok) => localStorage.setItem('clubroof.session', tok), login.token);
  await goto('/');
  await text(page, 'Noch kein Verein').waitFor({ timeout: 20_000 });
  await button(page, 'Code anzeigen').click();
  await text(page, 'Gültig bis').waitFor({ timeout: 10_000 });
  console.log('✓ Konto ohne Verein zeigt Hinweis und Aufnahme-Code');
  await page.screenshot({ path: '.check/mandanten-ohne-verein.png' });
} finally {
  await b2.close();
  cleanup();
}
console.log('fertig');
process.exit(0);
