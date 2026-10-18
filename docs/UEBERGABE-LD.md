# Übergabeprompt: Ladescreen mit Waben (Paket LD)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **LD** (`docs/PAKETE.md`, Zeile LD) gibt dem Ladebildschirm das Waben-Muster, einen laufenden Ring um das Wappen und die Zeile „Powered by Clubroof“. Entschieden ist **Variante A**.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. Zeile **LD** vollständig lesen; Entwurf öffnen: `docs/design/anstoss/Ladescreen.html` (Internet für die Schriften nötig; Variante B nicht umsetzen).
3. Vorhandenes lesen: `components/brand-splash.tsx`, `components/honeycomb.tsx`, `lib/brand.ts`, `app/_layout.tsx` (Aufruf), `app.json`, `assets/`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **`BrandSplash`** nach Variante A: Verlauf, `Honeycomb`, Wappen mit laufendem Ring und Atmen, Name, Zeile, Punkte, „Wird geladen“, „Powered by Clubroof“; dunkel und hell (Auslauf); „Bewegung reduzieren“; Barrierefreiheit.
2. **Ohne Verein:** Clubroof-Variante (Blau-Verlauf, Logo, ohne „Powered by“).
3. **Nativer Start-Bildschirm:** neutral (dunkel/hell) mit Clubroof-Zeichen, Überblendung 250 ms in den App-Ladebildschirm; Assets anpassen.
4. **Aufräumen:** Übersetzungen (`node scripts/i18n.mjs todo` / `merge`), Prüfung und Bilder.

## Abnahme
Bilder mit Verein (dunkel, hell), ohne Verein, „Bewegung reduzieren“, zwei Vereinsfarben (Grün, Gelb) neben den Entwurf; Abweichungen benennen; kurze Liste erledigt / abweichend / offen.
