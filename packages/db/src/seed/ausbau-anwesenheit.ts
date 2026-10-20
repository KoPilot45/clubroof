/**
 * Demodaten-Ausbau der Trainingsbeteiligung (Paket DEMODATEN-TRAININGSBETEILIGUNG): Anwesenheit vergangener
 * Trainings für alle Mannschaften. Je Person ein fester Anwesenheitstyp (nicht mehr nach Kaderreihenfolge),
 * je Mannschaft eine eigene Quote; die Anwesenheit wird gleichmäßig verteilt (Fehlzeiten kommen nicht nur
 * als Zufallsreihe), damit die Farbstufen im Aufstellungsplaner reproduzierbar bleiben.
 */
import { fakerDE as faker } from '@faker-js/faker';

const DAY_MS = 86_400_000;

/** Grundquote der „normalen“ Spielerinnen und Spieler je Mannschaft in Prozent; das Mannschaftsmittel liegt
 * wegen der Fehlzeiten-Typen darunter (Ziel: Bambini bis F ca. 80–90, D–A 70–85, Frauen 70, 1. 75, 2. 60, AH 55). */
export const TEAM_RATE: Record<string, number> = {
  h1: 77,
  h2: 58,
  ah: 49,
  f1: 71,
  a1: 81,
  b1: 76,
  c1: 79,
  d1: 80,
  e1: 96,
  fj: 91,
  bam: 89,
};

export type AttendanceType = 'low' | 'mid' | 'dip' | 'high' | 'normal';

export type PlanTraining = { id: string; teamKey: string; startsAt: Date; cancelled: boolean };

export type AttendancePlan = {
  /** Trainings, deren Anwesenheit erfasst ist (nicht abgesagt, vergangen, nicht bewusst offen gelassen). */
  recorded: Set<string>;
  /** Anwesenheit je Training und Person (nur für erfasste Trainings und Spielerinnen/Spieler). */
  present: (eventId: string, personId: string) => boolean;
  typeOf: (personId: string) => AttendanceType | undefined;
};

/** Verteilt `k` Anwesenheiten gleichmäßig auf `n` Termine (Bresenham mit Startphase). */
function spread(n: number, k: number, phase: number): boolean[] {
  const p = n ? k / n : 0;
  return Array.from(
    { length: n },
    (_, i) => Math.floor((i + 1) * p + phase) - Math.floor(i * p + phase) > 0,
  );
}

export function planTrainingAttendance(input: {
  now: Date;
  trainings: PlanTraining[];
  /** Spielerinnen und Spieler je Mannschaft (Personen-IDs, ohne Trainer). */
  players: Record<string, string[]>;
  /** Wie viele Trainings die Mannschaft je Woche hat. */
  perWeek: Record<string, number>;
  /** Feste Typen für Demo-Logins (nie niedrig, mittel oder Einbruch). */
  fixedTypes: Map<string, AttendanceType>;
  /** Hat die Person an diesem Tag eine Abwesenheit? */
  absent: (personId: string, eventId: string) => boolean;
}): AttendancePlan {
  const { now, trainings, players, perWeek, fixedTypes, absent } = input;
  const windowStart = now.getTime() - 28 * DAY_MS;
  const dipStart = now.getTime() - 21 * DAY_MS;

  const recorded = new Set<string>();
  const byTeam = new Map<string, PlanTraining[]>();
  for (const [teamKey, perWeekCount] of Object.entries(perWeek)) {
    const past = trainings
      .filter((t) => t.teamKey === teamKey && !t.cancelled && t.startsAt < now)
      .sort((a, b) => b.startsAt.getTime() - a.startsAt.getTime());
    // Bewusst offen: bei zwei Trainings je Woche das jüngste (zeigt die Kachel „Anwesenheit erfassen“) und ein
    // älteres vergessenes; bei einem Training je Woche eines von vor etwa fünf Wochen (die letzten vier Wochen
    // bleiben vollständig erfasst).
    const open = perWeekCount >= 2 ? new Set([0, teamKey.length % 2 ? 9 : 8]) : new Set([4]);
    past.forEach((t, i) => {
      if (!open.has(i)) recorded.add(t.id);
    });
    byTeam.set(teamKey, past.filter((t) => recorded.has(t.id)).reverse());
  }

  const types = new Map<string, AttendanceType>();
  const presence = new Set<string>();

  for (const [teamKey, ids] of Object.entries(players)) {
    const rate = (TEAM_RATE[teamKey] ?? 75) / 100;
    const sessions = byTeam.get(teamKey) ?? [];
    const free = faker.helpers.shuffle(ids.filter((id) => !fixedTypes.has(id)));
    const ordered = [...free, ...ids.filter((id) => fixedTypes.has(id))];
    ordered.forEach((personId, index) => {
      // Ab 12 Spielern kommen alle drei Farbstufen vor, dazu ein Einbruch nach Verletzung
      let type: AttendanceType;
      if (fixedTypes.has(personId)) type = fixedTypes.get(personId)!;
      else if (index === 0) type = 'low';
      else if (index === 1 && ids.length >= 12) type = 'mid';
      else if (index === 2 && ids.length >= 12) type = 'dip';
      else type = index % 3 === 0 ? 'high' : 'normal';
      types.set(personId, type);

      const eligible = sessions.filter((t) => !absent(personId, t.id));
      const inWindow = eligible.filter((t) => t.startsAt.getTime() >= windowStart);
      const older = eligible.filter((t) => t.startsAt.getTime() < windowStart);
      const phase = faker.number.float({ min: 0, max: 0.999 });
      const flags = new Map<string, boolean>();
      const mark = (list: PlanTraining[], marks: boolean[]) =>
        list.forEach((t, i) => flags.set(t.id, marks[i]!));

      if (type === 'low') {
        mark(older, spread(older.length, Math.round(older.length * 0.3), phase));
        mark(inWindow, spread(inWindow.length, Math.floor(inWindow.length * 0.35), phase));
      } else if (type === 'mid') {
        mark(older, spread(older.length, Math.round(older.length * 0.6), phase));
        mark(inWindow, spread(inWindow.length, Math.round(inWindow.length * 0.6), phase));
      } else if (type === 'dip') {
        // zuletzt verletzt: bis vor drei Wochen regelmäßig, danach nicht mehr
        const before = eligible.filter((t) => t.startsAt.getTime() < dipStart);
        const after = eligible.filter((t) => t.startsAt.getTime() >= dipStart);
        mark(before, spread(before.length, Math.round(before.length * 0.9), phase));
        mark(
          after,
          after.map(() => false),
        );
      } else {
        const p = type === 'high' ? Math.min(0.96, Math.max(rate + 0.16, 0.82)) : rate;
        mark(eligible, spread(eligible.length, Math.round(eligible.length * p), phase));
      }
      for (const [eventId, yes] of flags) if (yes) presence.add(`${eventId}:${personId}`);
    });
  }

  return {
    recorded,
    present: (eventId, personId) => presence.has(`${eventId}:${personId}`),
    typeOf: (personId) => types.get(personId),
  };
}
