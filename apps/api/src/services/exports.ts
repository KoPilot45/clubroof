/**
 * Exporte (Paket IMPORT-EXPORT, Stufe 3): Mitglieder, Kader, Termine, Anwesenheit, Vereinskasse, Beiträge,
 * Gesamtexport des Vereins (Admin) und „Meine Daten“ (jede Person, Eltern für ihre Kinder). Die Daten kommen aus
 * denselben Diensten wie die Bildschirme, damit Rechte und Sichtbarkeit gleich bleiben; jeder Export steht im
 * Protokoll.
 */
import {
  calendarDayOf,
  toIsoDate,
  type ExportArea,
  type ExportAreaInfo,
  type ExportFile,
  type ExportFormat,
} from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { strToU8, zipSync } from 'fflate';
import { and, asc, eq, gte, inArray, lte } from 'drizzle-orm';
import { actorCan, isFullAdmin, type Actor } from '../actor';
import { forbidden, notFound } from '../errors';
import { listMembers } from './admin';
import { listEntries } from './club-cash';
import { getClubFees } from './club-fees';
import { loadTeamForActor } from './team-access';
import { getRoster } from './teams';
import { writeCsv, writeXlsx } from './table-file';

type Sheet = { name: string; rows: string[][] };
type Built = { baseName: string; sheets: Sheet[] };

const DAY = 86_400_000;
const euro = (cents: number) => (cents / 100).toFixed(2).replace('.', ',');
const germanDate = (iso: string | null | undefined) =>
  iso ? iso.slice(0, 10).split('-').reverse().join('.') : '';
const yesNo = (v: boolean | null | undefined) =>
  v === null || v === undefined ? '' : v ? 'Ja' : 'Nein';

const STATUS_LABEL: Record<string, string> = {
  active: 'Aktiv',
  inactive: 'Passiv',
  left: 'Ausgetreten',
};
const FUNCTION_LABEL: Record<string, string> = {
  player: 'Spieler',
  coach: 'Trainer',
  assistant_coach: 'Co-Trainer',
  manager: 'Betreuer',
  guest: 'Gastspieler',
};
const EVENT_STATUS_LABEL: Record<string, string> = {
  scheduled: 'Geplant',
  cancelled: 'Abgesagt',
  completed: 'Stattgefunden',
};
const RESPONSE_LABEL: Record<string, string> = {
  yes: 'Zugesagt',
  no: 'Abgesagt',
  maybe: 'Unsicher',
  pending: 'Offen',
};

const time = (d: Date | null, tz: string) =>
  d
    ? new Intl.DateTimeFormat('de-DE', { timeZone: tz, hour: '2-digit', minute: '2-digit' }).format(
        d,
      )
    : '';
const day = (d: Date, tz: string) => germanDate(toIsoDate(calendarDayOf(d, tz)));

// ── Bereiche und Rechte ───────────────────────────────────────────────────────

async function accessibleTeams(db: Db, actor: Actor) {
  const teams = await db
    .select()
    .from(s.teams)
    .where(eq(s.teams.clubId, actor.club.id))
    .orderBy(asc(s.teams.name));
  const out: { id: string; badge: string; name: string; readAttendance: boolean }[] = [];
  for (const t of teams) {
    try {
      const { permissions } = await loadTeamForActor(db, actor, t.id);
      out.push({
        id: t.id,
        badge: t.badge,
        name: t.name,
        readAttendance: permissions.readAttendance,
      });
    } catch {
      // keine Sicht auf diese Mannschaft
    }
  }
  return out;
}

