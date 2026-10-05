/**
 * Demodaten für den Demoverein „SV Grün-Weiß Musterstadt“.
 *
 * - Alle Termine werden relativ zum heutigen Datum erzeugt (6 Wochen zurück, 7 Wochen voraus),
 *   damit die Demo jederzeit aktuell wirkt.
 * - Zufallswerte sind über einen festen Seed reproduzierbar.
 * - Der Seed ist wiederholbar: vorhandene Demodaten werden vorher entfernt.
 */
import { randomUUID } from 'node:crypto';
import { fakerDE as faker } from '@faker-js/faker';
import { hash } from '@node-rs/argon2';
import {
  MODULES,
  SYSTEM_ROLES,
  addDays,
  addMinutes,
  at,
  nextWeekday,
  startOfIsoWeek,
  toIsoDate,
  calendarDayOf,
  todayIn,
  type AttendanceStatus,
  type ModuleKey,
} from '@clubroof/core';
import { eq, like } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { createDb, type Db } from '../client';
import * as s from '../schema';
import {
  ABSENCE_REASONS_NO,
  DEMO_CLUB,
  DEMO_EMAIL_DOMAIN,
  DEMO_PASSWORD,
  DOCUMENTS,
  FACILITIES,
  OFFICIALS,
  OPPONENTS,
  ORG_UNITS,
  PERSONAS,
  POSITIONS,
  TEAMS,
  type FacilityKey,
  type OrgUnitKey,
  type PersonaKey,
  type TeamDef,
  type TeamKey,
} from './data';

const DEFAULT_TZ = 'Europe/Berlin';

type Insert<T extends PgTable> = T['$inferInsert'];
type Tx = Parameters<Parameters<Db['transaction']>[0]>[0];

type PersonRow = Insert<typeof s.persons> & { id: string };
type EventRow = Insert<typeof s.events> & { id: string; startsAt: Date };

const ABSENCE_LABELS = {
  vacation: 'Urlaub',
  injury: 'Verletzung',
  illness: 'Krankheit',
  school_work: 'Schule/Beruf',
  suspended: 'Sperre',
  other: 'Sonstiges',
} as const;

async function insertChunked<T extends PgTable>(tx: Tx, table: T, rows: Insert<T>[], size = 500) {
  for (let i = 0; i < rows.length; i += size) {
    await tx.insert(table).values(rows.slice(i, i + size) as never);
  }
}

function weighted<T>(options: [T, number][]): T {
  const total = options.reduce((sum, [, w]) => sum + w, 0);
  let r = faker.number.float({ min: 0, max: total });
  for (const [value, w] of options) {
    r -= w;
    if (r <= 0) return value;
  }
  return options[options.length - 1]![0];
}

function euro(amount: number): number {
  return Math.round(amount * 100);
}

export type SeedSummary = Record<string, number>;

/** Entfernt den Demoverein und die Demo-Logins. */
export async function removeDemoData(db: Db | Tx): Promise<void> {
  await db.delete(s.clubs).where(eq(s.clubs.slug, DEMO_CLUB.slug));
  await db.delete(s.users).where(like(s.users.email, `%@${DEMO_EMAIL_DOMAIN}`));
}

