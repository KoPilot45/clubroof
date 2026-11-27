<?php
declare(strict_types=1);

/**
 * Export und Import der Übersetzungen (Deutsch → Englisch): Tabelle als JSON oder CSV für eine KI,
 * Import mit Vorschau und Prüfung. Gespeichert wird über save_translations().
 */

/** Zeilen für den Export. $scope: 'open' (offen und veraltet) oder 'all'; $area: leer oder Bereichsschlüssel. */
function tio_rows(string $scope = 'open', string $area = ''): array
{
    $out = [];
    foreach (translation_rows() as $r) {
        $isOpen = trim((string)$r['en']) === '';
        $isStale = !empty($r['stale']);
        if ($scope !== 'all' && !$isOpen && !$isStale) {
            continue;
        }
        if ($area !== '' && $r['area_key'] !== $area) {
            continue;
        }
        $r['status'] = $isOpen ? 'offen' : ($isStale ? 'veraltet' : 'übersetzt');
        $out[] = $r;
    }
    return $out;
}

function tio_context(array $r): string
{
    return trim($r['area'] . ($r['item'] !== '' ? ' · ' . $r['item'] : '') . ' · ' . $r['label']);
}

function tio_export_json(array $rows): string
{
    $texts = [];
    foreach ($rows as $r) {
        $texts[] = [
            'key' => $r['key'], 'context' => tio_context($r), 'status' => $r['status'], 'de' => $r['de'], 'en' => $r['en'],
            'max_chars' => (int)$r['max'], 'multiline' => (bool)$r['multi'],
        ];
    }
    return json_encode([
        'about' => 'Texte der Website antoniarueller.de. Übersetze "de" (Deutsch) nach "en" (Englisch). Nur das Feld "en" füllen, "key" nie ändern.',
        'count' => count($texts),
        'texts' => $texts,
    ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT) . "\n";
}

function tio_export_csv(array $rows): string
{
    $fh = fopen('php://temp', 'r+');
    fputcsv($fh, ['key', 'Bereich', 'Status', 'Deutsch', 'Englisch', 'max_Zeichen'], ';', '"', '');
    foreach ($rows as $r) {
        fputcsv($fh, [$r['key'], tio_context($r), $r['status'], $r['de'], $r['en'], (int)$r['max']], ';', '"', '');
    }
    rewind($fh);
    $csv = (string)stream_get_contents($fh);
    fclose($fh);
    return "\xEF\xBB\xBF" . $csv;
}

/** Datei oder eingefügter Text (JSON oder CSV) → [Eintraege key => ['en' => …, 'de' => …|null], Fehlermeldung]. */
function tio_parse(string $raw): array
{
    $raw = trim(preg_replace('~^\xEF\xBB\xBF~', '', $raw));
    if ($raw === '') {
        return [[], 'Es wurde nichts eingefügt.'];
    }
    $entries = [];
    if ($raw[0] === '{' || $raw[0] === '[' || str_starts_with($raw, '```')) {
        $raw = trim(preg_replace('~^```[a-z]*\s*|\s*```$~i', '', $raw)); // KI-Antworten kommen oft in einem Codeblock
        $j = json_decode($raw, true);
        if (!is_array($j)) {
            return [[], 'Das ist kein gültiges JSON. Bitte die vollständige Antwort der KI einfügen (ab der ersten geschweiften Klammer).'];
        }
        $list = isset($j['texts']) && is_array($j['texts']) ? $j['texts'] : $j;
        foreach ($list as $k => $t) {
            if (is_array($t) && isset($t['key'])) {
                $entries[(string)$t['key']] = ['en' => (string)($t['en'] ?? ''), 'de' => isset($t['de']) ? (string)$t['de'] : null];
            } elseif (is_string($t) && is_string($k)) {
                $entries[$k] = ['en' => $t, 'de' => null]; // einfache Form {"schlüssel": "text"}
            }
        }
    } else {
        $fh = fopen('php://temp', 'r+');
        fwrite($fh, $raw);
        rewind($fh);
        $head = fgetcsv($fh, 0, ';', '"', '');
        if (!$head) {
            return [[], 'Die Tabelle ist leer.'];
        }
        $ix = array_flip(array_map(fn($h) => mb_strtolower(trim((string)$h)), $head));
        $ik = $ix['key'] ?? null;
        $ie = $ix['englisch'] ?? ($ix['en'] ?? null);
        $id = $ix['deutsch'] ?? ($ix['de'] ?? null);
        if ($ik === null || $ie === null) {
            return [[], 'In der Tabelle fehlen die Spalten „key“ und „Englisch“.'];
        }
        while (($row = fgetcsv($fh, 0, ';', '"', '')) !== false) {
            if (isset($row[$ik]) && trim((string)$row[$ik]) !== '') {
                $entries[trim((string)$row[$ik])] = ['en' => (string)($row[$ie] ?? ''), 'de' => $id !== null ? (string)($row[$id] ?? '') : null];
            }
        }
        fclose($fh);
    }
    if (!$entries) {
        return [[], 'Es wurden keine Texte gefunden. Erwartet wird die Liste "texts" mit "key" und "en".'];
    }
    return [$entries, ''];
}

/** Zeichen, die beim Übersetzen erhalten bleiben müssen: Markierungen, Zahlen, Links, Adressen. */
function tio_tokens(string $s): array
{
    preg_match_all('~https?://\S+|[\w.+-]+@[\w-]+\.[\w.-]+|\d[\d.,:/]*~u', $s, $m);
    return array_values(array_unique($m[0]));
}

/**
 * Plan für den Import. Jede Zeile: status ok | warn (wird übernommen, mit Hinweis) | skip (wird nicht übernommen).
 * $overwrite: bereits vorhandene, aktuelle englische Texte ersetzen (veraltete werden immer ersetzt).
 */
function tio_plan(array $entries, bool $overwrite): array
{
    $rows = [];
    foreach (translation_rows() as $r) {
        $rows[$r['key']] = $r;
    }
    $plan = [];
    foreach ($entries as $key => $e) {
        $r = $rows[$key] ?? null;
        $new = trim(str_replace("\r\n", "\n", (string)$e['en']));
        $line = ['key' => $key, 'area' => $r ? $r['area'] : '', 'label' => $r ? tio_context($r) : $key, 'de' => $r ? $r['de'] : '', 'old' => $r ? $r['en'] : '', 'new' => $new, 'status' => 'ok', 'msg' => ''];
        $skip = function (string $m) use (&$line) {
            $line['status'] = 'skip';
            $line['msg'] = $m;
        };
        if (!$r) {
            $skip('Unbekannter Schlüssel (Text existiert nicht mehr).');
        } elseif ($new === '') {
            $skip('Keine englische Übersetzung.');
        } elseif ($e['de'] !== null && trim(str_replace("\r\n", "\n", $e['de'])) !== trim(str_replace("\r\n", "\n", $r['de']))) {
            $skip('Der deutsche Text wurde seit dem Export geändert.');
        } elseif ($new === trim((string)$r['en'])) {
            $skip('Unverändert.');
        } elseif (trim((string)$r['en']) !== '' && empty($r['stale']) && !$overwrite) {
            $skip('Es gibt schon eine aktuelle englische Fassung (nicht überschrieben).');
        } elseif (mb_strlen($new) > (int)$r['max']) {
            $skip('Zu lang: ' . mb_strlen($new) . ' von höchstens ' . (int)$r['max'] . ' Zeichen.');
        } elseif (preg_match('~<\s*/?\s*[a-z][^>]*>~i', $new) && !preg_match('~<\s*/?\s*[a-z][^>]*>~i', $r['de'])) {
            $skip('Enthält HTML, das im deutschen Text nicht vorkommt.');
        } elseif (substr_count($new, '**') !== substr_count($r['de'], '**') || substr_count($new, '==') !== substr_count($r['de'], '==') || substr_count($new, '*') !== substr_count($r['de'], '*')) {
            $skip('Die Markierungen (*kursiv*, **GROSS**, ==Akzent==) stimmen nicht mit dem Deutschen überein.');
        } else {
            $warn = [];
            $missing = array_filter(tio_tokens($r['de']), fn($t) => !str_contains($new, $t));
            if ($missing) {
                $warn[] = 'Zahl oder Link prüfen: ' . implode(', ', array_slice($missing, 0, 4));
            }
            if (!$r['multi'] && str_contains($new, "\n")) {
                $warn[] = 'Zeilenumbruch wird entfernt.';
            }
            if ($r['multi'] && substr_count($r['de'], "\n\n") > 0 && substr_count($new, "\n\n") === 0) {
                $warn[] = 'Absätze des Deutschen fehlen.';
            }
            if ($warn) {
                $line['status'] = 'warn';
                $line['msg'] = implode(' ', $warn);
            }
        }
        $plan[] = $line;
    }
    return $plan;
}

/** Zeilen mit Status ok oder warn speichern. Gibt die Zahl gespeicherter Texte zurück. */
function tio_apply(array $plan): int
{
    $changes = [];
    foreach ($plan as $l) {
        if ($l['status'] !== 'skip') {
            $changes[$l['key']] = $l['new'];
        }
    }
    return $changes ? save_translations($changes) : 0;
}

/** Vorgeschlagener Prompt für die KI-Übersetzung. */
function tio_prompt(): string
{
    return <<<'TXT'
Du bist Übersetzer und Lektor für journalistische Texte. Übersetze die Texte der Website einer Journalistin (Recherche, Radio, Podcast, Video) vom Deutschen ins Englische.

Anhang: Eine Datei im JSON-Format mit der Liste "texts". Jeder Eintrag hat "key", "context" (wo der Text steht), "status", "de" (deutscher Text), "en" (englische Fassung, oft leer), "max_chars" und "multiline".

Aufgabe:
- Fülle für jeden Eintrag das Feld "en" mit der englischen Übersetzung von "de". Bei Einträgen mit Status "veraltet" ist die vorhandene "en"-Fassung überholt: übersetze neu.
- Ändere niemals "key", "de" oder andere Felder. Gib die komplette Liste im gleichen JSON-Format zurück, als reines JSON ohne zusätzlichen Text.

Regeln:
1. Ton: sachlich, direkt, persönlich, unaufgeregt, ohne Werbesprache und ohne Übertreibung. Kurze Sätze bleiben kurz. Die Texte sind aus der Ich-Perspektive der Journalistin geschrieben.
2. Eigennamen und Markennamen werden NICHT übersetzt: Sender, Redaktionen, Formate, Sendungen, Podcasts, Medienhäuser, Verlage, Orte, Personen und Produkte bleiben wie im Deutschen (z. B. WDR, ARD, Radio Bremen, buten un binnen, Y-Kollektiv, MordOrte, WDR aktuell, Lokalzeit, Welt).
3. Feste Begriffe: "Off the record" bleibt "Off the record", "Showreel" bleibt "Showreel", "On Air" bleibt "On Air". Berufsbezeichnungen und Ressorts werden üblich übersetzt (Journalistin → journalist, Reporterin → reporter, Recherche → investigative reporting oder research, je nach Zusammenhang).
4. Markierungen im Text bleiben genau erhalten und stehen an der sinngemäß passenden Stelle: *kursiv*, **GROSS** und ==Akzent==. Anzahl und Art der Sternchen und Gleichheitszeichen müssen mit dem Deutschen übereinstimmen.
5. Zahlen, Jahreszahlen, Links, E-Mail-Adressen, Zeilenumbrüche und Absätze bleiben erhalten. Bei "multiline": false keine Zeilenumbrüche. Texte im Markdown-Stil (Überschriften mit ##, Aufzählungen mit -) behalten ihre Struktur.
6. Beachte "max_chars": Die englische Fassung darf nicht länger sein. Ist sie sonst zu lang, kürze sinngemäß.
7. Keine HTML-Tags, keine Erklärungen, keine Kommentare, keine Anführungszeichen um den ganzen Text.
8. Bei Unsicherheit: Rate nicht. Wenn ein Begriff, ein Name oder ein Zusammenhang unklar ist (z. B. ob etwas ein Markenname ist, oder mehrere Übersetzungen sinnvoll möglich sind), stelle mir vor der Übersetzung gesammelt kurze Rückfragen und warte auf meine Antwort.

Beginne mit eventuellen Rückfragen. Wenn alles klar ist, gib sofort das vollständige JSON zurück.
TXT;
}
