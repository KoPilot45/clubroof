<?php
declare(strict_types=1);

/**
 * Vorlagen für Impressum und Datenschutz. Angaben in [eckigen Klammern] müssen im Admin ersetzt
 * oder gelöscht werden. Keine Rechtsberatung – vor Veröffentlichung bitte prüfen (lassen).
 */
function legal_defaults(): array
{
    $impressum = <<<'TXT'
## Angaben gemäß § 5 DDG

Antonia Rüller
[Straße und Hausnummer einfügen]
[PLZ] [Ort]
Deutschland

## Kontakt

E-Mail: [E-Mail-Adresse einfügen]
Telefon: [Telefonnummer einfügen – optional, sofern eine schnelle Kontaktaufnahme per E-Mail möglich ist]

## Berufsbezeichnung

Journalistin. [Die Berufsbezeichnung ist in Deutschland nicht gesetzlich geschützt. Optional: Mitgliedschaft in einem Berufsverband nennen, z. B. DJV.]

## Verantwortlich für journalistisch-redaktionelle Inhalte (§ 18 Abs. 2 MStV)

Antonia Rüller, Anschrift wie oben. [Nur nötig, wenn die Seite als journalistisch-redaktionelles Angebot gilt. Sonst diesen Abschnitt streichen.]

## Umsatzsteuer-ID

[Falls vorhanden: Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG. Falls keine vorhanden ist, diesen Abschnitt streichen.]

## Verlinkte Beiträge und Inhalte Dritter

Diese Seite verweist auf Beiträge, die bei Radio Bremen, im ARD-Verbund, beim WDR und bei weiteren Redaktionen erschienen sind, sowie auf Plattformen wie YouTube, Spotify, Apple Podcasts und die ARD Audiothek. Für die Inhalte der verlinkten Seiten sind allein die jeweiligen Anbieter verantwortlich. Die Rechte an den dort veröffentlichten Beiträgen liegen bei den jeweiligen Sendern, Redaktionen und Plattformen. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Bei Bekanntwerden von Rechtsverletzungen werden solche Links umgehend entfernt.

## Urheberrecht

Texte und Gestaltung dieser Seite unterliegen dem Urheberrecht. Fotos: [Fotografin bzw. Fotograf nennen]. Eine Vervielfältigung, Bearbeitung oder Verbreitung außerhalb der Grenzen des Urheberrechts bedarf der schriftlichen Zustimmung der jeweiligen Rechteinhaber.

## Verbraucherstreitbeilegung

An Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle wird weder teilgenommen, noch besteht dazu eine Verpflichtung.
TXT;

    $datenschutz = <<<'TXT'
## Datenschutzerklärung

Der Schutz personenbezogener Daten hat einen hohen Stellenwert. Diese Erklärung informiert darüber, welche Daten beim Besuch dieser Website verarbeitet werden und welche Rechte betroffenen Personen zustehen.

## 1. Verantwortliche

Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:

Antonia Rüller
[Straße und Hausnummer einfügen]
[PLZ] [Ort]
E-Mail: [E-Mail-Adresse einfügen]

## 2. Das Wichtigste in Kürze

- Für Besucherinnen und Besucher werden keine Cookies gesetzt.
- Es gibt keine Tracking- oder Werbedienste. Besuche werden ohne Cookies und ohne Speicherung von IP-Adressen gezählt (siehe Abschnitt „Reichweitenmessung“).
- Schriften sind auf dem eigenen Server gespeichert; es gibt keine Verbindung zu Google Fonts oder ähnlichen Diensten.
- Es werden keine Inhalte Dritter (Videos, Karten, Social-Media-Plugins) eingebunden. Verlinkte Angebote anderer Anbieter werden erst nach einem Klick geöffnet (siehe Abschnitt „Externe Links“).

## 3. Hosting und Server-Logfiles

Diese Website wird bei IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, gehostet. Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.

Beim Aufruf der Website verarbeitet der Webserver technisch notwendige Daten, die der Browser automatisch übermittelt: Datum und Uhrzeit, aufgerufene Seite bzw. Datei, übertragene Datenmenge, Statuscode sowie Browsertyp und Betriebssystem. Die IP-Adresse wird dabei technisch kurzzeitig verarbeitet; in den Logfiles des Hosters wird sie nur anonymisiert gespeichert. Die Verarbeitung dient der sicheren und stabilen Bereitstellung der Website. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb). Die Logfiles werden vom Hoster für höchstens 8 Wochen aufbewahrt und danach automatisch gelöscht. Eine Zusammenführung mit anderen Daten findet nicht statt.

