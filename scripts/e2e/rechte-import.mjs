/**
 * Browserprüfung Pakete R, F, I: Rollenfilter, individuelle Rechte, Mannschaft bearbeiten,
 * Wiederholen mit Datum, Spielart, Spielplan-Import (Datei → Zuordnung → Vorschau).
 * pnpm browser-check scripts/e2e/rechte-import.mjs --no-build
 */
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { button, launch, loginAs, text } from '../lib/e2e.mjs';

const b = await launch();
const ok = (m) => console.log(`✓ ${m}`);

// ── Verwaltung: Rollenfilter, individuelle Rechte, Spielplan-Import ───────────
{
  const { page, goto } = await b.session('admin');
  await goto('/admin/members');
  await text(page, 'Rollen und Aufgaben').waitFor({ timeout: 15_000 });
  await text(page, 'Trainer und Co-Trainer', { exact: true }).click();
  await text(page, 'Personen').waitFor({ timeout: 15_000 });
  await text(page, 'Individuelle Rechte', { exact: true }).click();
  await text(page, 'Keine passenden Mitglieder.').waitFor({ timeout: 15_000 });
  ok('Rollenfilter in der Mitgliederliste');

  const member = await loginAs('mitglied');
  await goto(`/admin/member-permissions?id=${member.me.person.id}`);
  await text(page, 'Mitglieder', { exact: true }).waitFor({ timeout: 15_000 });
  await text(page, 'Mitgliederliste einsehen').waitFor({ timeout: 15_000 });
  ok('Individuelle Rechte: Liste aller Rechte');

  const dir = mkdtempSync(join(tmpdir(), 'clubroof-'));
  const file = join(dir, 'spielplan.csv');
  writeFileSync(
    file,
    [
      'Spiel;Anstoß;Heimmannschaft;Gastmannschaft;SD;MS-Art;Spielklasse;Tore;Sondereignis;Status',
      '990001;17.10.2030 17:00;SV Grün-Weiß Musterstadt II;TSV Nachbar;FB;Herren;Kreisliga;;;',
      '990002;24.10.2030 15:00;FC Fern;SV Grün-Weiß Musterstadt II;FB;Herren;Kreispokal;;;',
    ].join('\r\n'),
  );
  await goto('/schedule-import');
  const [chooser] = await Promise.all([
    page.waitForEvent('filechooser'),
    button(page, 'CSV-Datei auswählen').click(),
  ]);
  await chooser.setFiles(file);
  await text(page, 'Mannschaften zuordnen').waitFor({ timeout: 15_000 });
  await text(page, '2. · 2. Mannschaft', { exact: true }).click();
  await text(page, '2 neu').waitFor({ timeout: 15_000 });
  await text(page, 'Pokal', { exact: true }).waitFor({ timeout: 15_000 });
  ok('Spielplan-Import: Zuordnung und Vorschau (Pokal erkannt)');
}

// ── Trainer: Mannschaft bearbeiten, Termin mit Zeitraum und Spielart ──────────
{
  const { page, goto, login } = await b.session('trainer');
  const b1 = login.me.teams.find((t) => t.badge === 'B1');
  await goto(`/teams/${b1.id}/manage`);
  await text(page, 'Treffpunkt-Regeln und Profil').waitFor({ timeout: 15_000 });
  await text(page, 'Person aus der Vereinsliste hinzufügen').waitFor({ timeout: 15_000 });
  ok('Mannschaft bearbeiten');

  await goto(`/teams/${b1.id}/event-new`);
  await text(page, 'Wöchentlich bis …', { exact: true }).click();
  await text(page, 'Wiederholen bis einschließlich').waitFor({ timeout: 15_000 });
  await text(page, 'Spiel', { exact: true }).click();
  await text(page, 'Art des Spiels').waitFor({ timeout: 15_000 });
  await text(page, 'Pokal', { exact: true }).click();
  ok('Termin anlegen: Wiederholen mit Datum, Spielart');
}

console.log(
  b.errors.length ? `✗ Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler',
);
await b.close();
process.exit(b.errors.length ? 1 : 0);
