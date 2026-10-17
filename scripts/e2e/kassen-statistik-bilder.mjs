/** Bilder für Paket ST (neben die Entwürfe): Übersicht, Statistik-Themen, Mannschaftskasse. SCHEME=light für hell. */
import { launch } from '../lib/e2e.mjs';

const tag = process.env.SCHEME === 'light' ? 'hell' : 'dunkel';
const b = await launch();
const kasse = await b.session('kasse');
const shots = [
  ['uebersicht', '/club-cash'],
  ['verlauf', '/club-cash/stats'],
  ['plan', '/club-cash/stats?topic=plan'],
  ['beitraege', '/club-cash/stats?topic=fees'],
];
for (const [name, path] of shots) {
  await kasse.goto(path);
  await kasse.page.waitForTimeout(2500);
  await b.shot(kasse.page, `st-${name}-${tag}`, false);
}
const trainer = await b.session('trainer');
const team = trainer.login.me.teams.find((t) => t.badge === 'B1') ?? trainer.login.me.teams[0];
await trainer.goto(`/teams/${team.id}/cash-stats`);
await trainer.page.waitForTimeout(2500);
await b.shot(trainer.page, `st-mannschaft-${tag}`, false);
await b.close();