export async function seed(db: Db, options: { now?: Date } = {}): Promise<SeedSummary> {
  const now = options.now ?? new Date();
  faker.seed(1920);

  return db.transaction(async (tx) => {
    await removeDemoData(tx);

    const today = todayIn(DEFAULT_TZ, now);
    const seasonStartYear =
      today.getUTCMonth() >= 6 ? today.getUTCFullYear() : today.getUTCFullYear() - 1;
    const seasonStart = new Date(Date.UTC(seasonStartYear, 6, 1));

    // ── Verein, Bereiche, Saisons, Anlagen ────────────────────────────────────────────────
    const clubId = randomUUID();
    await tx.insert(s.clubs).values({ id: clubId, ...DEMO_CLUB });

    const orgUnitIds = {} as Record<OrgUnitKey, string>;
    await tx.insert(s.orgUnits).values(
      ORG_UNITS.map((u, i) => {
        orgUnitIds[u.key] = randomUUID();
        return { id: orgUnitIds[u.key], clubId, name: u.name, kind: u.key, sortOrder: i };
      }),
    );

    const seasonId = randomUUID();
    await tx.insert(s.seasons).values([
      {
        clubId,
        name: `${seasonStartYear - 1}/${String(seasonStartYear).slice(2)}`,
        startsOn: `${seasonStartYear - 1}-07-01`,
        endsOn: `${seasonStartYear}-06-30`,
        isCurrent: false,
      },
      {
        id: seasonId,
        clubId,
        name: `${seasonStartYear}/${String(seasonStartYear + 1).slice(2)}`,
        startsOn: `${seasonStartYear}-07-01`,
        endsOn: `${seasonStartYear + 1}-06-30`,
        isCurrent: true,
      },
    ]);

    const facilityIds = {} as Record<FacilityKey, string>;
    await tx.insert(s.facilities).values(
      FACILITIES.map((f, i) => {
        facilityIds[f.key] = randomUUID();
        return {
          id: facilityIds[f.key],
          clubId,
          name: f.name,
          shortName: f.shortName,
          kind: f.kind,
          address: `${DEMO_CLUB.street}, ${DEMO_CLUB.postalCode} ${DEMO_CLUB.city}`,
          sortOrder: i,
        };
      }),
    );

    // ── Logins der Demo-Personas ──────────────────────────────────────────────────────────
    const userIds = {} as Record<PersonaKey, string>;
    const passwordHash = await hash(DEMO_PASSWORD);
    await tx.insert(s.users).values(
      (Object.keys(PERSONAS) as PersonaKey[]).map((key) => {
        userIds[key] = randomUUID();
        const p = PERSONAS[key];
        return {
          id: userIds[key],
          email: p.email,
          displayName: `${p.firstName} ${p.lastName}`,
          passwordHash,
        };
      }),
    );

    // ── Personen ──────────────────────────────────────────────────────────────────────────
    const persons: PersonRow[] = [];
    let memberSeq = 10001;

    function addPerson(input: {
      firstName: string;
      lastName: string;
      birthDate: string;
      email?: string;
      userId?: string;
      position?: string;
      preferredFoot?: 'left' | 'right' | 'both';
    }): PersonRow {
      const birthYear = Number(input.birthDate.slice(0, 4));
      const earliest = new Date(Date.UTC(Math.max(birthYear + 5, 1995), 0, 1));
      const memberSince = faker.date.between({ from: earliest, to: addDays(today, -30) });
      const row: PersonRow = {
        id: randomUUID(),
        clubId,
        userId: input.userId ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        birthDate: input.birthDate,
        email:
          input.email ??
          (birthYear <= 2010
            ? faker.internet
                .email({
                  firstName: input.firstName,
                  lastName: input.lastName,
                  provider: 'mail.example',
                })
                .toLowerCase()
            : null),
        phone: birthYear <= 2010 ? faker.phone.number({ style: 'national' }) : null,
        memberNumber: String(memberSeq++),
        memberSince: toIsoDate(memberSince),
        position: input.position ?? null,
        preferredFoot: input.preferredFoot ?? null,
      };
      persons.push(row);
      return row;
    }

    function randomBirthDate(fromYear: number, toYear: number): string {
      const date = faker.date.between({
        from: new Date(Date.UTC(fromYear, 0, 1)),
        to: new Date(Date.UTC(toYear, 11, 31)),
      });
      return toIsoDate(date);
    }

    function randomAdult(sex: 'male' | 'female', lastName?: string): PersonRow {
      return addPerson({
        firstName: faker.person.firstName(sex),
        lastName: lastName ?? faker.person.lastName(),
        birthDate: randomBirthDate(1965, 1992),
      });
    }

    const persona = {} as Record<PersonaKey, PersonRow>;
    for (const key of Object.keys(PERSONAS) as PersonaKey[]) {
      const p = PERSONAS[key];
      persona[key] = addPerson({
        firstName: p.firstName,
        lastName: p.lastName,
        birthDate: p.birthDate,
        email: p.email,
        userId: userIds[key],
        ...(key === 'player'
          ? { position: 'Zentrales Mittelfeld', preferredFoot: 'right' as const }
          : {}),
        ...(key === 'coach' ? { position: 'Sturm', preferredFoot: 'left' as const } : {}),
      });
    }

    const official = {} as Record<keyof typeof OFFICIALS, PersonRow>;
    for (const key of Object.keys(OFFICIALS) as (keyof typeof OFFICIALS)[]) {
      official[key] = addPerson({ ...OFFICIALS[key] });
    }

    // Kinder der Eltern-Persona
    const leon = addPerson({
      firstName: 'Leon',
      lastName: 'Neumann',
      birthDate: '2016-08-23',
      position: 'Sturm',
      preferredFoot: 'right',
    });
    const mia = addPerson({
      firstName: 'Mia',
      lastName: 'Neumann',
      birthDate: '2018-03-05',
      position: 'Zentrales Mittelfeld',
      preferredFoot: 'left',
    });

    const guardianships: Insert<typeof s.guardianships>[] = [
      { clubId, guardianPersonId: persona.parent.id, childPersonId: leon.id },
      { clubId, guardianPersonId: persona.parent.id, childPersonId: mia.id },
    ];

    type Member = {
      person: PersonRow;
      fn: 'player' | 'coach' | 'assistant_coach';
      jersey?: number;
    };
    const teamMembers = {} as Record<TeamKey, Member[]>;

    const fixedPlayers: Partial<Record<TeamKey, PersonRow[]>> = {
      h2: [persona.coach],
      b1: [persona.player],
      e1: [leon],
      fj: [mia],
    };

    for (const team of TEAMS) {
      const members: Member[] = [];
      const players: PersonRow[] = [...(fixedPlayers[team.key] ?? [])];
      while (players.length < team.playerCount) {
        const sex =
          team.gender === 'mixed'
            ? weighted<'male' | 'female'>([
                ['male', 3],
                ['female', 1],
              ])
            : team.gender;
        const isKeeper = players.length < 2;
        players.push(
          addPerson({
            firstName: faker.person.firstName(sex),
            lastName: faker.person.lastName(),
            birthDate: randomBirthDate(team.birthYears[0], team.birthYears[1]),
            position: isKeeper ? 'Torwart' : faker.helpers.arrayElement(POSITIONS.slice(1)),
            preferredFoot: weighted<'left' | 'right' | 'both'>([
              ['right', 70],
              ['left', 22],
              ['both', 8],
            ]),
          }),
        );
      }

      const numbers = faker.helpers.shuffle(Array.from({ length: 98 }, (_, i) => i + 2));
      players.forEach((person, i) => {
        const jersey = person.position === 'Torwart' ? (i === 0 ? 1 : 12) : numbers.pop()!;
        members.push({ person, fn: 'player', jersey: person === persona.player ? 14 : jersey });
      });

      // Eltern für Kinder bis einschließlich C-Jugend
      for (const child of players) {
        if (Number(child.birthDate!.slice(0, 4)) >= 2012 && child !== leon && child !== mia) {
          const guardian = randomAdult(
            faker.helpers.arrayElement(['male', 'female']),
            child.lastName,
          );
          guardianships.push({ clubId, guardianPersonId: guardian.id, childPersonId: child.id });
        }
      }

      teamMembers[team.key] = members;
    }

    // Trainerinnen und Trainer
    const addCoach = (team: TeamKey, person: PersonRow, fn: Member['fn'] = 'coach') =>
      teamMembers[team].push({ person, fn });
    addCoach('h1', official.headCoach);
    addCoach('h1', randomAdult('male'), 'assistant_coach');
    addCoach('h2', official.youthDirector);
    addCoach('ah', teamMembers.ah[5]!.person);
    addCoach('f1', randomAdult('female'));
    addCoach('a1', randomAdult('male'));
    addCoach('b1', persona.coach);
    addCoach('b1', randomAdult('male'), 'assistant_coach');
    addCoach('c1', persona.coach);
    addCoach('c1', randomAdult('female'), 'assistant_coach');
    addCoach('d1', randomAdult('male'));
    addCoach('e1', randomAdult('male'));
    addCoach('e1', persona.parent, 'assistant_coach');
    addCoach('fj', randomAdult('female'));
    addCoach('bam', randomAdult('male'));
    addCoach('bam', randomAdult('female'), 'assistant_coach');

    // Fördernde Mitglieder ohne Mannschaft
    for (let i = 0; i < 40; i++) {
      randomAdult(faker.helpers.arrayElement(['male', 'female']));
    }

    await insertChunked(tx, s.persons, persons);
    await insertChunked(tx, s.guardianships, guardianships);

    const guardianOf = new Map<string, string>();
    for (const g of guardianships) {
      if (!guardianOf.has(g.childPersonId)) guardianOf.set(g.childPersonId, g.guardianPersonId);
    }

    // ── Mannschaften ──────────────────────────────────────────────────────────────────────
    const teamIds = {} as Record<TeamKey, string>;
    await tx.insert(s.teams).values(
      TEAMS.map((t, i) => {
        teamIds[t.key] = randomUUID();
        return {
          id: teamIds[t.key],
          clubId,
          orgUnitId: orgUnitIds[t.unit],
          seasonId,
          name: t.name,
          badge: t.badge,
          ageGroup: t.ageGroup,
          league: t.league,
          template: t.template,
          participationMode: t.mode,
          sortOrder: i,
        };
      }),
    );

    const memberships: Insert<typeof s.teamMemberships>[] = [];
    for (const team of TEAMS) {
      for (const m of teamMembers[team.key]) {
        memberships.push({
          clubId,
          teamId: teamIds[team.key],
          personId: m.person.id,
          function: m.fn,
          jerseyNumber: m.jersey ?? null,
          isPrimaryTeam: !(m.person === persona.coach && m.fn === 'player'),
          validFrom: toIsoDate(seasonStart),
        });
      }
    }
    await insertChunked(tx, s.teamMemberships, memberships);

    const deadlineRules: Insert<typeof s.teamDeadlineRules>[] = [];
    for (const team of TEAMS) {
      const teamId = teamIds[team.key];
      if (team.mode === 'auto_accept') {
        deadlineRules.push(
          { clubId, teamId, eventType: 'training', kind: 'relative', minutesBefore: 120 },
          {
            clubId,
            teamId,
            eventType: 'match',
            kind: 'weekday_time',
            weekday: 5,
            timeOfDay: '18:00',
          },
        );
      } else if (team.mode === 'active_response') {
        deadlineRules.push(
          { clubId, teamId, eventType: 'training', kind: 'relative', minutesBefore: 180 },
          { clubId, teamId, eventType: 'match', kind: 'relative', minutesBefore: 2 * 24 * 60 },
          { clubId, teamId, eventType: 'tournament', kind: 'relative', minutesBefore: 3 * 24 * 60 },
        );
      }
    }
    await tx.insert(s.teamDeadlineRules).values(deadlineRules);

    // ── Rollen & Rechte ───────────────────────────────────────────────────────────────────
    const roleIds: Record<string, string> = {};
    await tx.insert(s.roles).values(
      SYSTEM_ROLES.map((r) => {
        roleIds[r.key] = randomUUID();
        return {
          id: roleIds[r.key],
          clubId,
          key: r.key,
          name: r.name,
          description: r.description,
          isSystem: true,
          permissions: r.permissions,
        };
      }),
    );

    const roleAssignments: Insert<typeof s.roleAssignments>[] = [
      { clubId, personId: persona.admin.id, roleId: roleIds.fulladmin!, scopeType: 'club' },
      { clubId, personId: persona.board.id, roleId: roleIds.board!, scopeType: 'club' },
      { clubId, personId: persona.treasurer.id, roleId: roleIds.treasurer!, scopeType: 'club' },
      {
        clubId,
        personId: official.sportsDirector.id,
        roleId: roleIds.sports_director!,
        scopeType: 'club',
      },
      {
        clubId,
        personId: official.youthDirector.id,
        roleId: roleIds.youth_director!,
        scopeType: 'org_unit',
        scopeId: orgUnitIds.youth,
      },
      {
        clubId,
        personId: official.facilityManager.id,
        roleId: roleIds.facility_manager!,
        scopeType: 'club',
      },
      {
        clubId,
        personId: official.memberAdmin.id,
        roleId: roleIds.member_admin!,
        scopeType: 'club',
      },
      {
        clubId,
        personId: official.refereeLead.id,
        roleId: roleIds.referee_lead!,
        scopeType: 'club',
      },
    ];
    for (const team of TEAMS) {
      for (const m of teamMembers[team.key]) {
        if (m.fn !== 'player') {
          roleAssignments.push({
            clubId,
            personId: m.person.id,
            roleId: roleIds.coach!,
            scopeType: 'team',
            scopeId: teamIds[team.key],
          });
        }
      }
    }
    // Teamkassierer der 1. Mannschaft ist ein Spieler
    roleAssignments.push({
      clubId,
      personId: teamMembers.h1[3]!.person.id,
      roleId: roleIds.treasurer!,
      scopeType: 'team',
      scopeId: teamIds.h1,
    });
    await tx.insert(s.roleAssignments).values(roleAssignments);

    // ── Module ────────────────────────────────────────────────────────────────────────────
    const notYetEnabled: ModuleKey[] = ['forum', 'training_planning', 'lost_and_found'];
    const moduleRows: Insert<typeof s.moduleSettings>[] = MODULES.map((m) => ({
      clubId,
      scopeType: 'club',
      scopeId: null,
      moduleKey: m.key,
      state: notYetEnabled.includes(m.key) ? 'available' : 'enabled',
      level: 'basic',
    }));

    const teamModule = (
      team: TeamKey,
      moduleKey: ModuleKey,
      state: 'enabled' | 'available',
      level: 'off' | 'basic' | 'extended' | 'custom' = 'basic',
      config: Record<string, unknown> = {},
    ) =>
      moduleRows.push({
        clubId,
        scopeType: 'team',
        scopeId: teamIds[team],
        moduleKey,
        state,
        level,
        config,
      });

    for (const team of TEAMS) {
      const k = team.key;
      const youngKids = ['e1', 'fj', 'bam'].includes(k);
      switch (team.template) {
        case 'performance':
          teamModule(k, 'statistics', 'enabled', 'extended');
          teamModule(k, 'team_cash', 'enabled', 'basic', { fines: true, drinks: true });
          teamModule(k, 'jersey_numbers', 'enabled', 'basic', { mode: 'season' });
          teamModule(k, 'squad', 'enabled', 'extended', { lineups: true });
          break;
        case 'classic':
          teamModule(k, 'statistics', 'enabled', 'basic');
          teamModule(k, 'team_cash', 'enabled', 'basic', { fines: k === 'h2', drinks: true });
          teamModule(k, 'jersey_numbers', 'enabled', 'basic', { mode: 'match' });
          break;
        case 'leisure':
          teamModule(k, 'statistics', 'available', 'off');
          teamModule(k, 'team_cash', 'enabled', 'basic', { fines: false, drinks: true });
          teamModule(k, 'jersey_numbers', 'available', 'off');
          break;
        case 'youth':
          teamModule(
            k,
            'statistics',
            youngKids ? 'available' : 'enabled',
            youngKids ? 'off' : 'basic',
          );
          teamModule(k, 'team_cash', k === 'a1' || k === 'b1' ? 'enabled' : 'available', 'basic', {
            fines: false,
            drinks: false,
          });
          teamModule(k, 'jersey_numbers', youngKids ? 'available' : 'enabled', 'basic', {
            mode: 'match',
          });
          teamModule(
            k,
            'parent_access',
            ['c1', 'd1', 'e1', 'fj', 'bam'].includes(k) ? 'enabled' : 'available',
          );
          break;
      }
    }
    await tx.insert(s.moduleSettings).values(moduleRows);

    // ── Termine ───────────────────────────────────────────────────────────────────────────
    const windowStart = addDays(startOfIsoWeek(today), -42);
    const weeks = 13;
    const events: EventRow[] = [];
    const matchDetails: Insert<typeof s.matchDetails>[] = [];
    const teamOfEvent = new Map<string, TeamDef>();

    const isFacilityFree = (facilityId: string, start: Date, end: Date) =>
      !events.some(
        (e) =>
          e.facilityId === facilityId &&
          e.status !== 'cancelled' &&
          e.startsAt < end &&
          (e.endsAt ?? e.startsAt) > start,
      );

    // Kunstrasen am kommenden Donnerstag gesperrt → betroffene Trainings fallen aus
    const closedDay = nextWeekday(addDays(today, 1), 4);

    // Erst alle Trainings (feste Platzzeiten), dann die Spiele
    for (const team of TEAMS) {
      const teamId = teamIds[team.key];
      const seriesIds = team.trainings.map(() => randomUUID());
      for (let w = 0; w < weeks; w++) {
        team.trainings.forEach((tr, i) => {
          const day = addDays(windowStart, w * 7 + tr.weekday - 1);
          const startsAt = at(day, tr.start);
          const cancelled = tr.facility === 'kunstrasen' && day.getTime() === closedDay.getTime();
          const event: EventRow = {
            id: randomUUID(),
            clubId,
            teamId,
            orgUnitId: orgUnitIds[team.unit],
            type: 'training',
            status: cancelled ? 'cancelled' : 'scheduled',
            cancelledReason: cancelled ? 'Kunstrasen gesperrt (Platzpflege)' : null,
            title: 'Training',
            startsAt,
            endsAt: addMinutes(startsAt, tr.minutes),
            meetingAt: addMinutes(startsAt, -15),
            meetingPoint: 'Kabine Vereinsheim',
            facilityId: facilityIds[tr.facility],
            seriesId: seriesIds[i],
          };
          events.push(event);
          teamOfEvent.set(event.id, team);
        });
      }
    }

    TEAMS.forEach((team, teamIndex) => {
      const teamId = teamIds[team.key];
      let matchNo = 0;

      for (let w = 0; w < weeks; w++) {
        if (w % team.match.everyWeeks !== teamIndex % team.match.everyWeeks) continue;
        const day = addDays(windowStart, w * 7 + team.match.weekday - 1);
        const startsAt = at(day, team.match.time);
        const opponent = OPPONENTS[(w + teamIndex * 5) % OPPONENTS.length]!;
        const endsAt = addMinutes(startsAt, team.match.minutes);
        // Heimspiel nur, wenn der Platz frei ist – sonst wird es ein Auswärtsspiel
        const isHome =
          (matchNo++ + teamIndex) % 2 === 0 &&
          isFacilityFree(facilityIds[team.match.homeFacility], startsAt, endsAt);
        const opponentTown = opponent.split(' ').slice(1).join(' ');
        const ourName = team.matchName;

        const event: EventRow = {
          id: randomUUID(),
          clubId,
          teamId,
          orgUnitId: orgUnitIds[team.unit],
          type: team.match.asTournament ? 'tournament' : 'match',
          title: team.match.asTournament
            ? `Spielfest ${isHome ? 'auf unserer Anlage' : `in ${opponentTown}`}`
            : isHome
              ? `${ourName} – ${opponent}`
              : `${opponent} – ${ourName}`,
          startsAt,
          endsAt,
          meetingAt: addMinutes(startsAt, isHome ? -60 : -90),
          meetingPoint: isHome
            ? 'Kabine Vereinsheim'
            : 'Parkplatz Vereinsheim (Fahrgemeinschaften)',
          facilityId: isHome ? facilityIds[team.match.homeFacility] : null,
          locationText: isHome ? null : `Sportplatz ${opponentTown}`,
        };
        events.push(event);
        teamOfEvent.set(event.id, team);

        if (!team.match.asTournament) {
          const played = addMinutes(startsAt, team.match.minutes) < now;
          matchDetails.push({
            eventId: event.id,
            clubId,
            opponentName: opponent,
            isHome,
            competition: team.league,
            goalsFor: played
              ? weighted([
                  [0, 2],
                  [1, 4],
                  [2, 4],
                  [3, 3],
                  [4, 1],
                  [5, 1],
                ])
              : null,
            goalsAgainst: played
              ? weighted([
                  [0, 3],
                  [1, 4],
                  [2, 3],
                  [3, 2],
                  [4, 1],
                ])
              : null,
          });
        }
      }
    });

    // Vereinstermine
    const clubEvent = (input: Omit<EventRow, 'id' | 'clubId'>): EventRow => {
      const e: EventRow = { id: randomUUID(), clubId, ...input };
      events.push(e);
      return e;
    };
    const workDay = nextWeekday(addDays(today, 8), 6);
    const workAssignment = clubEvent({
      type: 'work_assignment',
      title: 'Arbeitseinsatz Platzpflege',
      program: [
        { time: '09:00', title: 'Treffen am Vereinsheim, Aufgabenverteilung' },
        { time: '11:00', title: 'Weißwurstfrühstück' },
        { time: '13:00', title: 'Ende' },
      ],
      description:
        'Gemeinsam machen wir die Anlage winterfest: Laub entfernen, Tornetze tauschen, Vereinsheim streichen. Für Verpflegung ist gesorgt!',
      startsAt: at(workDay, '09:00'),
      endsAt: at(workDay, '13:00'),
      facilityId: facilityIds.vereinsheim,
      meetingPoint: 'Treffpunkt Vereinsheim, danach gesamte Anlage',
      contactPersonId: official.facilityManager.id,
    });
    const boardMeetingDay = nextWeekday(addDays(today, 3), 2);
    clubEvent({
      type: 'meeting',
      title: 'Vorstandssitzung',
      startsAt: at(boardMeetingDay, '19:30'),
      endsAt: at(boardMeetingDay, '21:30'),
      facilityId: facilityIds.vereinsheim,
      contactPersonId: persona.board.id,
    });
    const agmDay = nextWeekday(addDays(today, 20), 5);
    const agm = clubEvent({
      type: 'meeting',
      title: 'Jahreshauptversammlung',
      program: [
        { time: '19:00', title: 'Begrüßung und Feststellung der Beschlussfähigkeit' },
        { time: '19:15', title: 'Berichte des Vorstands und der Abteilungen' },
        { time: '20:00', title: 'Kassenbericht und Entlastung' },
        { time: '20:30', title: 'Neuwahlen' },
        { time: '21:15', title: 'Anträge und Verschiedenes' },
      ],
      description:
        'Tagesordnung: Berichte des Vorstands, Kassenbericht, Entlastung, Neuwahlen, Anträge. Alle Mitglieder ab 16 Jahren sind stimmberechtigt.',
      startsAt: at(agmDay, '19:00'),
      endsAt: at(agmDay, '22:00'),
      facilityId: facilityIds.vereinsheim,
      contactPersonId: persona.board.id,
    });
    const tournamentDay = nextWeekday(addDays(today, 38), 6);
    const hallTournament = clubEvent({
      type: 'club_event',
      orgUnitId: orgUnitIds.youth,
      title: 'Jugend-Hallenturnier',
      program: [
        { time: '09:00', title: 'Begrüßung und Vorrunde E-Jugend' },
        { time: '11:30', title: 'Vorrunde F-Jugend und Bambini' },
        { time: '14:00', title: 'Halbfinale' },
        { time: '16:30', title: 'Finalspiele' },
        { time: '17:30', title: 'Siegerehrung' },
      ],
      description:
        'Unser traditionelles Hallenturnier für E-, F-Jugend und Bambini mit 24 Mannschaften. Wir brauchen viele helfende Hände!',
      startsAt: at(tournamentDay, '09:00'),
      endsAt: at(tournamentDay, '18:00'),
      facilityId: facilityIds.halle,
      contactPersonId: official.youthDirector.id,
    });
    const xmasDay = new Date(Date.UTC(today.getUTCFullYear(), 11, 1));
    const xmasParty = clubEvent({
      type: 'club_event',
      title: 'Weihnachtsfeier',
      program: [
        { time: '18:00', title: 'Glühwein und Begrüßung' },
        { time: '19:00', title: 'Essen' },
        { time: '20:30', title: 'Ehrungen und Jahresrückblick' },
        { time: '21:30', title: 'Gemütlicher Ausklang' },
      ],
      description: 'Gemütlicher Jahresausklang für die ganze Grün-Weiß-Familie.',
      startsAt: at(nextWeekday(addDays(xmasDay, 7), 6), '18:00'),
      endsAt: at(nextWeekday(addDays(xmasDay, 7), 6), '23:00'),
      facilityId: facilityIds.vereinsheim,
      contactPersonId: persona.board.id,
    });
    clubEvent({
      type: 'club_event',
      title: 'Saisoneröffnung',
      description: 'Vorstellung aller Mannschaften, Grillen und Elfmeterturnier.',
      startsAt: at(addDays(seasonStart, 45), '14:00'),
      endsAt: at(addDays(seasonStart, 45), '20:00'),
      facilityId: facilityIds.rasen,
      contactPersonId: persona.board.id,
    });

    if (xmasParty.startsAt < now) xmasParty.status = 'cancelled';

    await insertChunked(tx, s.events, events);
    await insertChunked(tx, s.matchDetails, matchDetails);

    // ── Abwesenheiten ─────────────────────────────────────────────────────────────────────
    const pick = (team: TeamKey, index: number) =>
      teamMembers[team].filter((m) => m.fn === 'player')[index]!.person;
    const absences: (Insert<typeof s.absences> & { id?: string; personId: string })[] = [
      {
        clubId,
        personId: pick('h1', 6).id,
        kind: 'injury',
        startsOn: toIsoDate(addDays(today, -12)),
        endsOn: toIsoDate(addDays(today, 18)),
        note: 'Bänderdehnung',
      },
      {
        clubId,
        personId: pick('h1', 11).id,
        kind: 'injury',
        startsOn: toIsoDate(addDays(today, -4)),
        endsOn: toIsoDate(addDays(today, 10)),
      },
      {
        clubId,
        personId: pick('h1', 9).id,
        kind: 'suspended',
        startsOn: toIsoDate(today),
        endsOn: toIsoDate(nextWeekday(today, 7)),
        note: 'Rotsperre (1 Spiel)',
      },
      {
        clubId,
        personId: pick('h2', 4).id,
        kind: 'vacation',
        startsOn: toIsoDate(addDays(today, 5)),
        endsOn: toIsoDate(addDays(today, 16)),
      },
      {
        clubId,
        personId: pick('f1', 2).id,
        kind: 'vacation',
        startsOn: toIsoDate(addDays(today, 9)),
        endsOn: toIsoDate(addDays(today, 15)),
      },
      {
        clubId,
        personId: pick('b1', 7).id,
        kind: 'illness',
        startsOn: toIsoDate(addDays(today, -1)),
        endsOn: toIsoDate(addDays(today, 3)),
      },
      {
        clubId,
        personId: pick('a1', 3).id,
        kind: 'school_work',
        startsOn: toIsoDate(addDays(today, 2)),
        endsOn: toIsoDate(addDays(today, 8)),
        note: 'Abiturvorbereitung',
      },
      {
        clubId,
        personId: persona.player.id,
        kind: 'vacation',
        startsOn: toIsoDate(addDays(today, 18)),
        endsOn: toIsoDate(addDays(today, 22)),
        note: 'Familienurlaub',
      },
      {
        clubId,
        personId: pick('ah', 2).id,
        kind: 'vacation',
        startsOn: toIsoDate(addDays(today, -3)),
        endsOn: toIsoDate(addDays(today, 9)),
      },
    ];
    for (const a of absences) {
      a.id = randomUUID();
      a.createdByPersonId = a.personId;
    }
    await tx.insert(s.absences).values(absences);

    function absenceOn(personId: string, day: string) {
      return absences.find((a) => a.personId === personId && a.startsOn <= day && day <= a.endsOn);
    }

    // ── Teilnahmen ────────────────────────────────────────────────────────────────────────
    const participants: Insert<typeof s.eventParticipants>[] = [];
    const nextEventOf = (team: TeamKey, type: 'match' | 'tournament' | 'training') =>
      events
        .filter(
          (e) =>
            e.teamId === teamIds[team] &&
            e.type === type &&
            e.startsAt > now &&
            e.status !== 'cancelled',
        )
        .sort((a, b) => a.startsAt.getTime() - b.startsAt.getTime())[0];

    const nextB1Match = nextEventOf('b1', 'match');
    const nextB1Training = nextEventOf('b1', 'training');
    const nextE1Match = nextEventOf('e1', 'match');
    const nextFjTournament = nextEventOf('fj', 'tournament');
    const nextH1Match = nextEventOf('h1', 'match');

    for (const event of events) {
      const team = teamOfEvent.get(event.id);
      if (!team) continue;
      const isPast = event.startsAt < now;
      const daysAhead = (event.startsAt.getTime() - now.getTime()) / 86_400_000;
      const eventDay = toIsoDate(calendarDayOf(event.startsAt));

      // Spielertrainer (z. B. Alte Herren) nur einmal – als Spieler – berücksichtigen
      const seen = new Set<string>();
      const ordered = [...teamMembers[team.key]].sort(
        (a, b) => Number(a.fn !== 'player') - Number(b.fn !== 'player'),
      );
      for (const m of ordered) {
        const personId = m.person.id;
        if (seen.has(personId)) continue;
        seen.add(personId);
        if (m.fn !== 'player') {
          participants.push({
            clubId,
            eventId: event.id,
            personId,
            role: 'coach',
            status: 'yes',
            respondedAt: isPast ? event.startsAt : null,
          });
          continue;
        }

        let status: AttendanceStatus;
        let reason: string | null = null;
        let explicit = true;
        const absence = absenceOn(personId, eventDay);

        if (absence) {
          status = 'no';
          reason = `Abwesend: ${ABSENCE_LABELS[absence.kind]}`;
          explicit = false;
        } else if (isPast) {
          status = weighted<AttendanceStatus>([
            ['yes', 82],
            ['no', 15],
            ['pending', team.mode === 'active_response' ? 3 : 0],
          ]);
        } else if (team.mode === 'active_response') {
          status =
            daysAhead <= 7
              ? weighted<AttendanceStatus>([
                  ['yes', 60],
                  ['no', 10],
                  ['maybe', 5],
                  ['pending', 25],
                ])
              : weighted<AttendanceStatus>([
                  ['yes', 20],
                  ['no', 3],
                  ['pending', 77],
                ]);
        } else {
          status = weighted<AttendanceStatus>([
            ['yes', 92],
            ['no', 8],
          ]);
          explicit = status === 'no';
        }

        // Feste Zustände für die Demo-Personas
        if (event === nextB1Match && m.person === persona.player) status = 'yes';
        if (event === nextB1Training && m.person === persona.player) status = 'pending';
        if (event === nextE1Match && m.person === leon) status = 'pending';
        if (event === nextFjTournament && m.person === mia) status = 'pending';

        if (status === 'no' && !reason) reason = faker.helpers.arrayElement(ABSENCE_REASONS_NO);
        if (status === 'pending') explicit = false;

        const respondedAt = explicit
          ? isPast
            ? addMinutes(event.startsAt, -faker.number.int({ min: 60, max: 5 * 24 * 60 }))
            : addMinutes(now, -faker.number.int({ min: 10, max: 3 * 24 * 60 }))
          : null;

        participants.push({
          clubId,
          eventId: event.id,
          personId,
          role: 'player',
          status,
          reason,
          respondedAt,
          respondedByPersonId: respondedAt ? (guardianOf.get(personId) ?? personId) : null,
          absenceId: absence?.id ?? null,
        });
      }
    }

    // Gastspieler: C-Jugend hilft in der B-Jugend aus, 2. Mannschaft in der 1. Mannschaft
    const guests: { event: EventRow | undefined; from: TeamKey; person: PersonRow }[] = [
      { event: nextB1Match, from: 'c1', person: pick('c1', 4) },
      { event: nextH1Match, from: 'h2', person: pick('h2', 7) },
    ];
    for (const g of guests) {
      if (!g.event) continue;
      participants.push({
        clubId,
        eventId: g.event.id,
        personId: g.person.id,
        role: 'guest_player',
        status: 'yes',
        guestFromTeamId: teamIds[g.from],
        respondedAt: addMinutes(now, -180),
        respondedByPersonId: g.person.id,
      });
    }
    // Freiwillige Teilnahme an Vereinsveranstaltungen („Ich nehme teil“)
    const attendeePool = faker.helpers.shuffle(
      persons.filter((p) => Number(p.birthDate!.slice(0, 4)) <= 2008 && p.id !== persona.parent.id),
    );
    (
      [
        [hallTournament, 26],
        [xmasParty, 41],
        [agm, 23],
        [workAssignment, 12],
      ] as const
    ).forEach(([event, n], i) => {
      for (const person of attendeePool.slice(i * 15, i * 15 + n)) {
        participants.push({
          clubId,
          eventId: event.id,
          personId: person.id,
          role: 'attendee',
          status: 'yes',
          respondedAt: addMinutes(now, -faker.number.int({ min: 60, max: 10 * 24 * 60 })),
          respondedByPersonId: person.id,
        });
      }
    });
    await insertChunked(tx, s.eventParticipants, participants);

    // ── News ──────────────────────────────────────────────────────────────────────────────
    const hoursAgo = (h: number) => addMinutes(now, -h * 60);
    const news = (input: Omit<Insert<typeof s.announcements>, 'clubId'>) => ({
      id: randomUUID(),
      clubId,
      status: 'published' as const,
      ...input,
    });
    const closedDayLabel = closedDay.toLocaleDateString('de-DE', {
      weekday: 'long',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'UTC',
    });
    const announcementRows = [
      news({
        scopeType: 'club',
        title: 'Kunstrasen am Donnerstag gesperrt',
        teaser: `Am ${closedDayLabel} ist kein Training auf dem Kunstrasen möglich.`,
        body: `Wegen der jährlichen Tiefenreinigung und Granulatpflege ist der Kunstrasen am ${closedDayLabel} ganztägig gesperrt. Betroffene Trainingseinheiten entfallen, die Trainer sind informiert.`,
        priority: 'urgent',
        authorPersonId: official.facilityManager.id,
        publishedAt: hoursAgo(2),
        viewCount: 211,
      }),
      news({
        scopeType: 'team',
        scopeId: teamIds.b1,
        title: 'Training am Donnerstag entfällt',
        teaser: 'Wegen der Kunstrasen-Sperrung fällt das Training aus.',
        body: 'Das Training am Donnerstag entfällt wegen der Kunstrasen-Sperrung. Bitte nutzt den Tag für eine lockere Laufeinheit. Am Samstag geht es wie gewohnt weiter.',
        priority: 'important',
        authorPersonId: persona.coach.id,
        publishedAt: hoursAgo(4),
        viewCount: 19,
      }),
      news({
        scopeType: 'club',
        title: 'Neue Flutlichtanlage offiziell eröffnet',
        teaser: 'Nachhaltiger, heller, effizienter – ein Gewinn für alle.',
        body: 'Ein großer Moment für unseren Verein: Am Freitagabend haben wir unsere neue Flutlichtanlage offiziell eingeweiht.\n\nNach monatelanger Planung und tatkräftiger Unterstützung vieler Helferinnen und Helfer erstrahlt unser Platz nun in modernem LED-Licht – für bessere Trainingsbedingungen, mehr Energieeffizienz und eine nachhaltige Zukunft.\n\nWir bedanken uns herzlich bei allen Beteiligten, unseren Sponsoren und der Gemeinde für die großartige Unterstützung! Gemeinsam bewegen wir Grün-Weiß.',
        priority: 'info',
        authorPersonId: persona.board.id,
        publishedAt: hoursAgo(26),
        viewCount: 524,
        likeCount: 45,
      }),
      news({
        scopeType: 'club',
        title: 'Einladung zur Jahreshauptversammlung',
        teaser: 'Alle Mitglieder sind herzlich eingeladen.',
        body: 'Der Vorstand lädt alle Mitglieder herzlich zur Jahreshauptversammlung im Vereinsheim ein. Die Tagesordnung findet ihr im Termin. Anträge bitte bis eine Woche vorher schriftlich beim Vorstand einreichen.',
        priority: 'important',
        authorPersonId: persona.board.id,
        publishedAt: hoursAgo(30),
        viewCount: 302,
      }),
      news({
        scopeType: 'team',
        scopeId: teamIds.h1,
        title: 'Trikots bitte rechtzeitig waschen',
        teaser: 'Bitte bis spätestens Samstag abgeben.',
        body: 'Wer diese Woche mit dem Waschen dran ist: Bitte die Trikots bis spätestens Samstag in der Kabine abgeben. Danke!',
        priority: 'important',
        authorPersonId: official.headCoach.id,
        publishedAt: hoursAgo(28),
        viewCount: 21,
      }),
      news({
        scopeType: 'org_unit',
        scopeId: orgUnitIds.youth,
        title: 'Anmeldung Jugend-Hallenturnier geöffnet',
        teaser: 'Helferinnen und Helfer gesucht – tragt euch ein!',
        body: 'Unser Hallenturnier steht vor der Tür. Für Grillstand, Getränke, Kasse sowie Auf- und Abbau suchen wir noch Unterstützung. Tragt euch einfach im Termin in eine Schicht ein.',
        priority: 'info',
        authorPersonId: official.youthDirector.id,
        publishedAt: hoursAgo(72),
        viewCount: 188,
        likeCount: 12,
      }),
      news({
        scopeType: 'club',
        title: 'Danke an unsere Ehrenamtlichen!',
        teaser: 'Ohne euch läuft nichts – danke für euren Einsatz.',
        body: 'Über 40 Helferinnen und Helfer haben bei der Saisoneröffnung mit angepackt. Dafür sagen wir von Herzen: Danke!',
        priority: 'info',
        authorPersonId: persona.board.id,
        publishedAt: hoursAgo(6 * 24),
        viewCount: 410,
        likeCount: 63,
      }),
      news({
        scopeType: 'club',
        title: 'Neue Fanschals im Vereinsheim erhältlich',
        teaser: 'Für 15 € in Grün-Weiß – solange der Vorrat reicht.',
        body: 'Ab sofort gibt es neue Fanschals im Vereinsheim. Der Erlös geht vollständig an unsere Jugendabteilung.',
        priority: 'info',
        authorPersonId: persona.board.id,
        publishedAt: hoursAgo(9 * 24),
        viewCount: 276,
        likeCount: 18,
      }),
      news({
        scopeType: 'club',
        status: 'pending_approval',
        title: 'Rückblick Saisoneröffnung',
        teaser: 'Ein toller Tag mit über 300 Gästen.',
        body: 'Bei bestem Wetter haben wir die neue Saison eröffnet. Alle Mannschaften wurden vorgestellt, das Elfmeterturnier gewann die A-Jugend.',
        priority: 'info',
        authorPersonId: official.youthDirector.id,
      }),
    ];
    await tx.insert(s.announcements).values(announcementRows);

    // ── Umfragen ──────────────────────────────────────────────────────────────────────────
    const adults = persons.filter((p) => Number(p.birthDate!.slice(0, 4)) <= 2008);
    const pollRows: Insert<typeof s.polls>[] = [];
    const optionRows: (Insert<typeof s.pollOptions> & { id: string })[] = [];
    const voteRows: Insert<typeof s.pollVotes>[] = [];

    function addPoll(
      poll: Omit<Insert<typeof s.polls>, 'clubId' | 'id'>,
      options: [string, number][],
      voters: PersonRow[],
      fixedVotes: [PersonRow, number][] = [],
    ) {
      const pollId = randomUUID();
      pollRows.push({ id: pollId, clubId, ...poll });
      const ids = options.map(([label], i) => {
        const id = randomUUID();
        optionRows.push({ id, pollId, label, sortOrder: i });
        return id;
      });
      const voted = new Set<string>();
      for (const [person, optionIndex] of fixedVotes) {
        voteRows.push({ pollId, optionId: ids[optionIndex]!, personId: person.id });
        voted.add(person.id);
      }
      for (const voter of voters) {
        if (voted.has(voter.id)) continue;
        const index = weighted(options.map(([, weight], i) => [i, weight] as [number, number]));
        voteRows.push({ pollId, optionId: ids[index]!, personId: voter.id });
        voted.add(voter.id);
      }
      return pollId;
    }

    const djPollId = addPoll(
      {
        scopeType: 'club',
        question: 'Soll das Jugend-Hallenturnier wieder mit DJ stattfinden?',
        closesAt: at(addDays(today, 10), '20:00'),
        resultVisibility: 'after_vote',
        createdByPersonId: official.youthDirector.id,
      },
      [
        ['Ja, auf jeden Fall!', 52],
        ['Eher ja', 28],
        ['Eher nein', 12],
        ['Nein, lieber ohne DJ', 8],
      ],
      faker.helpers.arrayElements(adults, 80),
      [[persona.coach, 1]],
    );
    const teamEveningPollId = addPoll(
      {
        scopeType: 'team',
        scopeId: teamIds.h1,
        question: 'Mannschaftsabend: Welcher Termin passt euch?',
        closesAt: at(addDays(today, 5), '22:00'),
        resultVisibility: 'always',
        createdByPersonId: official.headCoach.id,
      },
      [
        ['Freitag in drei Wochen', 5],
        ['Samstag nach dem Heimspiel', 7],
        ['Freitag in vier Wochen', 2],
      ],
      teamMembers.h1.slice(0, 14).map((m) => m.person),
    );
    const jerseyPollId = addPoll(
      {
        scopeType: 'team',
        scopeId: teamIds.b1,
        question: 'Neues Trikot-Design: Welche Variante gefällt euch?',
        closesAt: at(addDays(today, 1), '18:00'),
        resultVisibility: 'after_close',
        createdByPersonId: persona.coach.id,
      },
      [
        ['Variante A – klassisch grün-weiß gestreift', 6],
        ['Variante B – grün mit weißem Brustring', 5],
        ['Ist mir egal', 1],
      ],
      teamMembers.b1
        .filter((m) => m.person !== persona.player)
        .slice(0, 11)
        .map((m) => m.person),
    );
    await tx.insert(s.polls).values(pollRows);
    await tx.insert(s.pollOptions).values(optionRows);
    await insertChunked(tx, s.pollVotes, voteRows);

    // ── Helferschichten ───────────────────────────────────────────────────────────────────
    const shiftRows: Insert<typeof s.helperShifts>[] = [];
    const signupRows: Insert<typeof s.helperSignups>[] = [];
    const helperPool = faker.helpers.shuffle(adults);
    let helperCursor = 0;

    function addShift(
      event: EventRow,
      title: string,
      start: string,
      end: string,
      capacity: number,
      filled: number,
    ) {
      const id = randomUUID();
      const day = calendarDayOf(event.startsAt);
      shiftRows.push({
        id,
        clubId,
        eventId: event.id,
        title,
        startsAt: at(day, start),
        endsAt: at(day, end),
        capacity,
      });
      for (let i = 0; i < filled; i++) {
        signupRows.push({
          shiftId: id,
          personId: helperPool[helperCursor++ % helperPool.length]!.id,
        });
      }
    }
    addShift(hallTournament, 'Auf- & Abbau', '07:30', '09:30', 8, 5);
    addShift(hallTournament, 'Grillstand', '11:00', '15:00', 6, 4);
    addShift(hallTournament, 'Getränke', '09:00', '13:00', 5, 3);
    addShift(hallTournament, 'Kasse', '09:00', '13:00', 4, 2);
    addShift(hallTournament, 'Kuchenbuffet', '13:00', '17:00', 4, 1);
    addShift(workAssignment, 'Laub & Tornetze', '09:00', '13:00', 10, 6);
    addShift(workAssignment, 'Vereinsheim streichen', '09:00', '13:00', 6, 2);
    addShift(agm, 'Bewirtung', '18:30', '22:00', 3, 1);
    await tx.insert(s.helperShifts).values(shiftRows);
    await insertChunked(tx, s.helperSignups, signupRows);

    // ── Mannschaftskassen ─────────────────────────────────────────────────────────────────
    const accountIds: Partial<Record<TeamKey, string>> = {};
    const accounts = (['h1', 'h2', 'b1'] as TeamKey[]).map((k) => {
      accountIds[k] = randomUUID();
      return {
        id: accountIds[k],
        clubId,
        teamId: teamIds[k],
        name: `Mannschaftskasse ${TEAMS.find((t) => t.key === k)!.name}`,
      };
    });
    await tx.insert(s.cashAccounts).values(accounts);

    const txRows: Insert<typeof s.cashTransactions>[] = [];
    const booking = (
      team: TeamKey,
      direction: 'income' | 'expense',
      amount: number,
      category: string,
      description: string,
      daysAgo: number,
      extra: Partial<Insert<typeof s.cashTransactions>> = {},
    ) =>
      txRows.push({
        clubId,
        accountId: accountIds[team]!,
        direction,
        amountCents: euro(amount),
        category,
        description,
        bookedOn: toIsoDate(addDays(today, -daysAgo)),
        createdByPersonId: persona.treasurer.id,
        ...extra,
      });

    const seasonDaysAgo = Math.round((today.getTime() - seasonStart.getTime()) / 86_400_000);
    booking('h1', 'income', 845, 'uebertrag', 'Übertrag aus der Vorsaison', seasonDaysAgo);
    booking('h1', 'income', 500, 'sponsoring', 'Zuschuss Trainingsanzüge', 40, {
      counterparty: 'Haus & Garten Müller GmbH',
    });
    booking('h1', 'expense', 189.9, 'material', 'Trainingsbälle (10 Stück)', 33, {
      counterparty: 'Sportshop Musterstadt',
    });
    booking('h1', 'expense', 64.8, 'getraenke', 'Getränkekisten Kabine', 12);
    booking('h1', 'expense', 150, 'veranstaltung', 'Anzahlung Mannschaftsabend', 4, {
      counterparty: 'Gasthaus Zur Linde',
    });

    const fines: [string, number][] = [
      ['Zu spät zum Training', 5],
      ['Gelbe Karte wegen Meckerns', 10],
      ['Trikot vergessen', 5],
      ['Handy in der Kabine', 3],
    ];
    for (const m of teamMembers.h1.filter((x) => x.fn === 'player')) {
      let owed = 0;
      for (let i = 0; i < faker.number.int({ min: 0, max: 3 }); i++) {
        const [label, amount] = faker.helpers.arrayElement(fines);
        owed += amount;
        booking('h1', 'income', amount, 'strafe', label, faker.number.int({ min: 2, max: 50 }), {
          personId: m.person.id,
          isCharge: true,
        });
      }
      const drinks = faker.number.int({ min: 0, max: 8 });
      if (drinks > 0) {
        owed += drinks * 1.5;
        booking(
          'h1',
          'income',
          drinks * 1.5,
          'getraenke',
          `${drinks} Getränke nach dem Training`,
          faker.number.int({ min: 1, max: 30 }),
          { personId: m.person.id, isCharge: true },
        );
      }
      if (owed > 0 && faker.datatype.boolean({ probability: 0.7 })) {
        booking(
          'h1',
          'income',
          owed,
          'einzahlung',
          'Einzahlung Mannschaftskasse',
          faker.number.int({ min: 0, max: 10 }),
          { personId: m.person.id },
        );
      }
    }

    booking('h2', 'income', 210.5, 'uebertrag', 'Übertrag aus der Vorsaison', seasonDaysAgo);
    booking('h2', 'expense', 45, 'material', 'Hütchen und Leibchen', 20);
    for (const m of teamMembers.h2.filter((x) => x.fn === 'player').slice(0, 12)) {
      const amount = faker.number.int({ min: 2, max: 6 }) * 1.5;
      booking(
        'h2',
        'income',
        amount,
        'getraenke',
        'Getränke Kabine',
        faker.number.int({ min: 1, max: 25 }),
        { personId: m.person.id, isCharge: true },
      );
      if (faker.datatype.boolean({ probability: 0.6 })) {
        booking(
          'h2',
          'income',
          amount,
          'einzahlung',
          'Einzahlung Mannschaftskasse',
          faker.number.int({ min: 0, max: 8 }),
          { personId: m.person.id },
        );
      }
    }

    booking('b1', 'income', 300, 'uebertrag', 'Übertrag aus der Vorsaison', seasonDaysAgo);
    booking('b1', 'income', 250, 'sponsoring', 'Zuschuss Trikots', 28, {
      counterparty: 'Haus & Garten Müller GmbH',
    });
    booking('b1', 'income', 112.35, 'einnahmen_spieltag', 'Kuchenverkauf Heimspiel', 9);
    booking('b1', 'expense', 150, 'material', 'Trainingsmaterial', 15, {
      counterparty: 'Sportshop Musterstadt',
    });
    await insertChunked(tx, s.cashTransactions, txRows);

    // ── Dokumente ─────────────────────────────────────────────────────────────────────────
    await tx.insert(s.documents).values(
      DOCUMENTS.map((d, i) => ({
        clubId,
        scopeType: d.team ? ('team' as const) : ('club' as const),
        scopeId: d.team ? teamIds[d.team] : null,
        category: d.category,
        title: d.title,
        fileName: d.fileName,
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
        storageKey: `demo/${DEMO_CLUB.slug}/documents/${d.fileName}`,
        uploadedByPersonId: d.team ? persona.coach.id : persona.board.id,
        createdAt: addMinutes(now, -(i + 1) * 3 * 24 * 60),
      })),
    );

    // ── Benachrichtigungen der Demo-Personas ──────────────────────────────────────────────
    const [urgentNews, b1News, lightNews, , , tournamentNews, , , pendingNews] = announcementRows;
    const notification = (
      recipient: PersonaKey,
      level: 'urgent' | 'important' | 'action' | 'info',
      category: string,
      title: string,
      body: string,
      link: string,
      hours: number,
      read = false,
    ): Insert<typeof s.notifications> => ({
      clubId,
      userId: userIds[recipient],
      level,
      category,
      title,
      body,
      link,
      createdAt: hoursAgo(hours),
      readAt: read ? hoursAgo(hours - 0.5) : null,
    });

    const b1Responses = nextB1Training
      ? participants.filter((p) => p.eventId === nextB1Training.id && p.role === 'player')
      : [];
    const b1Yes = b1Responses.filter((p) => p.status === 'yes').length;

    const notificationRows: Insert<typeof s.notifications>[] = [
      notification(
        'coach',
        'urgent',
        'verein',
        urgentNews!.title,
        urgentNews!.teaser!,
        `/news/${urgentNews!.id}`,
        2,
      ),
      notification(
        'coach',
        'action',
        'team',
        'Kader für Samstag festlegen',
        'Wähle die Spieler für das Spiel der B-Jugend aus.',
        `/events/${nextB1Match?.id}`,
        3,
      ),
      notification(
        'coach',
        'info',
        'team',
        'Rückmeldungen B-Jugend',
        `${b1Yes} von ${b1Responses.length} Spielern haben für das nächste Training zugesagt.`,
        `/events/${nextB1Training?.id}`,
        5,
      ),
      notification(
        'coach',
        'action',
        'verein',
        'Umfrage beantworten',
        'Soll das Jugend-Hallenturnier wieder mit DJ stattfinden?',
        `/polls/${djPollId}`,
        50,
        true,
      ),
      notification(
        'coach',
        'info',
        'verein',
        'Neue Vereinsnews',
        lightNews!.title,
        `/news/${lightNews!.id}`,
        26,
        true,
      ),

      notification(
        'player',
        'urgent',
        'team',
        b1News!.title,
        b1News!.teaser!,
        `/news/${b1News!.id}`,
        4,
      ),
      notification(
        'player',
        'action',
        'termine',
        'Zusage offen: Training',
        'Bitte gib Bescheid, ob du beim nächsten Training dabei bist.',
        `/events/${nextB1Training?.id}`,
        6,
      ),
      notification(
        'player',
        'action',
        'team',
        'Umfrage endet morgen',
        'Neues Trikot-Design: Welche Variante gefällt euch?',
        `/polls/${jerseyPollId}`,
        20,
      ),
      notification(
        'player',
        'important',
        'team',
        'Du bist im Kader',
        'Du stehst im Kader für das Spiel am Samstag.',
        `/events/${nextB1Match?.id}`,
        8,
        true,
      ),

      notification(
        'parent',
        'action',
        'termine',
        'Zusage offen für Leon',
        'E-Jugend: Bitte gib Bescheid, ob Leon am Samstag dabei ist.',
        `/events/${nextE1Match?.id}`,
        10,
      ),
      notification(
        'parent',
        'action',
        'termine',
        'Zusage offen für Mia',
        'F-Jugend: Bitte gib Bescheid, ob Mia beim Spielfest dabei ist.',
        `/events/${nextFjTournament?.id}`,
        12,
      ),
      notification(
        'parent',
        'info',
        'verein',
        tournamentNews!.title,
        tournamentNews!.teaser!,
        `/news/${tournamentNews!.id}`,
        72,
        true,
      ),

      notification(
        'board',
        'action',
        'verwaltung',
        'News freigeben',
        `„${pendingNews!.title}“ wartet auf Freigabe.`,
        `/admin/news/${pendingNews!.id}`,
        7,
      ),
      notification(
        'board',
        'action',
        'verwaltung',
        'Helfer prüfen',
        'Jugend-Hallenturnier: 15 von 27 Helferplätzen sind besetzt.',
        `/events/${hallTournament.id}`,
        30,
      ),
      notification(
        'board',
        'info',
        'verein',
        'Termin: Jahreshauptversammlung',
        'Die Einladung wurde an alle Mitglieder verschickt.',
        `/events/${agm.id}`,
        30,
        true,
      ),

      notification(
        'admin',
        'action',
        'verwaltung',
        'Neues Modul verfügbar: Trainingsplanung',
        'Einrichten, später oder nicht verwenden – du entscheidest.',
        '/admin/updates',
        48,
      ),
      notification(
        'admin',
        'info',
        'verwaltung',
        'Systemupdate eingespielt',
        'Sicherheits- und Leistungsverbesserungen wurden automatisch installiert.',
        '/admin/updates',
        96,
        true,
      ),

      notification(
        'treasurer',
        'action',
        'verwaltung',
        'Offene Beträge 1. Mannschaft',
        'Mehrere Spieler haben noch offene Strafen oder Getränke.',
        `/teams/${teamIds.h1}/cash`,
        24,
      ),
    ];
    await tx.insert(s.notifications).values(notificationRows);

    // ── Audit-Log ─────────────────────────────────────────────────────────────────────────
    await tx.insert(s.auditLog).values([
      {
        clubId,
        actorUserId: userIds.admin,
        action: 'club.created',
        entityType: 'club',
        entityId: clubId,
        createdAt: at(seasonStart, '10:00'),
      },
      {
        clubId,
        actorUserId: userIds.admin,
        action: 'role.assigned',
        entityType: 'role_assignment',
        data: { role: 'board', person: 'Sandra Hoffmann' },
        createdAt: at(seasonStart, '10:15'),
      },
      {
        clubId,
        actorUserId: userIds.admin,
        action: 'module.enabled',
        entityType: 'module_settings',
        data: { module: 'player_exchange' },
        createdAt: hoursAgo(24 * 20),
      },
      {
        clubId,
        actorUserId: userIds.board,
        action: 'announcement.published',
        entityType: 'announcement',
        entityId: lightNews!.id,
        createdAt: hoursAgo(26),
      },
      {
        clubId,
        actorUserId: userIds.coach,
        action: 'event.cancelled',
        entityType: 'event',
        data: { reason: 'Kunstrasen gesperrt' },
        createdAt: hoursAgo(4),
      },
    ]);

    void teamEveningPollId;

    return {
      persons: persons.length,
      teams: TEAMS.length,
      memberships: memberships.length,
      events: events.length,
      participants: participants.length,
      absences: absences.length,
      announcements: announcementRows.length,
      polls: pollRows.length,
      pollVotes: voteRows.length,
      helperShifts: shiftRows.length,
      cashTransactions: txRows.length,
      documents: DOCUMENTS.length,
      notifications: notificationRows.length,
    };
  });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const { db, sql } = createDb();
  try {
    const summary = await seed(db);
    console.log('Demoverein „SV Grün-Weiß“ angelegt:');
    console.table(summary);
  } finally {
    await sql.end();
  }
}
