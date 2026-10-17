/** Ergänzung: Start Vorstand, Rollen/Module (Admin), Statistik (Trainer) */
import { launch } from '../lib/e2e.mjs';
const b = await launch();
const cache = {};
async function snap(who, path, name) {
  const s = (cache[who] ??= await b.session(who));
  await s.goto(path);
  await s.page.waitForTimeout(3000);
  await s.page.screenshot({ path: `.check/pdf/r-${name}.png` });
}
await snap('vorstand', '/', 'vo-home');
await snap('admin', '/admin/roles', 'ad-rollen');
await snap('admin', '/admin/modules', 'ad-module');
await snap('admin', '/admin/teams', 'ad-teams');
await snap('kasse', '/club-cash/closing', 'ka-abschluss');
await b.close();