/** Welche Exporte der Nutzer sehen darf (die Bildschirme zeigen nur diese). */
export async function listExportAreas(db: Db, actor: Actor): Promise<ExportAreaInfo[]> {
  const teams = await accessibleTeams(db, actor);
  const areas: ExportAreaInfo[] = [
    {
      area: 'me',
      label: 'Meine Daten',
      description: 'Alles, was der Verein über dich (und deine Kinder) gespeichert hat',
    },
  ];
  if (teams.length)
    areas.push(
      {
        area: 'roster',
        label: 'Kader',
        description: 'Spieler und Betreuer einer Mannschaft',
        teams: teams.map(({ id, badge, name }) => ({ id, badge, name })),
      },
      {
        area: 'events',
        label: 'Termine',
        description: 'Training, Spiele und Termine einer Mannschaft',
        teams: teams.map(({ id, badge, name }) => ({ id, badge, name })),
      },
    );
  const attendanceTeams = teams.filter((t) => t.readAttendance);
  if (attendanceTeams.length)
    areas.push({
      area: 'attendance',
      label: 'Anwesenheit',
      description: 'Zu- und Absagen und tatsächliche Anwesenheit je Termin',
      teams: attendanceTeams.map(({ id, badge, name }) => ({ id, badge, name })),
    });
  if (actorCan(actor, 'members.read'))
    areas.push({
      area: 'members',
      label: 'Mitglieder',
      description: actorCan(actor, 'members.manage')
        ? 'Mitgliederliste mit Kontaktdaten'
        : 'Mitgliederliste ohne Kontaktdaten',
    });
  if (actorCan(actor, 'clubcash.read'))
    areas.push(
      {
        area: 'cash',
        label: 'Vereinskasse: Buchungen',
        description: 'Alle Buchungen des Kassenbuchs, auch stornierte',
      },
      {
        area: 'fees',
        label: 'Vereinskasse: Beiträge',
        description: 'Alle Beitragsforderungen mit Stand der Zahlung',
      },
    );
  if (isFullAdmin(actor))
    areas.push({
      area: 'club',
      label: 'Gesamtexport des Vereins',
      description: 'Mitglieder, Mannschaften, Termine und Kasse als ZIP mit CSV-Dateien',
      zip: true,
    });
  return areas;
}

// ── Aufbau der Tabellen ───────────────────────────────────────────────────────

async function membersSheet(db: Db, actor: Actor, now: Date): Promise<Built> {
  if (!actorCan(actor, 'members.read')) throw forbidden('Die Mitgliederliste siehst du nicht.');
  const list = await listMembers(db, actor, {}, now);
  const contact = actorCan(actor, 'members.manage');
  const details = contact
    ? new Map(
        (await db.select().from(s.persons).where(eq(s.persons.clubId, actor.club.id))).map((p) => [
          p.id,
          p,
        ]),
      )
    : null;
  const head = [
    'Vorname',
    'Nachname',
    'Mitgliedsnummer',
    'Status',
    'Mannschaften',
    'Rollen',
    'App-Konto',
    ...(contact ? ['Geburtsdatum', 'E-Mail', 'Telefon', 'Mitglied seit'] : []),
  ];
  const rows = list.map((m) => {
    const p = details?.get(m.id);
    return [
      m.firstName,
      m.lastName,
      m.memberNumber ?? '',
      STATUS_LABEL[m.status] ?? m.status,
      m.teams.map((t) => `${t.badge} (${FUNCTION_LABEL[t.function] ?? t.function})`).join(', '),
      m.roles.join(', '),
      yesNo(m.hasAccount),
      ...(contact
        ? [germanDate(p?.birthDate), p?.email ?? '', p?.phone ?? '', germanDate(p?.memberSince)]
        : []),
    ];
  });
  return { baseName: 'Mitglieder', sheets: [{ name: 'Mitglieder', rows: [head, ...rows] }] };
}

async function rosterSheet(db: Db, actor: Actor, teamId: string, now: Date): Promise<Built> {
  const { team } = await loadTeamForActor(db, actor, teamId);
  const roster = await getRoster(db, actor, teamId, now);
  const rows = roster.map((r) => [
    r.jerseyNumber === null ? '' : String(r.jerseyNumber),
    r.name,
    FUNCTION_LABEL[r.function] ?? r.function,
    r.position ?? '',
    r.unavailable ? 'Nicht verfügbar' : 'Verfügbar',
  ]);
  return {
    baseName: `Kader ${team.badge}`,
    sheets: [
      { name: 'Kader', rows: [['Nr.', 'Name', 'Funktion', 'Position', 'Verfügbarkeit'], ...rows] },
    ],
  };
}

async function teamEvents(db: Db, actor: Actor, teamId: string, now: Date) {
  const { team, permissions } = await loadTeamForActor(db, actor, teamId);
  const events = await db
    .select()
    .from(s.events)
    .where(
      and(
        eq(s.events.teamId, team.id),
        gte(s.events.startsAt, new Date(now.getTime() - 400 * DAY)),
        lte(s.events.startsAt, new Date(now.getTime() + 400 * DAY)),
      ),
    )
    .orderBy(asc(s.events.startsAt));
  return { team, permissions, events };
}

