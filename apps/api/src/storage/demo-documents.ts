/**
 * Kleine, inhaltliche PDFs für die Demodokumente (Paket DEMODATEN-AUSBAU): Satzung-Auszug, Beitragsordnung mit den
 * Beitragsarten des Demovereins, Hygienekonzept, Platzordnung, Aufnahmeantrag, Protokoll der Jahreshauptversammlung.
 * Alle Angaben sind frei erfunden. Unbekannte Titel bekommen den Platzhalter.
 */
import { SimplePdf } from './pdf';
import { placeholderPdf } from './files';

type Build = (pdf: SimplePdf, clubName: string) => void;

const head = (pdf: SimplePdf, title: string, clubName: string) => {
  pdf.text(title, { size: 20, bold: true });
  pdf.text(clubName, { size: 11 });
  pdf.gap(14);
};
const section = (pdf: SimplePdf, title: string, text: string) => {
  pdf.gap(6);
  pdf.text(title, { size: 12, bold: true });
  pdf.paragraph(text, { size: 10 });
};

const DOCS: Record<string, Build> = {
  Vereinssatzung: (pdf, club) => {
    head(pdf, 'Satzung (Auszug)', club);
    section(
      pdf,
      '§ 1 Name, Sitz, Geschäftsjahr',
      'Der Verein führt den Namen „SV Grün-Weiß Musterstadt 1920 e. V.“ und hat seinen Sitz in Musterstadt. Er ist in das Vereinsregister eingetragen. Geschäftsjahr ist das Kalenderjahr.',
    );
    section(
      pdf,
      '§ 2 Zweck',
      'Zweck des Vereins ist die Förderung des Sports, insbesondere des Fußballs. Der Zweck wird durch regelmäßigen Trainings- und Spielbetrieb, Jugendarbeit und die Pflege der Sportanlagen verwirklicht. Der Verein ist selbstlos tätig und verfolgt keine eigenwirtschaftlichen Zwecke.',
    );
    section(
      pdf,
      '§ 3 Mitgliedschaft',
      'Mitglied kann jede natürliche Person werden. Die Aufnahme erfolgt auf schriftlichen Antrag; bei Minderjährigen ist die Zustimmung der Erziehungsberechtigten nötig. Über die Aufnahme entscheidet der Vorstand. Passive und fördernde Mitglieder unterstützen den Verein ohne Spielbetrieb.',
    );
    section(
      pdf,
      '§ 7 Organe',
      'Organe des Vereins sind die Mitgliederversammlung und der Vorstand. Die ordentliche Mitgliederversammlung findet einmal jährlich statt. Der Vorstand besteht aus der oder dem 1. Vorsitzenden, der Stellvertretung, der Kassenführung und der Schriftführung.',
    );
    section(
      pdf,
      '§ 9 Kassenprüfung',
      'Die Mitgliederversammlung wählt für zwei Jahre mindestens zwei Kassenprüferinnen oder Kassenprüfer. Sie prüfen die Kasse mindestens einmal jährlich und berichten der Mitgliederversammlung.',
    );
  },
  'Beitragsordnung 2026': (pdf, club) => {
    head(pdf, 'Beitragsordnung', club);
    pdf.paragraph(
      'Beschlossen von der Mitgliederversammlung. Die Beiträge werden bei Eintritt und danach zu den genannten Terminen fällig; der Einzug erfolgt per SEPA-Lastschrift oder Überweisung.',
    );
    pdf.gap(10);
    const xs = [56, 230, 330, 440];
    pdf.row(['Beitragsart', 'Betrag', 'Rhythmus', 'Fällig'], xs, { bold: true });
    pdf.row(['Erwachsene', '45,00 €', 'vierteljährlich', '1.1., 1.4., 1.7., 1.10.'], xs);
    pdf.row(['Jugend (bis 17 Jahre)', '30,00 €', 'vierteljährlich', '1.1., 1.4., 1.7., 1.10.'], xs);
    pdf.row(['Familie', '75,00 €', 'vierteljährlich', '1.1., 1.4., 1.7., 1.10.'], xs);
    pdf.row(['Passive Mitglieder', '24,00 €', 'jährlich', '1.1.'], xs);
    section(
      pdf,
      'Mahnwesen',
      'Wird ein Beitrag nicht pünktlich gezahlt, erinnert die Kassenführung nach 14 Tagen. Nach zwei weiteren Mahnungen kann der Vorstand den Ausschluss beschließen.',
    );
    section(
      pdf,
      'Ermäßigung',
      'Auf Antrag kann der Vorstand den Beitrag in sozialen Härtefällen ermäßigen. Die Ermäßigung wird vertraulich behandelt.',
    );
  },
  Jugendordnung: (pdf, club) => {
    head(pdf, 'Jugendordnung', club);
    section(
      pdf,
      'Ziele',
      'Die Jugendarbeit fördert Spaß am Sport, Fairness und soziales Miteinander. Leistungsdruck steht nie vor der Freude am Spiel.',
    );
    section(
      pdf,
      'Betreuung',
      'Jede Jugendmannschaft wird von einer Trainerin oder einem Trainer geleitet; Co-Trainer und Betreuer unterstützen. Alle Betreuerinnen und Betreuer legen ein erweitertes Führungszeugnis vor.',
    );
    section(
      pdf,
      'Elternarbeit',
      'Eltern sind eingeladen, bei Fahrten, Turnieren und Festen zu helfen. Die Termine und Zusagen laufen über die Vereins-App.',
    );
  },
  'Hygienekonzept Sportplatz': (pdf, club) => {
    head(pdf, 'Hygienekonzept Sportplatz', club);
    section(
      pdf,
      'Kabinen und Duschen',
      'Kabinen werden nach jedem Training gelüftet und kurz gereinigt. Duschen sind für Mannschaften zeitlich gestaffelt. Müll wird mitgenommen oder in die vorgesehenen Tonnen gebracht.',
    );
    section(
      pdf,
      'Trainingsbetrieb',
      'Bälle und Trainingsmaterial werden nach dem Training eingesammelt und bei Bedarf gereinigt. Kranke Personen bleiben dem Training fern.',
    );
    section(
      pdf,
      'Erste Hilfe',
      'Erste-Hilfe-Koffer hängen in den Kabinen 1 bis 4 und im Vereinsheim. Verbrauchtes Material meldet das Trainerteam in der App.',
    );
  },
  Platzordnung: (pdf, club) => {
    head(pdf, 'Platzordnung', club);
    section(
      pdf,
      'Nutzung',
      'Die Plätze dürfen nur in den über die App gebuchten Zeiten genutzt werden. Bei Sperrung (Nässe, Frost) gilt der Hinweis in der App.',
    );
    section(
      pdf,
      'Schuhe und Pflege',
      'Auf dem Rasenplatz sind Stollenschuhe erlaubt, auf dem Kunstrasen nur Multinocken. Tore werden nach dem Training zurückgestellt, Löcher im Rasen werden zugetreten.',
    );
    section(
      pdf,
      'Rauchen und Alkohol',
      'Auf der gesamten Anlage herrscht für Jugendliche Rauch- und Alkoholverbot. Glasflaschen sind auf dem Platz nicht erlaubt.',
    );
  },
  Aufnahmeantrag: (pdf, club) => {
    head(pdf, 'Aufnahmeantrag', club);
    pdf.paragraph(
      'Hiermit beantrage ich die Aufnahme in den Verein. Die Satzung und die Beitragsordnung erkenne ich an.',
    );
    pdf.gap(10);
    for (const f of [
      'Vorname, Nachname',
      'Geburtsdatum',
      'Anschrift',
      'E-Mail und Telefon',
      'Mannschaft / Abteilung (falls bekannt)',
      'Gewünschte Beitragsart',
      'Bei Minderjährigen: Name der Erziehungsberechtigten',
    ])
      pdf.text(`${f}: ______________________________________`, { size: 10 });
    pdf.gap(14);
    pdf.text('Ort, Datum, Unterschrift: ______________________________', { size: 10 });
  },
  'Datenschutzhinweise für Mitglieder': (pdf, club) => {
    head(pdf, 'Datenschutzhinweise', club);
    section(
      pdf,
      'Welche Daten',
      'Der Verein verarbeitet Name, Anschrift, Geburtsdatum, Kontaktdaten, Mannschaftszugehörigkeit und – nur für den Beitragseinzug – Bankverbindungen.',
    );
    section(
      pdf,
      'Wozu',
      'Die Daten dienen der Mitgliederverwaltung, der Organisation des Spielbetriebs und der Beitragsabrechnung. Eine Weitergabe an Dritte erfolgt nur an Verbände zur Spielberechtigung.',
    );
    section(
      pdf,
      'Ihre Rechte',
      'Sie haben das Recht auf Auskunft, Berichtigung und Löschung. In der Vereins-App erhalten Sie Ihre Daten unter „Meine Daten“ als Datei.',
    );
  },
  'Protokoll Jahreshauptversammlung': (pdf, club) => {
    head(pdf, 'Protokoll der Jahreshauptversammlung', club);
    pdf.paragraph(
      'Ort: Vereinsheim. Beginn 19:00 Uhr. Anwesend: 48 stimmberechtigte Mitglieder. Versammlungsleitung: Sandra Hoffmann, Protokoll: Andrea Wolf.',
    );
    section(
      pdf,
      'TOP 1 Bericht des Vorstands',
      'Die Vorsitzende berichtet über ein erfolgreiches Jahr: 312 Mitglieder, elf Mannschaften, neuer Kunstrasenbelag in Planung. Die Jugendabteilung wächst weiter.',
    );
    section(
      pdf,
      'TOP 2 Kassenbericht und Prüfung',
      'Der Kassenwart legt den Jahresabschluss vor. Die Kassenprüferin bestätigt die ordnungsgemäße Führung der Kasse (ein Beleg wurde nachgereicht) und empfiehlt die Entlastung.',
    );
    section(
      pdf,
      'TOP 3 Entlastung',
      'Der Vorstand wird bei Enthaltung der Betroffenen einstimmig entlastet.',
    );
    section(
      pdf,
      'TOP 4 Haushaltsplan',
      'Der Haushaltsplan für das laufende Jahr wird mit einer Gegenstimme beschlossen. Eine Rücklage für die Erneuerung des Kunstrasens wird weitergeführt.',
    );
    section(
      pdf,
      'TOP 5 Verschiedenes',
      'Das Sommerfest findet im Juni statt, Helferlisten liegen in der App aus. Ende der Versammlung 21:10 Uhr.',
    );
  },
};

/** PDF zu einem Demodokument; ohne passende Vorlage der Platzhalter. */
export function demoDocumentPdf(title: string, clubName: string): Buffer {
  const build = DOCS[title];
  if (!build) return placeholderPdf(title, clubName);
  const pdf = new SimplePdf();
  build(pdf, clubName);
  return pdf.build();
}
