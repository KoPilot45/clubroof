/**
 * Eigener Zugang für Kinder (Paket KIND-EIGENER-ZUGANG).
 *
 * Drei Stufen des Elternzugangs je Kind: Mitsicht und Mitentscheiden (`manage`), nur Mitsicht
 * (`view`), eigenständig (`none`: Eltern sehen und tun nichts mehr).
 */
export const GUARDIAN_ACCESS = ['manage', 'view', 'none'] as const;
export type GuardianAccess = (typeof GUARDIAN_ACCESS)[number];

export const isGuardianAccess = (v: unknown): v is GuardianAccess =>
  (GUARDIAN_ACCESS as readonly unknown[]).includes(v);

const RANK: Record<GuardianAccess, number> = { none: 0, view: 1, manage: 2 };

/** Die Stufe gibt den Eltern mehr Einblick (nur mit Zustimmung des Kindes). */
export const isGuardianRaise = (from: GuardianAccess, to: GuardianAccess): boolean =>
  RANK[to] > RANK[from];

/** Eltern sehen das Kind (Stufe 1 oder 2). */
export const guardianSees = (a: GuardianAccess): boolean => a !== 'none';
/** Eltern entscheiden mit (Stufe 1). */
export const guardianActs = (a: GuardianAccess): boolean => a === 'manage';

/**
 * Was geschieht, wenn jemand die Stufe ändern will?
 *  - `apply`: sofort übernehmen
 *  - `consent`: Anfrage speichern, das Kind muss zustimmen
 * Eltern senken jederzeit; erhöhen sie, braucht ein Kind mit eigenem Konto seine Zustimmung.
 * Das Kind entscheidet über seine Daten selbst und setzt jede Stufe sofort.
 */
export function guardianAccessChange(
  from: GuardianAccess,
  to: GuardianAccess,
  by: 'guardian' | 'child',
  childHasAccount: boolean,
): 'noop' | 'apply' | 'consent' {
  if (from === to) return 'noop';
  if (!isGuardianRaise(from, to)) return 'apply';
  if (by === 'child') return 'apply';
  return childHasAccount ? 'consent' : 'apply';
}

/** Zugang des Kindes aus Sicht der Eltern */
export type ChildAccountStatus = 'none' | 'invited' | 'active';

export type ChildAccessInfo = {
  childId: string;
  name: string;
  account: ChildAccountStatus;
  access: GuardianAccess;
  /** Von den Eltern gewünschte höhere Stufe, wartet auf die Zustimmung des Kindes */
  requestedAccess: GuardianAccess | null;
  /** Stufe, die nach Annahme der offenen Einladung gilt */
  invitedAccess: GuardianAccess | null;
  invitedEmail: string | null;
  changedAt: string | null;
};

export type MyGuardianAccess = {
  guardians: {
    guardianPersonId: string;
    name: string;
    access: GuardianAccess;
    requestedAccess: GuardianAccess | null;
    changedAt: string | null;
  }[];
};