async function eventsSheet(db: Db, actor: Actor, teamId: string, now: Date): Promise<Built> {
  const { team, events } = await teamEvents(db, actor, teamId, now);
  const tz = actor.club.timezone;
  const rows = events.map((e) => [
    day(e.startsAt, tz),
    time(e.startsAt, tz),
    time(e.endsAt, tz),
    e.type,
    e.title,
    e.locationText ?? '',
    EVENT_STATUS_LABEL[e.status] ?? e.status,
  ]);
  return {
    baseName: `Termine ${team.badge}`,
    sheets: [
      {
        name: 'Termine',
        rows: [['Datum', 'Beginn', 'Ende', 'Art', 'Titel', 'Ort', 'Status'], ...rows],
      },
    ],
  };
}

async function attendanceSheet(db: Db, actor: Actor, teamId: string, now: Date): Promise<Built> {
  const { team, permissions, events } = await teamEvents(db, actor, teamId, now);
  if (!permissions.readAttendance) throw forbidden('Die Anwesenheit siehst du nicht.');
  const tz = actor.club.timezone;
  const byId = new Map(events.map((e) => [e.id, e]));
  const parts = events.length
    ? await db
        .select({ p: s.eventParticipants, first: s.persons.firstName, last: s.persons.lastName })
        .from(s.eventParticipants)
        .innerJoin(s.persons, eq(s.persons.id, s.eventParticipants.personId))
        .where(inArray(s.eventParticipants.eventId, [...byId.keys()]))
    : [];
  const rows = parts
    .map((r) => ({ ...r, e: byId.get(r.p.eventId)! }))
    .sort((a, b) => a.e.startsAt.getTime() - b.e.startsAt.getTime())
    .map((r) => [
      day(r.e.startsAt, tz),
      r.e.title,
      `${r.first} ${r.last}`,
      r.p.role === 'player' ? 'Spieler' : r.p.role === 'coach' ? 'Trainer' : String(r.p.role),
      RESPONSE_LABEL[r.p.status] ?? r.p.status,
      r.p.reason ?? '',
      r.e.attendanceRecordedAt ? yesNo(r.p.attended ?? false) : '',
    ]);
  return {
    baseName: `Anwesenheit ${team.badge}`,
    sheets: [
      {
        name: 'Anwesenheit',
        rows: [['Datum', 'Termin', 'Person', 'Rolle', 'Antwort', 'Grund', 'Anwesend'], ...rows],
      },
    ],
  };
}

async function cashSheet(db: Db, actor: Actor, now: Date): Promise<Built> {
  const entries = await listEntries(db, actor, { includeCancelled: true }, now, 20_000);
  const kind: Record<string, string> = {
    income: 'Einnahme',
    expense: 'Ausgabe',
    transfer_in: 'Umbuchung (Zugang)',
    transfer_out: 'Umbuchung (Abgang)',
  };
  const rows = entries.map((e) => [
    germanDate(e.bookedOn),
    e.fundName,
    e.accountName,
    kind[e.kind] ?? e.kind,
    e.categoryName ?? '',
    e.costCenterName ?? '',
    e.counterparty ?? '',
    e.purpose,
    e.receiptNo ?? '',
    euro(e.kind === 'expense' || e.kind === 'transfer_out' ? -e.amountCents : e.amountCents),
    e.cancelled ? `Storniert: ${e.cancelled.reason}` : '',
  ]);
  return {
    baseName: 'Vereinskasse Buchungen',
    sheets: [
      {
        name: 'Buchungen',
        rows: [
          [
            'Datum',
            'Kasse',
            'Konto',
            'Art',
            'Kategorie',
            'Kostenstelle',
            'Gegenpartei',
            'Zweck',
            'Belegnummer',
            'Betrag (€)',
            'Storno',
          ],
          ...rows,
        ],
      },
    ],
  };
}

