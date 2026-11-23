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

Journalistin. [Die Berufsbezeichnung ist in Deutschland nicht gesetzlich geschützt, eine Kammer oder berufsrechtliche Regelung gibt es nicht. Optional: Mitgliedschaft in einem Berufsverband nennen, z. B. DJV.]

## Verantwortlich für journalistisch-redaktionelle Inhalte (§ 18 Abs. 2 MStV)

Antonia Rüller, Anschrift wie oben. [Nur nötig, wenn die Seite als journalistisch-redaktionelles Angebot gilt. Sonst diesen Abschnitt streichen.]

## Umsatzsteuer-ID

[Falls vorhanden: Umsatzsteuer-Identifikationsnummer gemäß § 27a UStG: DE123456789. Falls keine vorhanden ist, diesen Abschnitt streichen.]

## Verlinkte Beiträge und Inhalte Dritter

Diese Seite verweist auf Beiträge, die bei Radio Bremen, im ARD-Verbund, beim WDR und bei weiteren Redaktionen erschienen sind. Für die Inhalte der verlinkten Seiten sind allein die jeweiligen Anbieter verantwortlich. Die Rechte an den dort veröffentlichten Beiträgen liegen bei den jeweiligen Sendern und Redaktionen. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar. Bei Bekanntwerden von Rechtsverletzungen werden solche Links umgehend entfernt.

## Urheberrecht

Texte und Gestaltung dieser Seite unterliegen dem Urheberrecht. Fotos: [Fotografin bzw. Fotograf nennen]. Eine Vervielfältigung, Bearbeitung oder Verbreitung außerhalb der Grenzen des Urheberrechts bedarf der schriftlichen Zustimmung der jeweiligen Rechteinhaber.

## Verbraucherstreitbeilegung

[Prüfen und ggf. anpassen:] Ich bin weder bereit noch verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.
TXT;

    $datenschutz = <<<'TXT'
## Datenschutzerklärung

Der Schutz deiner personenbezogenen Daten ist mir wichtig. Hier erfährst du, welche Daten beim Besuch dieser Website verarbeitet werden und welche Rechte du hast.

## 1. Verantwortliche

Verantwortlich im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:

Antonia Rüller
[Straße und Hausnummer einfügen]
[PLZ] [Ort]
E-Mail: [E-Mail-Adresse einfügen]

## 2. Das Wichtigste in Kürze

- Für Besucherinnen und Besucher werden keine Cookies gesetzt.
- Es gibt keine Analyse-, Tracking- oder Werbedienste.
- Schriften sind auf dem eigenen Server gespeichert; es gibt keine Verbindung zu Google Fonts oder ähnlichen Diensten.
- Es werden keine Inhalte Dritter (Videos, Karten, Social-Media-Plugins) eingebunden.

## 3. Hosting und Server-Logfiles

Diese Website wird bei IONOS SE, Elgendorfer Str. 57, 56410 Montabaur, gehostet. Mit dem Anbieter besteht ein Vertrag zur Auftragsverarbeitung nach Art. 28 DSGVO.

Beim Aufruf der Website verarbeitet der Webserver technisch notwendige Daten, die dein Browser automatisch übermittelt: IP-Adresse, Datum und Uhrzeit, aufgerufene Seite bzw. Datei, übertragene Datenmenge, Statuscode sowie Browsertyp und Betriebssystem. Die Verarbeitung dient der sicheren und stabilen Bereitstellung der Website. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse am sicheren Betrieb). Die Logfiles werden nach kurzer Zeit gelöscht, [Speicherdauer laut Angaben des Hosters ergänzen, z. B. 7 Tage – bitte prüfen]. Eine Zusammenführung mit anderen Daten findet nicht statt.

## 4. Verschlüsselung

Die Verbindung zu dieser Website ist per TLS (https) verschlüsselt.

## 5. Kontaktaufnahme per E-Mail

Wenn du mir eine E-Mail schreibst, verarbeite ich deine Angaben (E-Mail-Adresse, Name, Inhalt der Nachricht) zur Bearbeitung deiner Anfrage. Rechtsgrundlage ist Art. 6 Abs. 1 lit. b DSGVO, wenn es um vorvertragliche oder vertragliche Fragen geht, sonst Art. 6 Abs. 1 lit. f DSGVO (Interesse an der Beantwortung von Anfragen). Die Daten werden gelöscht, sobald die Anfrage erledigt ist und keine gesetzlichen Aufbewahrungspflichten entgegenstehen.

Bei vertraulichen Hinweisen und Recherchethemen beachte bitte, dass normale E-Mails nicht durchgehend verschlüsselt übertragen werden. [Optional: Hinweis auf einen verschlüsselten Kontaktweg ergänzen, z. B. Signal oder PGP.]

## 6. Externe Links

Diese Seite enthält Links zu Beiträgen bei Redaktionen und zu LinkedIn (LinkedIn Ireland Unlimited Company, Wilton Plaza, Wilton Place, Dublin 2, Irland). Es werden keine Daten an diese Anbieter übertragen, solange du die Links nicht anklickst. Nach dem Klick gelten die Datenschutzbestimmungen des jeweiligen Anbieters.

## 7. Speicherung im Browser

Die Seite speichert nichts in deinem Browser (kein Local Storage, keine Cookies für Besucherinnen und Besucher).

## 8. Deine Rechte

Du hast gegenüber mir das Recht auf Auskunft (Art. 15 DSGVO), Berichtigung (Art. 16), Löschung (Art. 17), Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch gegen Verarbeitungen auf Grundlage berechtigter Interessen (Art. 21). Wende dich dazu an die oben genannte E-Mail-Adresse.

Du hast außerdem das Recht, dich bei einer Datenschutz-Aufsichtsbehörde zu beschweren (Art. 77 DSGVO). [Zuständige Behörde ergänzen und prüfen. Bei Wohnsitz in Bremen z. B.: Die Landesbeauftragte für Datenschutz und Informationsfreiheit der Freien Hansestadt Bremen, Arndtstraße 1, 27570 Bremerhaven, www.datenschutz.bremen.de]

## 9. Änderungen

Ich passe diese Erklärung an, wenn sich die Website oder die Rechtslage ändert. Stand: [Datum einfügen].
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
