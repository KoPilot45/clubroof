import { launch } from '../lib/e2e.mjs';
const out = '.check/shots';
const b = await launch();
const names = async (page) => (await page.getByRole('button').evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') || e.innerText.trim()).filter(Boolean))).join(' | ');
{
  const { page, goto, login } = await b.session('trainer');
  const b1 = login.me.teams.find((t) => t.badge === 'B1');
  await goto(`/teams/${b1.id}/event-new`); await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/rd2-0.png`, fullPage: true });
  console.log('EVENT-NEW', await names(page));
  await goto('/facilities'); await page.waitForTimeout(2000);
  await page.screenshot({ path: `${out}/rd2-1.png`, fullPage: true });
  console.log('FACILITIES', await names(page));
}
{
  const { page, goto } = await b.session('admin');
  await goto('/admin/members'); await page.waitForTimeout(2000);
  console.log('MEMBERS', await names(page));
  await goto('/admin/club-event-new'); await page.waitForTimeout(2000);
  console.log('CLUBEVENT', await names(page));
}
await b.close();
