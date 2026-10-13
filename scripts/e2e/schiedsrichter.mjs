/** SR: Schiedsrichter – eigene Einsätze, Termine-Tab, Vereins-Soll (Administration). */
import { button, launch, text } from '../lib/e2e.mjs';

const b = await launch();
let failed = false;
const ok = (cond, msg) => {
  console.log(`${cond ? '✓' : '✗'} ${msg}`);
  if (!cond) failed = true;
};

{
  const { page, goto } = await b.session('trainer');
  await goto('/referees');
  await text(page, 'Mein Profil', { exact: true }).waitFor({ timeout: 20_000 });
  ok(
    await text(page, 'Kreisliga', { exact: true }).isVisible(),
    'Profil mit Stufe und Lizenzstatus',
  );
  ok(await text(page, 'Meine Einsätze', { exact: true }).isVisible(), 'Abschnitt „Meine Einsätze“');
  ok(
    await text(page, /FC Ost – SV Mitte/).isVisible(),
    'Kommender Einsatz aus den Demodaten steht in der Liste',
  );
  ok(
    (await page.getByText('Schiedsrichter-Soll').count()) === 0,
    'Ohne Recht keine Vereinsübersicht',
  );

  await text(page, 'Einsatz eintragen', { exact: true }).click();
  await page.getByLabel('Spiel', { exact: true }).fill('SV Browser – FC Test, U13');
  await page.getByLabel('Ort').fill('Sportplatz Browser');
  await text(page, 'Einsatz speichern', { exact: true }).click();
  await text(page, /Einsatz gespeichert|Überschneidung mit eigenen Terminen/).waitFor({
    timeout: 10_000,
  });
  ok(true, 'Einsatz gespeichert, Hinweis zur Überschneidung erscheint');
  await text(page, /SV Browser – FC Test/).click();
  await text(page, 'Einsatz löschen', { exact: true }).click();
  await page.waitForTimeout(800);
  ok((await page.getByText(/SV Browser – FC Test/).count()) === 0, 'Einsatz gelöscht');

  await goto('/termine');
  await text(page, 'Schiedsrichter', { exact: true }).waitFor({ timeout: 20_000 });
  ok(true, 'Einsatz erscheint im Termine-Tab');
}

{
  const { page, goto } = await b.session('admin');
  await goto('/referees');
  await text(page, 'Schiedsrichter-Soll', { exact: true }).waitFor({ timeout: 20_000 });
  ok(
    await text(page, /Es fehlen 1 aktive Schiedsrichter/).isVisible(),
    'Soll 3 von 4: es fehlt einer',
  );
  ok(
    await text(page, 'Lizenz abgelaufen', { exact: true }).isVisible(),
    'Lizenzstatus abgelaufen sichtbar',
  );
  ok(
    await text(page, 'Lizenz läuft bald ab', { exact: true }).isVisible(),
    'Lizenz läuft bald ab sichtbar',
  );
  ok(
    (await page.getByText('Mein Profil').count()) === 0,
    'Administration ist selbst kein Schiedsrichter',
  );
}

{
  const { page, goto } = await b.session('spieler');
  await goto('/referees');
  await page.waitForTimeout(1500);
  ok(
    (await page.getByText('Meine Einsätze').count()) === 0,
    'Spieler sehen die Schiedsrichter-Seite nicht',
  );
}

await b.close();
console.log(b.errors.length ? `Konsolenfehler:\n${b.errors.join('\n')}` : '✓ keine Konsolenfehler');
if (failed) process.exit(1);
