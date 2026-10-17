/** Matrix für die Vorstellungs-PDF: 5 Ansichten × 4 Perspektiven → .check/pdf/m-<ansicht>-<rolle>.png */
import { launch } from '../lib/e2e.mjs';
const b = await launch();
const views = { home: '/', team: '/team', termine: '/termine', verein: '/verein', mehr: '/mehr' };
for (const who of ['spieler', 'trainer', 'vorstand', 'eltern']) {
  const s = await b.session(who, { height: 844 });
  for (const [v, path] of Object.entries(views)) {
    await s.goto(path);
    await s.page.waitForTimeout(3200);
    await s.page.screenshot({ path: `.check/pdf/m-${v}-${who}.png` });
    console.log(
      who,
      v,
      '|',
      (await s.page.innerText('body')).split('\n').filter(Boolean).slice(1, 4).join(' | '),
    );
  }
}
console.log(b.errors.slice(0, 3));
await b.close();
