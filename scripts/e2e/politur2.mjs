/**
 * PO: Politur 2 – Typografie (Saira Condensed), Absage/Unsicher-Formulare, Platzbelegung als Wochenplan.
 * Aufruf: pnpm browser-check scripts/e2e/politur2.mjs [--no-build|--reset]
 */
import { api, button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};
const family = (page, loc) => loc.evaluate((e) => getComputedStyle(e).fontFamily);
const bg = (loc) => loc.evaluate((e) => getComputedStyle(e).backgroundColor);
const rgb = (c) => c.match(/\d+/g).slice(0, 3).map(Number);

// ── Typografie ───────────────────────────────────────────────────────────────
const s = await b.session('spieler');
const { page } = s;
await s.goto('/verein');
const heading = text(page, 'Veranstaltungen', { exact: true });
await heading.waitFor({ timeout: 20_000 });
ok(/Saira/.test(await family(page, heading)), 'Zwischenüberschrift in Saira Condensed');
const hb = await heading.boundingBox();
ok(
  (await heading.evaluate((e) => getComputedStyle(e).fontSize)) === '20px',
  'Zwischenüberschrift 20 px',
);
ok(
  (await heading.evaluate((e) => getComputedStyle(e).textTransform)) === 'uppercase',
  'Zwischenüberschrift in Großbuchstaben',
);
const title = page.getByRole('heading', { name: 'Verein', exact: true }).first();
ok(
  /Saira/.test(await family(page, title)) &&
    (await title.evaluate((e) => getComputedStyle(e).fontSize)) === '32px',
  'Seitentitel 32 px Saira Condensed',
);
await s.goto('/team');
await text(page, 'Kader', { exact: true }).waitFor({ timeout: 20_000 });
ok(hb !== null, 'Zwischenüberschrift sichtbar');

// ── Absage und Unsicher ──────────────────────────────────────────────────────
const events = await api('/events', s.login.token);
const target = events.find(
  (e) =>
    e.status === 'scheduled' &&
    e.myResponses[0]?.canRespond &&
    e.myResponses[0].status === 'pending',
);
ok(!!target, 'Es gibt einen Termin mit offener Rückmeldung');
await s.goto(`/events/${target.id}`);
await text(page, 'Meine Rückmeldung', { exact: true }).waitFor({ timeout: 20_000 });
await button(page, /^Absagen$/).click();
await text(page, 'Warum kannst du nicht?', { exact: true }).waitFor({ timeout: 5000 });
const reasonChip = page.getByRole('radio').filter({ visible: true }).first();
await reasonChip.click();
const [r, g, bl] = rgb(await bg(reasonChip));
ok(r > g + 40 && r > bl + 40, `Gewählter Grund rot (${r},${g},${bl})`);
ok(
  (await reasonChip.evaluate((e) => e.childElementCount)) >= 2,
  'Gewählter Grund trägt ein Häkchen (Symbol vor dem Text)',
);
const send = button(page, /^Absage senden$/);
const [sr, sg, sb] = rgb(await bg(send));
ok(sr > sg + 40 && sr > sb + 40, `„Absage senden“ rot gefüllt (${sr},${sg},${sb})`);
const cancel = button(page, /^Abbrechen$/);
const [cr, cg, cb] = rgb(await bg(cancel));
ok(Math.abs(cr - cg) < 12 && Math.abs(cg - cb) < 12, `„Abbrechen“ grau (${cr},${cg},${cb})`);
await b.shot(page, 'po-absage', false);
await cancel.click();
await page.waitForTimeout(500);

await button(page, /^Unsicher$/).click();
await text(page, 'Warum bist du unsicher?', { exact: true }).waitFor({ timeout: 5000 });
ok(
  (await page.getByRole('radio').filter({ visible: true }).count()) === 0,
  'Unsicher: keine Vorschlags-Chips mehr',
);
ok(
  (await text(page, 'Bitte kurz begründen', { exact: true }).count()) > 0,
  'Hinweis „Bitte kurz begründen“',
);
ok((await text(page, /^0 \/ 120$/).count()) > 0, 'Zähler 0 / 120');
const sendMaybe = button(page, /^Unsicher senden$/);
ok(
  (await sendMaybe.getAttribute('aria-disabled')) === 'true' || (await sendMaybe.isDisabled()),
  '„Unsicher senden“ ohne Text nicht aktiv',
);
const [or, og, ob] = rgb(await bg(sendMaybe.locator('xpath=.')));
ok(or > ob + 30, `„Unsicher senden“ orange (${or},${og},${ob})`);
const field = page.getByRole('textbox', { name: 'Warum bist du unsicher?' });
ok(
  parseInt(await field.evaluate((e) => getComputedStyle(e).borderTopWidth), 10) === 2,
  'Textfeld gelb umrandet (2 px)',
);
await field.fill('Schichtdienst, vielleicht später');
await page.waitForTimeout(300);
ok(!(await sendMaybe.isDisabled()), '„Unsicher senden“ mit Text aktiv');
await b.shot(page, 'po-unsicher', false);
await button(page, /^Abbrechen$/).click();

// ── Platzbelegung ────────────────────────────────────────────────────────────
const a = await b.session('admin');
await a.goto('/facilities');
const radio = (name) => a.page.getByRole('radio', { name, exact: true });
await radio('Woche').waitFor({ timeout: 20_000 });
await radio('Woche').click();
await a.page.waitForTimeout(1500);
await a.page.getByRole('radio', { name: /Kunstrasen/ }).click();
await a.page.waitForTimeout(1200);
ok(
  (await text(a.page, 'Montag bis Freitag', { exact: true }).count()) > 0,
  'Zwischenüberschrift „Montag bis Freitag“',
);
ok(
  (await text(a.page, 'Wochenende', { exact: true }).count()) > 0,
  'Zwischenüberschrift „Wochenende“',
);
const wt = await text(a.page, 'Wochenende', { exact: true }).boundingBox();
const wk = await text(a.page, 'Montag bis Freitag', { exact: true }).boundingBox();
ok(wt.y - wk.y > 150, 'Deutlicher Abstand zwischen Mo–Fr und Wochenende');
const labels = await a.page
  .getByRole('button')
  .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''));
const blocks = labels.filter((l) => /\d\d:\d\d–\d\d:\d\d/.test(l));
ok(blocks.length > 2, `Belegungen als Blöcke (${blocks.length})`);
ok(
  blocks.every((l) => !/ – | vs\.? /.test(l.replace(/\d\d:\d\d–\d\d:\d\d/, ''))),
  'Keine Gegner in den Blöcken',
);
const widths = await a.page.evaluate(() => innerWidth);
const grid = await a.page.locator('[aria-label*=":"]').first().boundingBox();
ok(widths >= 380, `Fenster ${widths} px`);
await a.page.screenshot({ path: '.check/shots/po-platz.png' });
ok(!!grid, 'Raster sichtbar');
await b.shot(a.page, 'po-platz-voll', false);

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed || b.errors.length) process.exit(1);
