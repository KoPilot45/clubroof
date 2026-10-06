/**
 * Hilfen für Browserprüfungen mit Playwright (siehe scripts/browser-check.mjs).
 * Umgebung: CLUBROOF_WEB (Web-App), CLUBROOF_API (Server), CLUBROOF_SHOTS (Ordner für Bilder).
 */
import { createRequire } from 'node:module';
import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

export const WEB = process.env.CLUBROOF_WEB ?? 'http://localhost:8081';
export const API = process.env.CLUBROOF_API ?? 'http://localhost:3999';
const SHOTS = process.env.CLUBROOF_SHOTS ?? join(process.cwd(), '.check', 'shots');

async function loadPlaywright() {
  const require = createRequire(import.meta.url);
  for (const id of ['playwright', '/opt/node-tools/node_modules/playwright']) {
    try {
      return require(id);
    } catch {
      /* nächster Versuch */
    }
  }
  throw new Error(
    'Playwright nicht gefunden (npm i -D playwright oder PLAYWRIGHT_BROWSERS_PATH nutzen).',
  );
}

/** Anmeldung per API, z. B. loginAs('trainer'); Passwort der Demo-Logins. */
export async function loginAs(who) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: `${who}@sv-gruen-weiss.example`, password: 'clubroof-demo' }),
  });
  if (!res.ok) throw new Error(`Login ${who} fehlgeschlagen (${res.status})`);
  return res.json();
}

export async function api(path, token, init = {}) {
  const res = await fetch(`${API}${path}`, {
    ...init,
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${token}`,
      ...init.headers,
    },
  });
  return res.json();
}

/** Browser starten; `session()` öffnet eine Seite, bereits als Person angemeldet. */
export async function launch() {
  const { chromium } = await loadPlaywright();
  const browser = await chromium.launch();
  const errors = [];
  return {
    errors,
    async session(who, { width = 390, height = 844 } = {}) {
      const login = await loginAs(who);
      const ctx = await browser.newContext({
        viewport: { width, height },
        timezoneId: 'Europe/Berlin',
        locale: 'de-DE',
      });
      await ctx.addInitScript((t) => localStorage.setItem('clubroof.session', t), login.token);
      const page = await ctx.newPage();
      page.on('pageerror', (e) => errors.push(`${who}: ${e.message}`));
      page.on('console', (m) => {
        // 403/404 sind erwartbare Antworten (fehlende Rechte), keine Fehler der App
        if (m.type() === 'error' && !/40[34]/.test(m.text()))
          errors.push(`${who}: ${m.text().slice(0, 200)}`);
      });
      return { page, login, goto: (path) => page.goto(`${WEB}${path}`) };
    },
    /** Bild nur speichern, wenn wirklich nötig – Pfad wird ausgegeben. */
    async shot(page, name, full = true) {
      mkdirSync(SHOTS, { recursive: true });
      const path = join(SHOTS, `${name}.png`);
      await page.waitForTimeout(800);
      await page.screenshot({ path, fullPage: full });
      console.log(`📷 ${path}`);
      return path;
    },
    close: () => browser.close(),
  };
}

/** Sichtbaren Text suchen (Web-Export hat viele versteckte Doppel). */
export const text = (page, t, o = {}) => page.getByText(t, o).filter({ visible: true }).first();
export const button = (page, name) =>
  page.getByRole('button', { name }).filter({ visible: true }).first();