async function feesSheet(db: Db, actor: Actor, now: Date): Promise<Built> {
  const fees = await getClubFees(db, actor, { status: 'all', limit: 50_000 }, now);
  if (fees.level !== 'full') throw forbidden('Die Beiträge siehst du nicht im Einzelnen.');
  const status: Record<string, string> = {
    open: 'Offen',
    overdue: 'Überfällig',
    paid: 'Bezahlt',
    cancelled: 'Storniert',
  };
  const rows = fees.dues.map((d) => [
    d.personName,
    d.memberNumber ?? '',
    d.feeTypeName,
    d.periodLabel,
    germanDate(d.dueOn),
    euro(d.amountCents),
    euro(d.paidCents),
    euro(d.openCents),
    status[d.status] ?? d.status,
    String(d.reminderLevel),
  ]);
  return {
    baseName: 'Vereinskasse Beiträge',
    sheets: [
      {
        name: 'Beiträge',
        rows: [
          [
            'Person',
            'Mitgliedsnummer',
            'Beitragsart',
            'Zeitraum',
            'Fällig am',
            'Betrag (€)',
            'Bezahlt (€)',
            'Offen (€)',
            'Status',
            'Mahnstufe',
          ],
          ...rows,
        ],
      },
    ],
  };
}

/** Eigene Daten der Person und ihrer Kinder (Auskunft nach DSGVO). */
async function myDataSheets(db: Db, actor: Actor): Promise<Built> {
  const ids = actor.managed.map((m) => m.id);
  const name = new Map(actor.managed.map((m) => [m.id, `${m.firstName} ${m.lastName}`]));
  const persons = await db.select().from(s.persons).where(inArray(s.persons.id, ids));
  const tz = actor.club.timezone;
  const personRows = persons.map((p) => [
    `${p.firstName} ${p.lastName}`,
    p.id === actor.person.id ? 'Ich' : 'Kind',
    germanDate(p.birthDate),
    p.email ?? '',
    p.phone ?? '',
    p.memberNumber ?? '',
    germanDate(p.memberSince),
    STATUS_LABEL[p.membershipStatus] ?? p.membershipStatus,
  ]);
  const memberships = await db
    .select({ m: s.teamMemberships, team: s.teams.name, badge: s.teams.badge })
    .from(s.teamMemberships)
    .innerJoin(s.teams, eq(s.teams.id, s.teamMemberships.teamId))
    .where(inArray(s.teamMemberships.personId, ids));
  const roles = await db
    .select({ a: s.roleAssignments, role: s.roles.name })
    .from(s.roleAssignments)
    .innerJoin(s.roles, eq(s.roles.id, s.roleAssignments.roleId))
    .where(inArray(s.roleAssignments.personId, ids));
  const responses = await db
    .select({ p: s.eventParticipants, title: s.events.title, startsAt: s.events.startsAt })
    .from(s.eventParticipants)
    .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
    .where(inArray(s.eventParticipants.personId, ids))
    .orderBy(asc(s.events.startsAt));
  const absences = await db
    .select()
    .from(s.absences)
    .where(inArray(s.absences.personId, ids))
    .orderBy(asc(s.absences.startsOn));
  const cash = await db
    .select()
    .from(s.cashTransactions)
    .where(inArray(s.cashTransactions.personId, ids))
    .orderBy(asc(s.cashTransactions.bookedOn));
  const nameOf = (id: string | null) => (id ? (name.get(id) ?? '') : '');
  const sheets: Sheet[] = [
    {
      name: 'Stammdaten',
      rows: [
        [
          'Person',
          'Bezug',
          'Geburtsdatum',
          'E-Mail',
          'Telefon',
          'Mitgliedsnummer',
          'Mitglied seit',
          'Status',
        ],
        ...personRows,
      ],
    },
    {
      name: 'Mannschaften',
      rows: [
        ['Person', 'Mannschaft', 'Funktion', 'Rückennummer', 'Von', 'Bis'],
        ...memberships.map((r) => [
          nameOf(r.m.personId),
          `${r.badge} · ${r.team}`,
          FUNCTION_LABEL[r.m.function] ?? r.m.function,
          r.m.jerseyNumber === null ? '' : String(r.m.jerseyNumber),
          germanDate(r.m.validFrom),
          germanDate(r.m.validTo),
        ]),
      ],
    },
    {
      name: 'Rollen',
      rows: [
        ['Person', 'Rolle', 'Gilt für'],
        ...roles.map((r) => [nameOf(r.a.personId), r.role, r.a.scopeType]),
      ],
    },
    {
      name: 'Zu- und Absagen',
      rows: [
        ['Person', 'Datum', 'Termin', 'Antwort', 'Grund', 'Anwesend'],
        ...responses.map((r) => [
          nameOf(r.p.personId),
          day(r.startsAt, tz),
          r.title,
          RESPONSE_LABEL[r.p.status] ?? r.p.status,
          r.p.reason ?? '',
          yesNo(r.p.attended),
        ]),
      ],
    },
    {
      name: 'Abwesenheiten',
      rows: [
        ['Person', 'Von', 'Bis', 'Art', 'Notiz'],
        ...absences.map((a) => [
          nameOf(a.personId),
          germanDate(a.startsOn),
          germanDate(a.endsOn),
          a.kind,
          a.note ?? '',
        ]),
      ],
    },
    {
      name: 'Mannschaftskasse',
      rows: [
        ['Person', 'Datum', 'Beschreibung', 'Kategorie', 'Betrag (€)', 'Storniert'],
        ...cash.map((c) => [
          nameOf(c.personId),
          germanDate(c.bookedOn),
          c.description,
          c.category,
          euro(c.direction === 'expense' ? -c.amountCents : c.amountCents),
          c.cancelledAt ? 'Ja' : '',
        ]),
      ],
    },
  ];
  return { baseName: 'Meine Daten', sheets };
}

