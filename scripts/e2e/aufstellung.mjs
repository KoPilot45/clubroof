/**
 * Paket AUF: Aufstellungsplaner im Browser (Maus): Kaderleiste → Position, Position ↔ Position tauschen, zurück in die
 * Leiste, Bank-Verlängerung, Formationswechsel, Speichern/Veröffentlichen.
 * Die Touch-Bedienung (seitliches Wischen vs. senkrechtes Ziehen) lässt sich nur am Gerät prüfen.
 */
import { api, launch, loginAs } from '../lib/e2e.mjs';

const out = '.check/shots';
const b = await launch();
let fail = 0;
const check = (ok, msg) => {
  console.log(`${ok ? '✓' : '✗'} ${msg}`);
  if (!ok) fail++;
};
const coach = await loginAs('trainer');
const b1 = coach.me.teams.find((t) => t.badge === 'B1');
const events = await api('/events', coach.token);
const next = events.find(
  (e) =>
    e.team?.id === b1.id &&
    e.type === 'match' &&
    e.status === 'scheduled' &&
    new Date(e.startsAt) > new Date(),
);
const sheet = await api(`/events/${next.id}/match`, coach.token);
const entries = sheet.lineup.entries;
const placedIds = new Set(entries.map((e) => e.personId));
const freeCards = sheet.candidates.filter((c) => c.status !== 'no' && !placedIds.has(c.personId));
const at = (slot) => entries.find((e) => e.slot === slot);

const { page, goto } = await b.session('trainer', { height: 844 });
await goto(`/match/${next.id}/lineup`);
await page.waitForTimeout(3000);
await page.screenshot({ path: `${out}/auf-buehne.png` });

const counter = async () =>
  (
    await page
      .getByText(/^\d+\/\d+$/)
      .first()
      .textContent()
  ).trim();
const slotBtn = (name) => page.getByRole('button', { name: new RegExp(`^${name}`) }).first();
async function drag(from, to, steps = 12) {
  const a = await from.boundingBox();
  const z = await to.boundingBox();
  await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
  await page.mouse.down();
  const sx = a.x + a.width / 2;
  const sy = a.y + a.height / 2;
  const ex = z.x + z.width / 2;
  const ey = z.y + z.height / 2;
  for (let i = 1; i <= steps; i++) {
    await page.mouse.move(sx + ((ex - sx) * i) / steps, sy + ((ey - sy) * i) / steps);
    await page.waitForTimeout(25);
  }
  await page.waitForTimeout(300);
  await page.mouse.up();
  await page.waitForTimeout(600);
}

// 1. Bühne bei 390 × 844: Spielfeld, Bank, Kaderleiste und Buttons gleichzeitig sichtbar
const save = await page.getByText('Entwurf speichern').first().boundingBox();
check(
  !!save && save.y + save.height <= 844,
  `Buttons im sichtbaren Bereich (Unterkante ${save ? Math.round(save.y + save.height) : '–'} von 844)`,
);
check((await counter()) === '11/11', 'Startelf 11/11 aus dem Seed-Entwurf (4-3-3)');

// 2. Spieler aus der Aufstellung in die Kaderleiste ziehen = aus der Aufstellung nehmen
const gk = at(0);
const firstCard = page
  .getByRole('button', { name: new RegExp(freeCards[0].name.split(' ').slice(1).join(' ')) })
  .first();
await drag(slotBtn(gk.name), firstCard);
check((await counter()) === '10/11', 'Torwart zurück in die Kaderleiste: 10/11');
check(
  (await page.getByRole('button', { name: /Freie Position TW/ }).count()) > 0,
  'Position TW ist frei',
);

// 3. Aus der Kaderleiste auf die freie Position ziehen
const target = page.getByRole('button', { name: /Freie Position TW/ }).first();
const card = page
  .getByRole('button', { name: new RegExp(gk.name.split(' ').slice(1).join(' ')) })
  .first();
await drag(card, target);
check((await counter()) === '11/11', 'Kaderleiste → Position: wieder 11/11');

// 4. Position ↔ Position tauschen
const a = at(1);
const c = at(5);
await drag(slotBtn(a.name), slotBtn(c.name));
const labelA = await slotBtn(a.name).getAttribute('aria-label');
check(
  /, (LM|ZM|RM|IV|LV|RV)$/.test(labelA ?? '') && !labelA.endsWith(', LV'),
  `Tausch: ${a.name} steht jetzt woanders (${labelA?.split(', ').pop()})`,
);

// 5. Bank verlängern: Spieler aus der Kaderleiste auf den freien Bankplatz
const before = await page.getByRole('button', { name: /Freier Bankplatz/ }).count();
const free = freeCards[1];
const card2 = page
  .getByRole('button', { name: new RegExp(free.name.split(' ').slice(1).join(' ')) })
  .first();
await drag(card2, page.getByRole('button', { name: /Freier Bankplatz/ }).first());
check(before === 1, 'ein freier Bankplatz am Ende');
check(
  (await page.getByRole('button', { name: /Freier Bankplatz/ }).count()) === 1,
  'Bank wächst, es bleibt genau ein freier Platz',
);