## 4. Reichweitenmessung ohne Cookies

Auf dem eigenen Server wird anonym gezählt, wie oft die Seite aufgerufen wird und welche Bereiche genutzt werden. Dabei werden Datum und Uhrzeit (nur die Stunde), die aufgerufene Seite, der Gerätetyp (Handy oder Rechner) und die verweisende Domain erfasst. Die IP-Adresse wird dafür nur kurz verarbeitet, damit ein Gerät pro Stunde nur einmal gezählt wird; sie wird nicht gespeichert, und der dabei gebildete Kurzwert wird am Ende der Stunde gelöscht. Es werden keine Cookies oder andere Daten im Browser gespeichert, und es entstehen keine Nutzerprofile. Auch Klicks auf einzelne Verknüpfungen und erreichte Abschnitte werden nur als anonyme Summen gezählt. Aufgerufene Adressen, die nicht existieren, werden ohne IP-Adresse als Summe erfasst. Stundenwerte werden nach 90 Tagen zu Tageswerten zusammengefasst. Browser mit aktivierter Einstellung „Do Not Track“ werden nicht gezählt. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse an einer bedarfsgerechten Gestaltung des Angebots).

## 5. Verschlüsselung

Die Verbindung zu dieser Website ist per TLS (https) verschlüsselt.

## 6. Kontaktaufnahme per E-Mail

Bei einer Kontaktaufnahme per E-Mail werden die übermittelten Angaben (E-Mail-Adresse, Name, Inhalt der Nachricht) zur Bearbeitung der Anfrage verarbeitet. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, wenn es um vorvertragliche oder vertragliche Fragen geht, sonst Art. 6 Abs. 1 lit. f DSGVO (Interesse an der Beantwortung von Anfragen). Die Daten werden gelöscht, sobald die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.

Bei vertraulichen Hinweisen und Recherchethemen ist zu beachten, dass normale E-Mails nicht durchgehend verschlüsselt übertragen werden.

## 7. Externe Links

Diese Seite enthält Links zu Beiträgen bei Redaktionen sowie zu Profilen und Plattformen, auf denen Beiträge zu sehen oder zu hören sind. Dazu zählen LinkedIn (LinkedIn Ireland Unlimited Company, Wilton Plaza, Wilton Place, Dublin 2, Irland), YouTube (Google Ireland Limited, Gordon House, Barrow Street, Dublin 4, Irland), Spotify (Spotify AB, Regeringsgatan 19, 111 53 Stockholm, Schweden), Apple Podcasts (Apple Distribution International Ltd., Hollyhill Industrial Estate, Hollyhill, Cork, Irland) und die ARD Audiothek sowie weitere Audio- und Videoangebote von Sendern und Plattformen. Es werden keine Videos oder Player dieser Anbieter eingebunden. Daten werden an diese Anbieter erst übertragen, wenn ein Link angeklickt wird. Danach gelten die Datenschutzbestimmungen des jeweiligen Anbieters; dabei können Daten auch in Ländern außerhalb der EU verarbeitet werden.

## 8. Speicherung im Browser

Die Seite speichert nichts im Browser (kein Local Storage, keine Cookies für Besucherinnen und Besucher).

## 9. Rechte betroffener Personen

