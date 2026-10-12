import { launch } from '../lib/e2e.mjs';
const out = '.check/shots';
const b = await launch();
const shot = async (page, n) => {
  await page.waitForTimeout(900);
  await page.screenshot({ path: `${out}/rd3-${n}.png` });
};
{
  const { page, goto, login } = await b.session('trainer');
  const b1 = login.me.teams.find((t) => t.badge === 'B1');
  await goto(`/teams/${b1.id}/event-new`);
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Ende:/ }).click();
  await shot(page, 0);
  await page.keyboard.press('Escape');
  await goto('/facilities');
  await shot(page, 1);
}
{
  const { page, goto } = await b.session('admin');
  await goto('/admin/members');
  await page.waitForTimeout(2000);
  await page.getByText('Rollen und Aufgaben').first().click();
  await shot(page, 2);
  await goto('/admin/club-event-new');
  await page.waitForTimeout(2000);
  await page
    .getByText(/Mannschaften oder Personen/)
    .first()
    .click()
    .catch((e) => console.log('kein Einladen-Knopf'));
  await shot(page, 3);
  await goto('/admin/club-event-new');
  await page.waitForTimeout(2000);
  await page.getByRole('button', { name: /^Beginn:/ }).click();
  await shot(page, 4);
}
await b.close();
