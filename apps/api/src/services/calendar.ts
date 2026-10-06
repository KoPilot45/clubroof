/**
 * Kalenderexport (Mappe S. 15/17): persönlicher Abo-Link im iCalendar-Format für Google-,
 * Apple- oder Outlook-Kalender. Enthalten sind die eigenen Termine (auch die der Kinder) und
 * die Vereinstermine – ohne Teilnehmerlisten oder Gründe (Datensparsamkeit).
 * Der Link ist geheim und jederzeit erneuerbar; der alte wird dabei ungültig.
 */
import { randomBytes } from 'node:crypto';
import type { CalendarFeed } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { eq } from 'drizzle-orm';
import { loadActor, moduleEnabled, type Actor } from '../actor';
import { hashToken } from '../auth/session';
import { forbidden } from '../errors';
import { decrypt, encrypt } from '../security/crypto';
import type { LinkSigner } from '../storage/files';
import { fetchEventRows } from './events';
import { myEventsCondition } from './home';

const DAY = 24 * 3_600_000;

function requireExport(actor: Actor) {
  if (!moduleEnabled(actor, 'calendar_export'))
    throw forbidden('Der Kalenderexport ist im Verein nicht aktiviert.');
}

const feedUrl = (base: string, token: string) => `${base}/calendar/${token}.ics`;

export async function getCalendarFeed(
  db: Db,
  actor: Actor,
  base: string,
  key: string,
): Promise<CalendarFeed> {
  requireExport(actor);
  const [feed] = await db
    .select()
    .from(s.calendarFeeds)
    .where(eq(s.calendarFeeds.userId, actor.user.id));
  const token = feed ? decrypt(key, feed.tokenEncrypted) : null;
  return {
    url: token ? feedUrl(base, token) : null,
    lastAccessAt: feed?.lastAccessAt?.toISOString() ?? null,
  };
}

/** Legt den Abo-Link an oder erneuert ihn (alter Link wird ungültig). */
export async function renewCalendarFeed(
  db: Db,
  actor: Actor,
  base: string,
  key: string,
  now: Date,
): Promise<CalendarFeed> {
  requireExport(actor);
  const token = randomBytes(24).toString('base64url');
  const values = {
    clubId: actor.club.id,
    tokenHash: hashToken(token),
    tokenEncrypted: encrypt(key, token),
    createdAt: now,
    lastAccessAt: null,
  };
  await db
    .insert(s.calendarFeeds)
    .values({ userId: actor.user.id, ...values })
    .onConflictDoUpdate({ target: s.calendarFeeds.userId, set: values });
  return { url: feedUrl(base, token), lastAccessAt: null };
}

export async function deleteCalendarFeed(db: Db, actor: Actor) {
  await db.delete(s.calendarFeeds).where(eq(s.calendarFeeds.userId, actor.user.id));
}

// ── iCalendar ────────────────────────────────────────────────────────────

/** Text nach RFC 5545 maskieren */
const esc = (v: string) =>
  v.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const stamp = (d: Date) =>
  d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');

/** Zeilen über 75 Byte falten (RFC 5545, 3.1) */
function fold(line: string): string {
  const out: string[] = [];
  let rest = line;
  while (Buffer.byteLength(rest) > 75) {
    let cut = 75;
    while (Buffer.byteLength(rest.slice(0, cut)) > 75) cut--;
    out.push(rest.slice(0, cut));
    rest = ' ' + rest.slice(cut);
  }
  out.push(rest);
  return out.join('\r\n');
}

const TYPE_LABELS: Record<string, string> = {
  training: 'Training',
  match: 'Spiel',
  tournament: 'Turnier',
  team_event: 'Mannschaftstermin',
  club_event: 'Veranstaltung',
  meeting: 'Versammlung',
  work_assignment: 'Arbeitseinsatz',
};

/** Liefert den ICS-Inhalt zu einem Abo-Token oder `null`, wenn der Link ungültig ist. */
export async function calendarIcs(
  db: Db,
  token: string,
  appUrl: string,
  links: LinkSigner,
  now: Date,
): Promise<string | null> {
  const [feed] = await db
    .select({ feed: s.calendarFeeds, user: s.users })
    .from(s.calendarFeeds)
    .innerJoin(s.users, eq(s.users.id, s.calendarFeeds.userId))
    .where(eq(s.calendarFeeds.tokenHash, hashToken(token)));
  if (!feed) return null;
  let actor: Actor;
  try {
    actor = await loadActor(
      db,
      {
        sessionId: '',
        id: feed.user.id,
        email: feed.user.email,
        displayName: feed.user.displayName,
      },
      now,
      links,
    );
  } catch {
    return null; // z. B. ausgetreten
  }
  if (!moduleEnabled(actor, 'calendar_export')) return null;
  await db
    .update(s.calendarFeeds)
    .set({ lastAccessAt: now })
    .where(eq(s.calendarFeeds.userId, feed.user.id));

  const rows = await fetchEventRows(
    db,
    myEventsCondition(
      actor,
      new Date(now.getTime() - 30 * DAY),
      new Date(now.getTime() + 180 * DAY),
    ),
    1000,
  );
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Clubroof//Vereinskalender//DE',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${esc(actor.club.shortName)}`,
    `X-WR-TIMEZONE:${actor.club.timezone}`,
    'REFRESH-INTERVAL;VALUE=DURATION:PT2H',
    'X-PUBLISHED-TTL:PT2H',
  ];
  for (const { event, team, facilityName, match } of rows) {
    const end = event.endsAt ?? new Date(event.startsAt.getTime() + 90 * 60_000);
    const title =
      event.type === 'match' && match
        ? `${team ? `${team.badge}: ` : ''}${match.isHome ? `${actor.club.shortName} – ${match.opponentName}` : `${match.opponentName} – ${actor.club.shortName}`}`
        : `${team ? `${team.badge} ` : ''}${event.title}`;
    const details = [
      TYPE_LABELS[event.type],
      event.meetingAt
        ? `Treffen ${new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: actor.club.timezone }).format(event.meetingAt)} Uhr${event.meetingPoint ? ` (${event.meetingPoint})` : ''}`
        : null,
      event.status === 'cancelled' ? `Abgesagt: ${event.cancelledReason ?? ''}` : null,
      `${appUrl}/events/${event.id}`,
    ].filter(Boolean);
    lines.push(
      'BEGIN:VEVENT',
      `UID:${event.id}@clubroof`,
      `DTSTAMP:${stamp(event.updatedAt ?? now)}`,
      `DTSTART:${stamp(event.startsAt)}`,
      `DTEND:${stamp(end)}`,
      `SUMMARY:${esc(event.status === 'cancelled' ? `Abgesagt: ${title}` : title)}`,
      ...(facilityName || event.locationText
        ? [`LOCATION:${esc(facilityName ?? event.locationText!)}`]
        : []),
      `DESCRIPTION:${esc(details.join('\n'))}`,
      `URL:${appUrl}/events/${event.id}`,
      `STATUS:${event.status === 'cancelled' ? 'CANCELLED' : 'CONFIRMED'}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.map(fold).join('\r\n') + '\r\n';
}
