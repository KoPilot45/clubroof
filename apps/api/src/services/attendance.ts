import { schema as s } from '@clubroof/db';
import { sql } from 'drizzle-orm';

/**
 * War die Person da? Hat das Trainerteam die Anwesenheit erfasst, zählt sie; sonst die Zusage.
 * Für Abfragen über `event_participants` mit verbundenem `events`.
 */
export const presentSql = sql<boolean>`(case when ${s.events.attendanceRecordedAt} is not null then coalesce(${s.eventParticipants.attended}, false) else ${s.eventParticipants.status} = 'yes' end)`;
