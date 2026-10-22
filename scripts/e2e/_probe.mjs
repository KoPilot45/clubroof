import { launch } from '../lib/e2e.mjs';
const b = await launch();
const { page, goto } = await b.session(process.env.WHO ?? 'kasse', { width: Number(process.env.W ?? 390), height: 1200 });
for (const path of (process.env.PATHS ?? '/').split(',')) {
  await goto(path);
  await page.waitForTimeout(2500);
  const info = await page.evaluate(() => ({
    url: location.pathname + location.search,
    buttons: [...document.querySelectorAll('[role=button],[role=tab],[role=link],a,button')].filter((e) => e.getClientRects().length).map((e) => (e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 28)).filter(Boolean).slice(0, 40),
    text: document.body.innerText.split('\n').filter(Boolean).slice(0, 45).join(' | ').slice(0, 900),
  }));
  console.log(JSON.stringify(info, null, 1));
}
await b.close();
