/**
 * „Über Clubroof“: Beispieltexte, bis AGB, Datenschutzerklärung und Impressum juristisch geprüft
 * und final sind (docs/PAKETE.md, Paket „Über Clubroof“). Die Texte hier sind Platzhalter.
 */

export type AboutPageKey = 'agb' | 'datenschutz' | 'impressum' | 'changelog';

export interface AboutSection {
  heading: string;
  text: string;
}

export interface AboutPage {
  title: string;
  intro: string;
  sections: AboutSection[];
}

/** Externe Seiten; die Adressen sind Platzhalter bis zur fertigen Webseite. */
export const ABOUT_LINKS = {
  support: 'https://clubroof.example/support',
  featureRequest: 'https://clubroof.example/funktion-anfragen',
} as const;

export const ABOUT_PAGES: Record<AboutPageKey, AboutPage> = {
  agb: {
    title: 'Allgemeine Geschäftsbedingungen',
    intro: 'Stand: Beispieltext. Diese Bedingungen regeln die Nutzung von Clubroof.',
    sections: [
      {
        heading: '1. Geltungsbereich',
        text: 'Diese Bedingungen gelten für die Nutzung der App und der Web-Verwaltung von Clubroof durch Vereine und ihre Mitglieder.',
      },
      {
        heading: '2. Leistungen',
        text: 'Clubroof stellt Funktionen zur Organisation eines Sportvereins bereit, zum Beispiel Termine, Kader, Mitteilungen und Kassen. Der Umfang richtet sich nach den vom Verein aktivierten Modulen.',
      },
      {
        heading: '3. Pflichten der Nutzer',
        text: 'Zugangsdaten sind geheim zu halten. Inhalte, die gegen Gesetze oder Rechte Dritter verstoßen, dürfen nicht eingestellt werden.',
      },
      {
        heading: '4. Haftung',
        text: 'Beispieltext: Die Haftung richtet sich nach den gesetzlichen Vorschriften. Details folgen in der endgültigen Fassung.',
      },
      {
        heading: '5. Änderungen',
        text: 'Änderungen dieser Bedingungen werden rechtzeitig in der App bekannt gegeben.',
      },
    ],
  },
  datenschutz: {
    title: 'Datenschutzerklärung',
    intro:
      'Stand: Beispieltext. Wir nehmen den Schutz deiner Daten ernst und erklären hier kurz, was wir verarbeiten.',
    sections: [
      {
        heading: 'Verantwortliche Stelle',
        text: 'Für die Daten deines Vereins ist der Verein verantwortlich, Clubroof verarbeitet sie in seinem Auftrag. Genaue Angaben folgen in der endgültigen Fassung.',
      },
      {
        heading: 'Welche Daten wir verarbeiten',
        text: 'Name, Kontaktdaten, Mannschaftszugehörigkeit, Zu- und Absagen sowie – nur für Berechtigte – Kassendaten. Gründe für Abwesenheiten sind nur für Trainer und Verantwortliche sichtbar.',
      },
      {
        heading: 'Wer deine Daten sieht',
        text: 'Du bestimmst in deinem Profil, wer deine Kontaktdaten sehen darf. Trainer sehen nur die Daten ihrer Mannschaft.',
      },
      {
        heading: 'Speicherdauer und Löschung',
        text: 'Daten werden gelöscht, wenn sie nicht mehr gebraucht werden oder du es verlangst, sofern keine gesetzliche Aufbewahrungspflicht besteht.',
      },
      {
        heading: 'Deine Rechte',
        text: 'Du hast das Recht auf Auskunft, Berichtigung, Löschung, Einschränkung und Datenübertragbarkeit. Wende dich dazu an deinen Verein oder an den Support.',
      },
    ],
  },
  impressum: {
    title: 'Impressum',
    intro: 'Beispieltext – die Angaben werden vor dem Start ersetzt.',
    sections: [
      {
        heading: 'Anbieter',
        text: 'Clubroof (Beispiel)\nMusterstraße 1\n12345 Musterstadt',
      },
      { heading: 'Kontakt', text: 'E-Mail: kontakt@clubroof.example\nTelefon: 01234 567890' },
      { heading: 'Vertretungsberechtigt', text: 'Max Mustermann (Beispiel)' },
      { heading: 'Umsatzsteuer-ID', text: 'DE 123 456 789 (Beispiel)' },
      {
        heading: 'Verantwortlich für den Inhalt',
        text: 'Max Mustermann, Anschrift wie oben (Beispiel)',
      },
    ],
  },
  changelog: {
    title: 'Neuigkeiten in Clubroof',
    intro: 'Was sich in den letzten Versionen verbessert hat (Beispieleinträge).',
    sections: [
      {
        heading: 'Version 0.3 · Oktober 2026',
        text: '• Neuer Look mit Startseite, Team, Termine, Verein und Mehr\n• Wisch-Karten für die nächsten Spiele\n• Offline-Warteschlange für Zu- und Absagen',
      },
      {
        heading: 'Version 0.2 · September 2026',
        text: '• Spielplan-Import aus dem DFBnet\n• Spiel-Tags Liga, Pokal und Testspiel\n• Wiederholen von Terminen bis zu einem Datum',
      },
      {
        heading: 'Version 0.1 · August 2026',
        text: '• Erste Fassung mit Terminen, Kader, Mannschaftskasse und Nachrichten',
      },
    ],
  },
};
