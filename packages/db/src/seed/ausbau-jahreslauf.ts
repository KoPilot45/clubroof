/**
 * Demodaten-Ausbau der Inhalte (Paket DEMODATEN-AUSBAU, Schritt 4, Teil 2): weitere News mit Mannschaftsbildern,
 * Umfragen mit Stimmen, Wiki-Artikel, Aushänge und Vereinsveranstaltungen im Jahreslauf mit Helferplänen.
 */
import { addDays, addMinutes, at, calendarDayOf } from '@clubroof/core';
import { randomUUID } from 'node:crypto';
import type { Db } from '../client';
import * as s from '../schema';

type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

/** kleiner, fester Zufallsgenerator (mulberry32) */
function rng(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export async function seedJahreslauf(ctx: {
  tx: Tx;
  clubId: string;
  now: Date;
  today: Date;
  teamIds: Record<string, string>;
  orgUnitIds: Record<string, string>;
  facilityIds: Record<string, string>;
  people: {
    admin: string;
    board: string;
    coach: string;
    youthDirector: string;
    facilityManager: string;
  };
  /** Erwachsene, aus denen Stimmen und Helfer gezogen werden */
  adultIds: string[];
}) {
  const { tx, clubId, now, today, teamIds, orgUnitIds, facilityIds, people, adultIds } = ctx;
  const rand = rng(2026);
  const hoursAgo = (h: number) => addMinutes(now, -h * 60);
  const pool = adultIds.slice().sort(() => rand() - 0.5);
  const take = (n: number, from = 0) => pool.slice(from, from + n);

  // ── News ────────────────────────────────────────────────────────────────────────────────
  const news = (
    scope: { scopeType: 'club' | 'org_unit' | 'team'; scopeId?: string },
    title: string,
    teaser: string,
    body: string,
    h: number,
    image: string | null,
    author: string,
    priority: 'info' | 'important' = 'info',
  ) => ({
    id: randomUUID(),
    clubId,
    scopeType: scope.scopeType,
    scopeId: scope.scopeId ?? null,
    title,
    teaser,
    body,
    imageUrl: image ? `/brand/demo-${image}.png` : null,
    priority,
    status: 'published' as const,
    authorPersonId: author,
    publishedAt: hoursAgo(h),
    viewCount: 20 + Math.floor(rand() * 180),
    likeCount: Math.floor(rand() * 14),
  });
  await tx
    .insert(s.announcements)
    .values([
      news(
        { scopeType: 'club' },
        'Kreispokal: Auslosung für die 2. Runde',
        'Die 1. Mannschaft trifft auf den SV Rotweil.',
        'Die Auslosung der 2. Pokalrunde ist erfolgt: Unsere 1. Mannschaft spielt zu Hause gegen den SV Rotweil. Anstoß ist am Mittwochabend unter Flutlicht. Wir freuen uns über viele Zuschauer – der Eintritt ist frei, für das leibliche Wohl sorgt das Vereinsheim.',
        30,
        'team-h1',
        people.board,
      ),
      news(
        { scopeType: 'team', scopeId: teamIds.a1! },
        'A-Jugend: Zwischenbilanz nach der Hinrunde',
        'Platz drei und die beste Offensive der Liga.',
        'Nach zehn Spielen steht die A-Jugend auf Platz drei der Tabelle. 31 Tore sind der Bestwert der Liga. Besonders erfreulich: Vier Spieler aus dem eigenen Nachwuchs haben schon Einsätze bei der 2. Mannschaft. Vielen Dank an die Eltern für die Fahrdienste zu den Auswärtsspielen!',
        52,
        'team-a1',
        people.coach,
      ),
      news(
        { scopeType: 'team', scopeId: teamIds.e1! },
        'E-Jugend: Neue Trikots sind da',
        'Dank unserer Sponsoren spielt die E-Jugend ab Samstag in neuen Trikots.',
        'Die neuen Trikots sind angekommen und werden am Samstag zum ersten Mal getragen. Bitte denkt daran, die Trikots nach dem Spiel gewaschen zurückzugeben. Ein herzliches Dankeschön an alle Sponsoren!',
        70,
        'team-e1',
        people.youthDirector,
      ),
      news(
        { scopeType: 'org_unit', scopeId: orgUnitIds.youth! },
        'Schiedsrichter gesucht: Jetzt Kurs anmelden',
        'Der Verein übernimmt die Lehrgangskosten für Neulinge.',
        'Unsere Schiedsrichter pfeifen jedes Wochenende viele Jugendspiele – doch es werden mehr gebraucht. Der nächste Neulingskurs startet im November. Interessierte ab 14 Jahren melden sich bei Torsten Hoffmann, der Verein trägt die Kosten.',
        96,
        null,
        people.youthDirector,
        'important',
      ),
      news(
        { scopeType: 'club' },
        'Neue Bambini-Gruppe startet nach den Herbstferien',
        'Kinder ab vier Jahren können kostenlos schnuppern.',
        'Nach den Herbstferien startet eine zweite Bambini-Gruppe, jeweils freitags um 16:30 Uhr auf dem Rasenplatz. Eltern können beim Training zuschauen. Anmeldung formlos über die Geschäftsstelle oder direkt vor Ort.',
        120,
        'team-bam',
        people.board,
      ),
      news(
        { scopeType: 'club' },
        'Rückblick Sommerfest: 420 Gäste und ein toller Erlös',
        'Der Reinerlös fließt in die Jugendarbeit.',
        'Beim Sommerfest kamen rund 420 Gäste. Der Reinerlös von 2.340 Euro geht in die Jugendkasse. Danke an alle Helferinnen und Helfer, besonders an das Grillteam und die vielen Kuchenspenden!',
        240,
        null,
        people.board,
      ),
      news(
        { scopeType: 'club' },
        'Parkplatz am Vereinsheim: Bitte Fahrgemeinschaften bilden',
        'An Spieltagen ist der Platz knapp.',
        'An Heimspieltagen reicht der Parkplatz nicht aus. Bitte bildet Fahrgemeinschaften und parkt auf dem Schotterplatz neben der Halle. Die Zufahrt für Rettungsfahrzeuge muss frei bleiben.',
        300,
        null,
        people.facilityManager,
        'important',
      ),
      news(
        { scopeType: 'team', scopeId: teamIds.f1! },
        'Frauen: Spielgemeinschaft für die Rückrunde',
        'Gemeinsam mit dem TSV Blauen soll eine zweite Mannschaft entstehen.',
        'Um allen Spielerinnen Einsatzzeiten zu bieten, planen wir für die Rückrunde eine Spielgemeinschaft mit dem TSV Blauen. Wer Interesse hat, meldet sich bei der Trainerin; ein Infoabend findet im Vereinsheim statt.',
        360,
        'team-f1',
        people.coach,
      ),
    ]);

  // ── Umfragen mit Stimmen ────────────────────────────────────────────────────────────────
  async function poll(
    question: string,
    description: string | null,
    scope: { scopeType: 'club' | 'org_unit' | 'team'; scopeId?: string },
    visibility: 'always' | 'after_vote' | 'after_close',
    closesInDays: number,
    options: [string, number][],
    voters: string[],
    author: string,
  ) {
    const id = randomUUID();
    await tx.insert(s.polls).values({
      id,
      clubId,
      scopeType: scope.scopeType,
      scopeId: scope.scopeId ?? null,
      question,
      description,
      resultVisibility: visibility,
      closesAt: addDays(now, closesInDays),
      createdByPersonId: author,
      createdAt: hoursAgo(24 * 5),
    });
    const ids = options.map(() => randomUUID());
    await tx
      .insert(s.pollOptions)
      .values(options.map(([label], i) => ({ id: ids[i]!, pollId: id, label, sortOrder: i })));
    const total = options.reduce((n, [, w]) => n + w, 0);
    await tx.insert(s.pollVotes).values(
      voters.map((personId) => {
        let r = rand() * total;
        let index = 0;
        for (; index < options.length - 1; index++) {
          r -= options[index]![1];
          if (r < 0) break;
        }
        return { pollId: id, optionId: ids[index]!, personId };
      }),
    );
  }
  await poll(
    'Saisonabschlussfahrt: Wohin soll es gehen?',
    'Für die Jugendmannschaften; die Kosten übernimmt zum großen Teil die Vereinskasse.',
    { scopeType: 'org_unit', scopeId: orgUnitIds.youth! },
    'after_vote',
    14,
    [
      ['Freizeitpark', 5],
      ['Zeltlager am See', 4],
      ['Hallenbad und Kegeln', 2],
    ],
    take(38),
    people.youthDirector,
  );
  await poll(
    'Hallenzeiten im Winter: Welcher Tag passt?',
    'Die Halle ist ab November dienstags, mittwochs und freitags verfügbar.',
    { scopeType: 'club' },
    'always',
    9,
    [
      ['Dienstag 17:00 – 18:30 Uhr', 3],
      ['Mittwoch 16:30 – 18:00 Uhr', 5],
      ['Freitag 16:00 – 17:30 Uhr', 4],
    ],
    take(52, 20),
    people.board,
  );
  await poll(
    'Wie zufrieden bist du mit der Kommunikation im Verein?',
    'Die Umfrage ist beendet; das Ergebnis besprechen wir bei der Jahreshauptversammlung.',
    { scopeType: 'club' },
    'after_close',
    -6,
    [
      ['Sehr zufrieden', 4],
      ['Zufrieden', 7],
      ['Geht so', 3],
      ['Unzufrieden', 1],
    ],
    take(84, 5),
    people.admin,
  );
  await poll(
    'Frauen: Trainingslager im Frühjahr?',
    null,
    { scopeType: 'team', scopeId: teamIds.f1! },
    'always',
    21,
    [
      ['Ja, am Wochenende', 6],
      ['Ja, aber nur ein Tag', 3],
      ['Nein', 2],
    ],
    take(14, 40),
    people.coach,
  );

  // ── Wiki ────────────────────────────────────────────────────────────────────────────────
  const wiki = (title: string, category: string, body: string, daysAgo: number) => ({
    clubId,
    title,
    category,
    body,
    updatedByPersonId: people.board,
    createdAt: hoursAgo(24 * (daysAgo + 20)),
    updatedAt: hoursAgo(24 * daysAgo),
  });
  await tx
    .insert(s.wikiPages)
    .values([
      wiki(
        'Platzordnung',
        'Anlage',
        'Der Rasenplatz darf nur mit Fußballschuhen mit Nocken betreten werden, der Kunstrasen nur mit Multinockenschuhen.\nTore werden nach dem Training abgebaut und im Materialraum gelagert.\nBei Dauerregen entscheidet der Platzwart bis zwei Stunden vor Beginn über die Sperrung.',
        9,
      ),
      wiki(
        'Hallenordnung Sporthalle',
        'Anlage',
        'In der Halle gelten Hallenschuhe mit heller Sohle. Getränke nur in Flaschen. Die Halle wird gemeinsam mit der Schule genutzt – bitte pünktlich beginnen und aufräumen.\nDer Schlüssel für das Materiallager liegt beim Hausmeister.',
        16,
      ),
      wiki(
        'Fairplay: Was wir von Eltern erwarten',
        'Verein',
        'Wir feuern an, wir pfeifen nicht. Entscheidungen des Schiedsrichters werden nicht kommentiert, der Trainer ist der einzige Ansprechpartner am Spielfeldrand.\nNach dem Spiel gratulieren wir dem Gegner, egal wie es ausging.',
        25,
      ),
      wiki(
        'Spielbericht richtig ausfüllen',
        'Sport',
        'Den Spielbericht trägt der Trainer innerhalb von 24 Stunden in der App ein: Ergebnis, Torschützen, Karten und die Aufstellung. Bei Jugendspielen bitte auch Einwechslungen vermerken.\nFehler können in den ersten 14 Tagen korrigiert werden.',
        13,
      ),
      wiki(
        'Ansprechpartner im Verein',
        'Organisation',
        'Mitgliederverwaltung und Beiträge: Geschäftsstelle (dienstags 17–19 Uhr).\nJugend: Jugendleiter Torsten Hoffmann.\nPlatz und Halle: Platzwart Klaus Richter.\nSchiedsrichter: Schiedsrichterobmann.\nDatenschutz: der Vorstand.',
        40,
      ),
      wiki(
        'Fahrgemeinschaften zu Auswärtsspielen',
        'Organisation',
        'Wer fahren kann, trägt sich in der App beim Termin als Fahrer ein. Mitfahrer melden sich dort ebenfalls an. Treffpunkt ist der Parkplatz am Vereinsheim, 90 Minuten vor Anstoß.\nBitte keine Kinder ohne Sitzerhöhung befördern.',
        33,
      ),
      wiki(
        'Trikots und Ausrüstung',
        'Sport',
        'Trikots gehören dem Verein und werden nach jedem Spiel gewaschen zurückgegeben. Verlorene Trikots melden wir dem Zeugwart.\nSchienbeinschoner sind bei Training und Spiel Pflicht.',
        58,
      ),
      wiki(
        'Fotos und Datenschutz im Training',
        'Verein',
        'Fotos von Kindern werden nur mit Einwilligung der Eltern veröffentlicht. Die Einwilligung ist im Aufnahmeantrag enthalten und kann jederzeit widerrufen werden.\nPrivate Fotos am Spielfeldrand bitte nicht in sozialen Netzwerken teilen.',
        75,
      ),
    ]);

  // ── Aushänge ────────────────────────────────────────────────────────────────────────────
  const board = (
    kind: 'offer' | 'search' | 'found',
    title: string,
    description: string,
    author: string,
    createdHoursAgo: number,
    expiresInDays: number,
  ) => ({
    clubId,
    kind,
    title,
    description,
    authorPersonId: author,
    expiresAt: addDays(now, expiresInDays),
    createdAt: hoursAgo(createdHoursAgo),
  });
  await tx
    .insert(s.boardItems)
    .values([
      board('offer', 'Stollenschuhe Größe 38', 'Kaum getragen, 10 Euro.', pool[3]!, 20, 25),
      board(
        'search',
        'Mitfahrgelegenheit nach Talheim',
        'Samstags zum Auswärtsspiel gesucht.',
        pool[4]!,
        40,
        6,
      ),
      board(
        'found',
        'Blaue Trinkflasche gefunden',
        'Liegt im Vereinsheim bei der Theke.',
        people.facilityManager,
        60,
        14,
      ),
      board(
        'offer',
        'Kinderfahrrad 20 Zoll',
        'Zu verschenken, Abholung in Musterstadt.',
        pool[5]!,
        100,
        30,
      ),
    ]);

  // ── Veranstaltungen im Jahreslauf mit Helferplänen ──────────────────────────────────────
  const year: {
    title: string;
    days: number;
    from: string;
    to: string;
    type: 'club_event' | 'meeting' | 'work_assignment';
    facility: string;
    description: string;
    contact: string;
    unit?: string;
    program?: { time: string; title: string }[];
    shifts?: [string, string, string, number, number][];
  }[] = [
    {
      title: 'Sommerfest',
      days: -110,
      from: '14:00',
      to: '22:00',
      type: 'club_event',
      facility: 'rasen',
      description: 'Familienfest mit Grillen, Hüpfburg und Elfmeterschießen.',
      contact: people.board,
      shifts: [
        ['Grillstand', '13:00', '18:00', 6, 6],
        ['Kuchenbuffet', '13:00', '18:00', 5, 5],
        ['Getränke', '14:00', '22:00', 6, 6],
      ],
    },
    {
      title: 'Elternabend Jugend',
      days: -25,
      from: '19:00',
      to: '21:00',
      type: 'meeting',
      facility: 'vereinsheim',
      description: 'Informationen zur Saison, Fahrdienste und Fragen an die Jugendleitung.',
      contact: people.youthDirector,
      unit: 'youth',
    },
    {
      title: 'Schleifchenturnier für Bambini',
      days: 55,
      from: '10:00',
      to: '14:00',
      type: 'club_event',
      facility: 'halle',
      description: 'Spielerisches Turnier für die Kleinsten – jedes Kind bekommt ein Schleifchen.',
      contact: people.youthDirector,
      unit: 'youth',
      program: [
        { time: '10:00', title: 'Begrüßung' },
        { time: '10:30', title: 'Spielrunden' },
        { time: '13:00', title: 'Schleifchenübergabe' },
      ],
      shifts: [
        ['Spielleitung', '09:30', '14:00', 4, 2],
        ['Verpflegung', '09:30', '14:00', 3, 1],
      ],
    },
    {
      title: 'Neujahrsempfang',
      days: 78,
      from: '11:00',
      to: '14:00',
      type: 'club_event',
      facility: 'vereinsheim',
      description: 'Sektempfang mit Rückblick auf das Jahr und Ehrungen langjähriger Mitglieder.',
      contact: people.board,
      shifts: [['Bewirtung', '10:00', '14:00', 4, 2]],
    },
    {
      title: 'Kinderfasching',
      days: 120,
      from: '14:00',
      to: '17:00',
      type: 'club_event',
      facility: 'halle',
      description: 'Verkleiden, Spielen und Tanzen für Kinder bis zehn Jahre.',
      contact: people.youthDirector,
      unit: 'youth',
      shifts: [
        ['Spielstationen', '13:30', '17:00', 6, 3],
        ['Kuchen und Getränke', '13:30', '17:00', 4, 2],
      ],
    },
    {
      title: 'Frühjahrsputz auf der Anlage',
      days: 150,
      from: '09:00',
      to: '13:00',
      type: 'work_assignment',
      facility: 'vereinsheim',
      description: 'Beete anlegen, Zäune streichen, Tore reparieren. Frühstück gibt es um 11 Uhr.',
      contact: people.facilityManager,
      shifts: [
        ['Zäune streichen', '09:00', '13:00', 8, 3],
        ['Beete und Hecke', '09:00', '13:00', 6, 2],
      ],
    },
    {
      title: 'Ehrenamtsabend',
      days: 175,
      from: '18:30',
      to: '22:00',
      type: 'club_event',
      facility: 'vereinsheim',
      description: 'Als Dankeschön laden wir alle Ehrenamtlichen zum Essen ein.',
      contact: people.board,
    },
    {
      title: 'Pokalfinale im Kreis',
      days: 205,
      from: '15:00',
      to: '18:00',
      type: 'club_event',
      facility: 'rasen',
      description: 'Das Kreispokalfinale findet auf unserer Anlage statt.',
      contact: people.board,
      shifts: [
        ['Einlass und Kasse', '13:30', '18:30', 4, 1],
        ['Würstchenstand', '13:30', '18:30', 4, 1],
      ],
    },
    {
      title: 'Jugendzeltlager am See',
      days: 260,
      from: '10:00',
      to: '17:00',
      type: 'club_event',
      facility: 'rasen',
      description: 'Drei Tage Zelten, Fußball und Lagerfeuer für die Jugendmannschaften.',
      contact: people.youthDirector,
      unit: 'youth',
      shifts: [['Betreuung', '10:00', '17:00', 8, 2]],
    },
  ];
  let helperCursor = 12;
  for (const e of year) {
    const day = calendarDayOf(addDays(today, e.days));
    const eventId = randomUUID();
    await tx.insert(s.events).values({
      id: eventId,
      clubId,
      type: e.type,
      title: e.title,
      description: e.description,
      startsAt: at(day, e.from),
      endsAt: at(day, e.to),
      facilityId: facilityIds[e.facility]!,
      orgUnitId: e.unit ? orgUnitIds[e.unit]! : null,
      contactPersonId: e.contact,
      program: e.program ?? null,
    });
    for (const [title, start, end, capacity, filled] of e.shifts ?? []) {
      const shiftId = randomUUID();
      await tx.insert(s.helperShifts).values({
        id: shiftId,
        clubId,
        eventId,
        title,
        startsAt: at(day, start),
        endsAt: at(day, end),
        capacity,
      });
      const helpers = take(filled, helperCursor);
      helperCursor += filled;
      if (helpers.length)
        await tx.insert(s.helperSignups).values(helpers.map((personId) => ({ shiftId, personId })));
    }
  }
}