Betroffenen Personen stehen gegenüber der Verantwortlichen die Rechte auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch (Art. 21) zu. Anfragen sind an die oben genannte E-Mail-Adresse zu richten.

## 10. Widerspruchsrecht

Soweit Daten auf Grundlage berechtigter Interessen (Art. 6 Abs. 1 lit. f DSGVO) verarbeitet werden, kann dieser Verarbeitung jederzeit aus Gründen, die sich aus der besonderen Situation der betroffenen Person ergeben, widersprochen werden (Art. 21 Abs. 1 DSGVO). Dazu genügt eine Nachricht an die oben genannte E-Mail-Adresse. Die Verarbeitung wird dann beendet, es sei denn, es liegen zwingende schutzwürdige Gründe vor, die überwiegen.

## 11. Beschwerderecht

Es besteht das Recht, sich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO), insbesondere in dem Land, in dem die betroffene Person lebt oder arbeitet oder in dem der mutmaßliche Verstoß stattgefunden hat. Zuständig für die Verantwortliche ist: Die Landesbeauftragte für Datenschutz und Informationsfreiheit der Freien Hansestadt Bremen, Arndtstraße 1, 27570 Bremerhaven, [www.datenschutz.bremen.de](https://www.datenschutz.bremen.de)

## 12. Änderungen

Diese Erklärung wird angepasst, wenn sich die Website oder die Rechtslage ändert. Stand: 25.11.2026.
TXT;

    return ['impressum' => $impressum, 'datenschutz' => $datenschutz];
}

/** Frühere Platzhaltertexte (werden durch die Vorlagen ersetzt, solange sie unverändert sind). */
function legal_old_placeholders(): array
{
    return [
        "## Angaben gemäß § 5 DDG\n\n[Name, Anschrift und Kontaktdaten hier im Admin unter „Impressum & Datenschutz“ eintragen]",
        "## Datenschutzerklärung\n\n[Text hier im Admin eintragen. Diese Seite setzt keine Cookies, bindet keine externen Schriften ein und nutzt keine Tracker.]",
    ];
}

/** Ergänzung für bereits veröffentlichte Texte (Reichweitenmessung). */
function privacy_stats_patch(string $text): ?string
{
    if (str_contains($text, 'Reichweitenmessung') || !str_contains($text, '- Es gibt keine Analyse-, Tracking- oder Werbedienste.') || !str_contains($text, '## 4. Verschlüsselung')) {
        return null;
    }
    $text = str_replace('- Es gibt keine Analyse-, Tracking- oder Werbedienste.', '- Es gibt keine Tracking- oder Werbedienste. Besuche werden ohne Cookies und ohne Speicherung von IP-Adressen gezählt (siehe Abschnitt „Reichweitenmessung“).', $text);
    $sec = "## 3a. Reichweitenmessung ohne Cookies\n\nUm zu verstehen, wie oft die Seite besucht wird, werden Seitenaufrufe und Besuche auf diesem Server gezählt: Es werden nur Datum und Uhrzeit (Stunde), die aufgerufene Seite, der Gerätetyp (Handy oder Rechner) und die verweisende Internetadresse (Domain) festgehalten. Damit ein Gerät pro Stunde nur einmal als Besuch zählt, wird aus IP-Adresse und Browserkennung mit einem zufälligen Schlüssel ein nicht umkehrbarer Kurzwert gebildet und nur bis zum Ende der laufenden Stunde auf dem Server vorgehalten; danach wird er samt Schlüssel gelöscht. Die IP-Adresse selbst wird nicht gespeichert, es werden keine Cookies oder sonstigen Speicherungen im Browser eingesetzt, und es entsteht kein Profil über mehrere Stunden. Bots und Browser mit „Do Not Track“ werden nicht gezählt. Zusätzlich werden anonyme Summen erfasst, wie oft bestimmte Verknüpfungen angeklickt werden (z. B. einzelne Beiträge, die E-Mail-Schaltfläche, der Lebenslauf-Download) und welche Abschnitte der Seite erreicht werden – ohne Kennung und ohne Speicherung im Browser; ein Gerät wird je Stunde und Ereignis höchstens einmal gezählt. Bekannte Suchmaschinen-Crawler und nicht vorhandene aufgerufene Adressen werden nur als Summen erfasst. Einzelne Stundenwerte werden nach 90 Tagen zu Tageswerten zusammengefasst. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (Interesse an der bedarfsgerechten Gestaltung des Angebots).\n\n";
    return str_replace('## 4. Verschlüsselung', $sec . '## 4. Verschlüsselung', $text);
}