// 6. Formationswechsel und Spielform
await page
  .getByRole('button', { name: /^4-4-2$/ })
  .first()
  .click();
await page.waitForTimeout(500);
check((await counter()) === '11/11', 'Formation 4-4-2: Spieler bleiben erhalten');
await page.getByText('7er', { exact: true }).first().click();
await page.waitForTimeout(600);
check((await counter()) === '7/7', '7er: sieben in der Startelf, der Rest wandert auf die Bank');
await page.screenshot({ path: `${out}/auf-7er.png` });
await page.getByText('9er', { exact: true }).first().click();
await page.waitForTimeout(600);
check(
  (await counter()) === '7/9',
  '9er: neun Plätze, die sieben Spieler bleiben in der Reihenfolge',
);
await page.getByText('11er', { exact: true }).first().click();
await page.waitForTimeout(600);

// 7. Antippen als Alternative: Spieler antippen, dann Bankplatz antippen
await page
  .getByRole('button', { name: new RegExp(`^${at(3).name}`) })
  .first()
  .click();
await page.waitForTimeout(300);
check((await page.getByText(/gewählt/).count()) > 0, 'Antippen wählt den Spieler (Hinweiszeile)');
await page
  .getByRole('button', { name: /Freier Bankplatz/ })
  .first()
  .click();
await page.waitForTimeout(500);
check((await counter()) === '6/11', 'Antippen setzt den Spieler auf die Bank (6/11)');

// 8. Speichern (Entwurf), Server prüft Slots
await page.getByText('Entwurf speichern').first().click();
await page.waitForTimeout(1500);
const saved = await api(`/events/${next.id}/match`, coach.token);
check(
  saved.lineup.formation === '4-4-2' && saved.lineup.size === 11,
  `Entwurf gespeichert (${saved.lineup.formation}, ${saved.lineup.size}er)`,
);
const slots = saved.lineup.entries.filter((e) => e.slot !== null).map((e) => e.slot);
check(
  new Set(slots).size === slots.length && slots.length === 6,
  'Slots einmalig, 6 in der Startelf',
);
await page.screenshot({ path: `${out}/auf-gespeichert.png` });

// 8b. Verlassen mit ungespeicherten Änderungen fragt nach (Speichern / Verwerfen / Bleiben)
await page.getByText('7er', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByRole('button', { name: 'Zurück' }).first().click();
await page.waitForTimeout(800);
check(
  (await page.getByText('Änderungen speichern?').count()) > 0,
  'Dialog beim Verlassen mit ungespeicherten Änderungen',
);
await page.screenshot({ path: `${out}/auf-verlassen.png` });
await page.getByText('Bleiben', { exact: true }).first().click();
await page.waitForTimeout(400);
await page.getByText('11er', { exact: true }).first().click();
await page.waitForTimeout(400);

// 9. Kader im Detail und Einstellung: unterhalb der Bühne mit den App-Abständen
await page.mouse.move(195, 400);
await page.mouse.wheel(0, 1500);
await page.waitForTimeout(800);
await page.screenshot({ path: `${out}/auf-detail.png` });
check(
  (await page.getByText('Kader im Detail').count()) > 0,
  'Abschnitt „Kader im Detail“ vorhanden',
);
check(
  (await page.getByText('Aufstellung für Spieler und Eltern sichtbar').count()) > 0,
  'Abschnitt „Einstellung“ mit Schalter',
);

// 10. Veröffentlichen und Ansicht für Spieler: Spielfeld ohne Beteiligung, eigene Scheibe in Akzent
await api(`/teams/${b1.id}/profile`, coach.token, {
  method: 'PUT',
  body: JSON.stringify({ lineupVisible: true }),
});
await api(`/events/${next.id}/lineup`, coach.token, {
  method: 'PUT',
  body: JSON.stringify({
    publish: true,
    size: saved.lineup.size,
    formation: saved.lineup.formation,
    entries: saved.lineup.entries.map((e) => ({
      personId: e.personId,
      role: e.role,
      ...(e.slot !== null ? { slot: e.slot } : {}),
    })),
  }),
});
const ps = await b.session('spieler', { height: 844 });
await ps.goto(`/events/${next.id}`);
await ps.page.waitForTimeout(3000);
await ps.page.evaluate(() => {
  for (const el of document.querySelectorAll('*'))
    if (el.textContent === 'Aufstellung') el.scrollIntoView({ block: 'start' });
});
await ps.page.waitForTimeout(600);
await ps.page.screenshot({ path: `${out}/auf-spieler.png` });
check(
  (await ps.page.getByText(/4-4-2 · 11er/).count()) > 0,
  'Spieler sehen die veröffentlichte Aufstellung mit Formation',
);
check(
  (await ps.page.getByText(/Trainingsbeteiligung|Beteiligung/).count()) === 0,
  'Spieler sehen keine Beteiligung',
);
await b.close();
process.exit(fail ? 1 : 0);
