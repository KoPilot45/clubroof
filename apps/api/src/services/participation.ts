/**
 * Abgeleitete Teilnahme (Befund F05): ob eine Person bei einem Termin „wegen Abwesenheit“ abgesagt ist, folgt immer
 * aus **allen** gültigen Abwesenheiten der Person (Datum in der Vereinszeitzone, Mannschaft) – nie aus einer einzelnen
 * Verknüpfung. Dieser Dienst rechnet es neu: nach dem Anlegen, Ändern und Löschen einer Abwesenheit und nach dem
 * Verschieben eines Termins.
 *
 * Regeln:
 *  - Eine manuell abgegebene Antwort (gesetzt von der Person, den Eltern oder dem Trainerteam: `respondedAt` gesetzt,
 *    keine Verknüpfung zu einer Abwesenheit) hat Vorrang und bleibt unverändert.
 *  - Offene Antworten (Standardwert der Mannschaft) werden bei passender Abwesenheit zur Absage mit Grund und Verknüpfung.
 *  - Automatisch erzeugte Absagen (mit Verknüpfung) folgen der aktuell passenden Abwesenheit; passt keine mehr, geht die
 *    Teilnahme auf den Standardwert zurück (bei automatischer Zusage „zugesagt“, sonst „offen“).
 */
import { schema as s, type Db } from '@clubroof/db';
import { and, eq, gt, inArray, ne } from 'drizzle-orm';
import { absenceReason } from './absences';

type Scope = { personId: string } | { eventId: string };

/** Neu entstandene Absage (aus einer Abwesenheit) – Grundlage für den Hinweis an das Trainerteam bei Aufstellungen. */
export type NewAbsence = { eventId: string; personId: string; reason: string };

export async function recalcAbsenceParticipation(
  tx: Db,
  opts: {
    clubId: string;
    timezone: string;
    now: Date;
    actorPersonId: string;
    /** Abwesenheit, die gerade gelöscht wird: zählt nicht mehr (ihre Verknüpfungen werden aufgelöst, bevor die Zeile verschwindet) */
    ignoreAbsenceId?: string;
  } & Scope,
): Promise<NewAbsence[]> {
  const rows = await tx
    .select({
      id: s.eventParticipants.id,
      eventId: s.eventParticipants.eventId,
      personId: s.eventParticipants.personId,
      status: s.eventParticipants.status,
      absenceId: s.eventParticipants.absenceId,
      reason: s.eventParticipants.reason,
      respondedAt: s.eventParticipants.respondedAt,
      startsAt: s.events.startsAt,
      teamId: s.events.teamId,
      mode: s.teams.participationMode,
    })
    .from(s.eventParticipants)
    .innerJoin(s.events, eq(s.events.id, s.eventParticipants.eventId))
    .innerJoin(s.teams, eq(s.teams.id, s.events.teamId))
    .where(
      and(
        eq(s.eventParticipants.clubId, opts.clubId),
        ne(s.eventParticipants.role, 'coach'),
        eq(s.events.status, 'scheduled'),
        gt(s.events.startsAt, opts.now),
        'personId' in opts
          ? eq(s.eventParticipants.personId, opts.personId)
          : eq(s.eventParticipants.eventId, opts.eventId),
      ),
    );
  if (rows.length === 0) return [];

  const personIds = [...new Set(rows.map((r) => r.personId))];
  const absences = await tx
    .select()
    .from(s.absences)
    .where(and(eq(s.absences.clubId, opts.clubId), inArray(s.absences.personId, personIds)))
    .then((list) => list.filter((a) => a.id !== opts.ignoreAbsenceId));
  const dayOf = (d: Date) => d.toLocaleDateString('sv', { timeZone: opts.timezone });

  const toAbsent = new Map<string, { absenceId: string; reason: string }>();
  const fresh: NewAbsence[] = [];
  const toDefault: { id: string; status: 'yes' | 'pending' }[] = [];
  for (const r of rows) {
    const manual = r.respondedAt !== null && r.absenceId === null;
    if (manual) continue;
    const day = dayOf(r.startsAt);
    const match = absences
      .filter(
        (a) =>
          a.personId === r.personId &&
          a.startsOn <= day &&
          a.endsOn >= day &&
          (!a.teamIds?.length || (r.teamId !== null && a.teamIds.includes(r.teamId))),
      )
      // bei mehreren: die zuerst angelegte, damit das Ergebnis stabil bleibt
      .sort((x, y) => x.createdAt.getTime() - y.createdAt.getTime() || x.id.localeCompare(y.id))[0];
    if (match) {
      const reason = absenceReason(match.kind);
      if (r.status !== 'no' || r.absenceId !== match.id || r.reason !== reason)
        toAbsent.set(r.id, { absenceId: match.id, reason });
      if (r.status !== 'no') fresh.push({ eventId: r.eventId, personId: r.personId, reason });
    } else if (r.absenceId !== null) {
      toDefault.push({ id: r.id, status: r.mode === 'active_response' ? 'pending' : 'yes' });
    }
  }

  for (const [id, v] of toAbsent) {
    await tx
      .update(s.eventParticipants)
      .set({
        status: 'no',
        reason: v.reason,
        absenceId: v.absenceId,
        respondedAt: opts.now,
        respondedByPersonId: opts.actorPersonId,
      })
      .where(eq(s.eventParticipants.id, id));
  }
  const reset = { reason: null, absenceId: null, respondedAt: null, respondedByPersonId: null };
  for (const status of ['yes', 'pending'] as const) {
    const ids = toDefault.filter((d) => d.status === status).map((d) => d.id);
    if (ids.length)
      await tx
        .update(s.eventParticipants)
        .set({ ...reset, status })
        .where(inArray(s.eventParticipants.id, ids));
  }
  return fresh;
}