/** Neuer Wortlaut zur Besuchserkennung (Deutsch/Englisch) für bereits gespeicherte Texte. */
function privacy_stats_v2_pairs(): array
{
    return [
        'de' => [['wird jeder Seitenaufruf auf diesem Server gezählt', 'werden Seitenaufrufe und Besuche auf diesem Server gezählt'], ['Es wird keine IP-Adresse gespeichert, Besucherinnen und Besucher werden nicht wiedererkannt, und es werden keine Cookies gesetzt.', 'Damit ein Gerät pro Stunde nur einmal als Besuch zählt, wird aus IP-Adresse und Browserkennung mit einem zufälligen Schlüssel ein nicht umkehrbarer Kurzwert gebildet und nur bis zum Ende der laufenden Stunde auf dem Server vorgehalten; danach wird er samt Schlüssel gelöscht. Die IP-Adresse selbst wird nicht gespeichert, es werden keine Cookies oder sonstigen Speicherungen im Browser eingesetzt, und es entsteht kein Profil über mehrere Stunden.'], ['Seitenaufrufe werden ohne Cookies und ohne IP-Adresse gezählt', 'Besuche werden ohne Cookies und ohne Speicherung von IP-Adressen gezählt']],
        'en' => [['each page view is counted on this server', 'page views and visits are counted on this server'], ['No IP address is stored, visitors are not recognised, and no cookies are used.', 'To make sure a device counts as only one visit per hour, an irreversible short value is formed from the IP address and browser identifier using a random key; it is kept on the server only until the end of the current hour and then deleted together with the key. The IP address itself is not stored, no cookies or other browser storage are used, and no profile across several hours is created.'], ['Page views are counted without cookies and without IP addresses', 'Visits are counted without cookies and without storing IP addresses']],
    ];
}

/** Ergänzung für Ereigniszähler, Crawler und 404 (bereits gespeicherte Texte). */
function privacy_stats_v4_pairs(): array
{
    return [
        'de' => [['Bots und Browser mit „Do Not Track“ werden nicht gezählt.', 'Bots und Browser mit „Do Not Track“ werden nicht gezählt. Zusätzlich werden anonyme Summen erfasst, wie oft bestimmte Verknüpfungen angeklickt werden (z. B. einzelne Beiträge, die E-Mail-Schaltfläche, der Lebenslauf-Download) und welche Abschnitte der Seite erreicht werden – ohne Kennung und ohne Speicherung im Browser; ein Gerät wird je Stunde und Ereignis höchstens einmal gezählt. Bekannte Suchmaschinen-Crawler und nicht vorhandene aufgerufene Adressen werden nur als Summen erfasst. Einzelne Stundenwerte werden nach 90 Tagen zu Tageswerten zusammengefasst.']],
        'en' => [['Bots and browsers with “Do Not Track” enabled are not counted.', 'Bots and browsers with “Do Not Track” enabled are not counted. In addition, anonymous totals are recorded for how often certain links are clicked (e.g. individual stories, the email button, the CV download) and which sections of the page are reached – without any identifier and without storage in the browser; a device is counted at most once per hour and event. Known search-engine crawlers and non-existent addresses requested are recorded only as totals. Hourly values are condensed into daily values after 90 days.']],
    ];
}
