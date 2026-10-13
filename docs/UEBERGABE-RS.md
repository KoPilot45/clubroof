# Übergabeprompt: Sichtbarkeit je Rolle (Paket RS)

Zum Einfügen in die Umsetzungssitzung.

---

Paket **RS** (`docs/PAKETE.md`, Zeile RS) legt fest, **wem was angezeigt wird**. Es ändert Sichtbarkeit und Aufbau, bei der abgespeckten Team-Ansicht auch den **Zuschnitt der Serverdaten**
(Datensparsamkeit). Rechte werden weiter nur serverseitig geprüft. Alle Entscheidungen des Vorstands sind in der Zeile eingearbeitet.

## Zuerst
1. `CLAUDE.md`; Planungsstand mergen (`git fetch origin claude/app-entwicklung-planung-183gtv`).
2. `docs/PAKETE.md`, Zeile **RS** (Befunde, Entscheidungen, Festlegung zum Abschluss A–E) und `docs/ROLLEN.md`.
3. Prüfskript `pnpm browser-check scripts/e2e/review-rollen.mjs --no-build` (Ergebnisse `.check/rollen/<rolle>.json`); Referenzen für den Look in `docs/design/anstoss/index.html`.

## Aufgaben (jeweils eigener Commit, `pnpm check`)
1. **Admin-Karte:** `canOpenAdmin` in `apps/mobile/src/lib/areas.ts` zählt `me.news.write/publish` mit – dadurch sehen Trainer, Co-Trainer/Eltern und Mitglieder die Karte „Admin-Verwaltung“ und
   landen auf „Keine Berechtigung“. Bedingung nur noch `me.canAdminister || Object.values(me.admin).some(Boolean)`. „News schreiben“ bleibt in Verein → Verwaltung. **Seitenwächter:** `/admin` und
   `/club-cash` leiten Personen ohne Recht auf Mehr um (kurzer Hinweis).
2. **Kartenabstände:** Karten in Stapeln und Listen **14 px** Abstand, Hero zu erster Karte 14 px; Stapel-Baustein (`Stack gap=14`) in `components/ui.tsx`; auf allen Seiten mit Kartenstapeln anwenden
   (Team-Übersicht der Leitung, Aufgaben, News, Dokumente, Helfer, Rollen, Mannschaften & Saison u. a.). Prüfskript misst die Lücke zwischen benachbarten Karten (Soll 14, mindestens 12).
3. **Home ohne Mannschaft:** „Noch keine Mannschaft“ entfällt. Rangfolge im Plakat: nächstes Spiel → nächste Vereinstermine (Wisch-Plakat, bis zu drei) → Vereinskassenstand (nur Kassenwart/Prüfer ohne
   Termin) → **Vereinsübersicht** → Willkommensplakat (neue Person). Vereinsübersicht: Eyebrow „DEIN VEREIN“, große Zahl Mitgliederzahl („Mitglieder“), Kurzname, Zeile
   „{n} Abteilungen · {n} Mannschaften · {n} Spiele diese Woche“, Knöpfe „Verein entdecken“ und (nur mit Verwaltungsrecht) „Zur Verwaltung“; bei anstehendem Vereinstermin ist sie die zweite Folie.
   Waben-Hintergrund und Vereinsfarbe wie das Plakat (`docs/DESIGN-ANSTOSS.md`). Vorstand/Admin: kleine Zeile „Du bist keiner Mannschaft zugeordnet“ unter dem Plakat.
4. **Team-Reiter ohne eigene Mannschaft:** **Kassenwart** bekommt die volle Leitungsansicht (wie Vorstand, Sportliche Leitung, Admin). **Mitglied ohne Zuordnung** bekommt die **abgespeckte Ansicht**:
   Hero „GESAMTER VEREIN“ mit Mannschaftszahl, Spieler, Trainer, Spiele diese Woche (ohne „Training Ø“, ohne „Bilanz Saison“); Mannschaftskachel nur Kürzel und Name, Spielerzahl, Trainer, nächstes Spiel
   (ohne Zusagen-Balken, Verfügbarkeit, Beteiligung, Spielernamen); Antippen öffnet die öffentliche Mannschaftsseite (kein Kader); unten Hinweis „Du möchtest mitspielen? Frag den Trainer nach einem
   Einladungscode.“ mit Knopf „Code eingeben“. Der Reiter bleibt für sie sichtbar.
5. **Datensparsamkeit (Server):** die abgespeckte Ansicht liefert nur die erlaubten Felder (Mitglieder ohne Zuordnung bekommen keine Zusagen, Verfügbarkeit, Beteiligung, Namen). Feldfilter oder eigener
   Zuschnitt in `apps/api`, **Test in `api.test.ts`** (Mitglied ohne Mannschaft darf diese Felder nicht erhalten).
6. **Rest:** Kassenprüfer sieht die Vereinskasse weiterhin in Mehr **und** Verein (so lassen). Demo-Konten bleiben vorerst unverändert.

## Abnahme
`review-rollen.mjs` je Rolle: Admin-Karte nur bei Verwaltungsrecht; Home ohne Mannschaft zeigt nie „Noch keine Mannschaft“; `/admin` als Trainer führt auf Mehr; Team-Reiter Mitglied = abgespeckt,
Kassenwart = voll; Abstände zwischen Karten 14 px. Am Ende kurze Liste: erledigt / bewusst abweichend / offen.