// ── Datei und Protokoll ───────────────────────────────────────────────────────

const XLSX = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

async function logExport(db: Db, actor: Actor, area: ExportArea, label: string, now: Date) {
  await db.insert(s.auditLog).values({
    clubId: actor.club.id,
    actorUserId: actor.user.id,
    action: 'export.created',
    entityType: 'export',
    entityId: actor.club.id,
    data: { label, area },
    createdAt: now,
  });
}

function encode(built: Built, format: ExportFormat): ExportFile {
  if (format === 'csv')
    return {
      name: `clubroof-${built.baseName}.csv`,
      contentType: 'text/csv;charset=utf-8',
      dataBase64: Buffer.from(writeCsv(built.sheets[0]!.rows), 'utf8').toString('base64'),
    };
  return {
    name: `clubroof-${built.baseName}.xlsx`,
    contentType: XLSX,
    dataBase64: Buffer.from(writeXlsx(built.sheets)).toString('base64'),
  };
}

export async function exportFile(
  db: Db,
  actor: Actor,
  input: { area: ExportArea; teamId?: string | null; format: ExportFormat },
  now: Date,
): Promise<ExportFile> {
  const { area, teamId, format } = input;
  const needTeam = () => {
    if (!teamId) throw notFound('Die Mannschaft');
    return teamId;
  };
  if (area === 'club') {
    if (!isFullAdmin(actor)) throw forbidden('Den Gesamtexport darf nur die Administration.');
    const parts: Built[] = [await membersSheet(db, actor, now)];
    const teams = await db.select().from(s.teams).where(eq(s.teams.clubId, actor.club.id));
    parts.push({
      baseName: 'Mannschaften',
      sheets: [
        {
          name: 'Mannschaften',
          rows: [
            ['Kürzel', 'Name', 'Altersklasse', 'Liga'],
            ...teams.map((t) => [t.badge, t.name, t.ageGroup ?? '', t.league ?? '']),
          ],
        },
      ],
    });
    for (const t of teams) parts.push(await eventsSheet(db, actor, t.id, now));
    parts.push(await cashSheet(db, actor, now), await feesSheet(db, actor, now));
    const files: Record<string, Uint8Array> = {};
    for (const p of parts) files[`${p.baseName}.csv`] = strToU8(writeCsv(p.sheets[0]!.rows));
    await logExport(db, actor, area, 'Export: Gesamtexport des Vereins', now);
    return {
      name: `clubroof-gesamtexport-${toIsoDate(calendarDayOf(now, actor.club.timezone))}.zip`,
      contentType: 'application/zip',
      dataBase64: Buffer.from(zipSync(files)).toString('base64'),
    };
  }
  const built =
    area === 'members'
      ? await membersSheet(db, actor, now)
      : area === 'roster'
        ? await rosterSheet(db, actor, needTeam(), now)
        : area === 'events'
          ? await eventsSheet(db, actor, needTeam(), now)
          : area === 'attendance'
            ? await attendanceSheet(db, actor, needTeam(), now)
            : area === 'cash'
              ? await cashSheet(db, actor, now)
              : area === 'fees'
                ? await feesSheet(db, actor, now)
                : await myDataSheets(db, actor);
  await logExport(db, actor, area, `Export: ${built.baseName}`, now);
  return encode(built, format);
}
