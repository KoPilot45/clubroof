/**
 * Fahrgemeinschaften zu Auswärtsspielen und Turnieren: Eltern bzw. Spieler bieten Plätze an,
 * buchen sich (oder ihr Kind) ein oder melden „Mitfahrt gesucht“.
 */
import type { Carpool } from '@clubroof/core';
import { schema as s, type Db } from '@clubroof/db';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { actorCan, type Actor } from '../actor';
import { HttpError, forbidden, notFound } from '../errors';
import { deliver } from '../notify/deliver';
import { loadVisibleEvent, type EventRow } from './events';

/** Fahrgemeinschaften gibt es bei Auswärtsspielen und Turnieren einer Mannschaft. */
export function carpoolApplies(row: EventRow): boolean {
  if (!row.team || row.event.status !== 'scheduled') return false;
  if (row.event.type === 'tournament') return true;
  return row.event.type === 'match' && row.match?.isHome === false;
}

export async function carpoolFor(
  db: Db,
  actor: Actor,
  row: EventRow,
  now: Date,
): Promise<Carpool | null> {
  if (!carpoolApplies(row)) return null;
  const eventId = row.event.id;
  const [offers, passengers, requests, participants] = await Promise.all([
    db
      .select({
        offer: s.carpoolOffers,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
      })
      .from(s.carpoolOffers)
      .innerJoin(s.persons, eq(s.persons.id, s.carpoolOffers.driverPersonId))
      .where(eq(s.carpoolOffers.eventId, eventId))
      .orderBy(asc(s.carpoolOffers.createdAt)),
    db
      .select({
        offerId: s.carpoolPassengers.offerId,
        personId: s.carpoolPassengers.personId,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
      })
      .from(s.carpoolPassengers)
      .innerJoin(s.persons, eq(s.persons.id, s.carpoolPassengers.personId))
      .where(eq(s.carpoolPassengers.eventId, eventId))
      .orderBy(asc(s.carpoolPassengers.createdAt)),
    db
      .select({
        personId: s.carpoolRequests.personId,
        note: s.carpoolRequests.note,
        firstName: s.persons.firstName,
        lastName: s.persons.lastName,
      })
      .from(s.carpoolRequests)
      .innerJoin(s.persons, eq(s.persons.id, s.carpoolRequests.personId))
      .where(eq(s.carpoolRequests.eventId, eventId))
      .orderBy(asc(s.carpoolRequests.createdAt)),
    db
      .select({ personId: s.eventParticipants.personId })
      .from(s.eventParticipants)
      .where(
        and(
          eq(s.eventParticipants.eventId, eventId),
          inArray(s.eventParticipants.personId, actor.managedIds),
          inArray(s.eventParticipants.role, ['player', 'guest_player']),
        ),
      ),
  ]);
  const manage = actorCan(actor, 'events.manage', row.team!);
  const mine = (personId: string) => actor.managedIds.includes(personId);
  return {
    offers: offers.map(({ offer, firstName, lastName }) => {
      const riding = passengers.filter((p) => p.offerId === offer.id);
      return {
        id: offer.id,
        driverName: `${firstName} ${lastName}`,
        seats: offer.seats,
        free: Math.max(0, offer.seats - riding.length),
        note: offer.note,
        passengers: riding.map((p) => ({
          personId: p.personId,
          name: `${p.firstName} ${p.lastName}`,
          mine: mine(p.personId),
        })),
        mine: offer.driverPersonId === actor.person.id,
        canWithdraw: offer.driverPersonId === actor.person.id || manage,
      };
    }),
    requests: requests.map((r) => ({
      personId: r.personId,
      name: `${r.firstName} ${r.lastName}`,
      note: r.note,
      mine: mine(r.personId),
    })),
    riders: actor.managed
      .filter((m) => participants.some((p) => p.personId === m.id))
      .map((m) => ({ personId: m.id, firstName: m.firstName })),
    open: row.event.startsAt > now,
  };
}

async function loadOpen(db: Db, actor: Actor, eventId: string, now: Date) {
  const row = await loadVisibleEvent(db, actor, eventId);
  if (!carpoolApplies(row)) {
    throw new HttpError(409, 'no_carpool', 'Für diesen Termin gibt es keine Fahrgemeinschaften.');
  }
  if (row.event.startsAt <= now) {
    throw new HttpError(409, 'event_started', 'Der Termin hat schon begonnen.');
  }
  return row;
}

/** Logins einer Person bzw. ihrer Eltern (Kinder haben meist kein eigenes Login). */
async function usersOf(db: Db, personIds: string[]): Promise<string[]> {
  if (personIds.length === 0) return [];
  const [own, guardians] = await Promise.all([
    db.select({ userId: s.persons.userId }).from(s.persons).where(inArray(s.persons.id, personIds)),
    db
      .select({ userId: s.persons.userId })
      .from(s.guardianships)
      .innerJoin(s.persons, eq(s.persons.id, s.guardianships.guardianPersonId))
      .where(inArray(s.guardianships.childPersonId, personIds)),
  ]);
  return [...new Set([...own, ...guardians].map((r) => r.userId).filter((id) => id !== null))];
}

async function isRider(db: Db, eventId: string, personId: string): Promise<boolean> {
  const [p] = await db
    .select({ id: s.eventParticipants.id })
    .from(s.eventParticipants)
    .where(
      and(
        eq(s.eventParticipants.eventId, eventId),
        eq(s.eventParticipants.personId, personId),
        inArray(s.eventParticipants.role, ['player', 'guest_player']),
      ),
    );
  return !!p;
}

export async function offerRide(
  db: Db,
  actor: Actor,
  eventId: string,
  input: { seats: number; note?: string | null },
  now: Date,
): Promise<Carpool> {
  const row = await loadOpen(db, actor, eventId, now);
  await db
    .insert(s.carpoolOffers)
    .values({
      clubId: actor.club.id,
      eventId,
      driverPersonId: actor.person.id,
      seats: input.seats,
      note: input.note?.trim() || null,
    })
    .onConflictDoUpdate({
      target: [s.carpoolOffers.eventId, s.carpoolOffers.driverPersonId],
      set: { seats: input.seats, note: input.note?.trim() || null },
    });

  // Wer eine Mitfahrt sucht, erfährt vom neuen Angebot
  const seeking = (
    await db
      .select({ personId: s.carpoolRequests.personId })
      .from(s.carpoolRequests)
      .where(eq(s.carpoolRequests.eventId, eventId))
  ).map((r) => r.personId);
  const waiting = await usersOf(db, seeking);
  await deliver(
    db,
    actor.club,
    waiting.filter((id) => id !== actor.user.id),
    {
      level: 'info',
      topic: 'events',
      teamId: row.team!.id,
      title: 'Mitfahrt angeboten',
      body: `${actor.person.firstName} fährt zu „${row.event.title}“ und hat ${input.seats} ${input.seats === 1 ? 'Platz' : 'Plätze'} frei.`,
      link: `/events/${eventId}`,
      dedupeKey: `carpool-offer:${eventId}:${actor.person.id}`,
    },
    now,
  );
  return (await carpoolFor(db, actor, row, now))!;
}

export async function withdrawOffer(
  db: Db,
  actor: Actor,
  offerId: string,
  now: Date,
): Promise<Carpool> {
  const [offer] = await db
    .select()
    .from(s.carpoolOffers)
    .where(and(eq(s.carpoolOffers.id, offerId), eq(s.carpoolOffers.clubId, actor.club.id)));
  if (!offer) throw notFound('Die Mitfahrgelegenheit');
  const row = await loadVisibleEvent(db, actor, offer.eventId);
  if (offer.driverPersonId !== actor.person.id && !actorCan(actor, 'events.manage', row.team!)) {
    throw forbidden('Nur der Fahrer kann das Angebot zurückziehen.');
  }
  await db.delete(s.carpoolOffers).where(eq(s.carpoolOffers.id, offerId));
  return (await carpoolFor(db, actor, row, now))!;
}

export async function joinRide(
  db: Db,
  actor: Actor,
  offerId: string,
  personId: string,
  now: Date,
): Promise<Carpool> {
  if (!actor.managedIds.includes(personId)) {
    throw forbidden('Du kannst nur dich oder deine Kinder eintragen.');
  }
  const [offer] = await db
    .select()
    .from(s.carpoolOffers)
    .where(and(eq(s.carpoolOffers.id, offerId), eq(s.carpoolOffers.clubId, actor.club.id)));
  if (!offer) throw notFound('Die Mitfahrgelegenheit');
  const row = await loadOpen(db, actor, offer.eventId, now);
  if (offer.driverPersonId === personId) {
    throw new HttpError(409, 'own_offer', 'Du fährst selbst.');
  }
  if (!(await isRider(db, offer.eventId, personId))) {
    throw new HttpError(409, 'not_participant', 'Nur Teilnehmer des Termins können mitfahren.');
  }
  await db.transaction(async (tx) => {
    // Plätze unter Sperre zählen, damit nicht zwei gleichzeitig den letzten Platz bekommen
    await tx
      .select({ id: s.carpoolOffers.id })
      .from(s.carpoolOffers)
      .where(eq(s.carpoolOffers.id, offerId))
      .for('update');
    const taken = await tx
      .select({ personId: s.carpoolPassengers.personId })
      .from(s.carpoolPassengers)
      .where(eq(s.carpoolPassengers.offerId, offerId))
      .for('update');
    if (taken.length >= offer.seats) {
      throw new HttpError(409, 'full', 'In diesem Auto ist kein Platz mehr frei.');
    }
    // Wechsel in ein anderes Auto: alte Buchung und Suche entfallen
    await tx
      .delete(s.carpoolPassengers)
      .where(
        and(
          eq(s.carpoolPassengers.eventId, offer.eventId),
          eq(s.carpoolPassengers.personId, personId),
        ),
      );
    await tx
      .delete(s.carpoolRequests)
      .where(
        and(eq(s.carpoolRequests.eventId, offer.eventId), eq(s.carpoolRequests.personId, personId)),
      );
    await tx.insert(s.carpoolPassengers).values({
      clubId: actor.club.id,
      offerId,
      eventId: offer.eventId,
      personId,
    });
  });

  const [driver] = await db
    .select({ userId: s.persons.userId })
    .from(s.persons)
    .where(eq(s.persons.id, offer.driverPersonId));
  const rider = actor.managed.find((m) => m.id === personId)!;
  if (driver?.userId && driver.userId !== actor.user.id) {
    await deliver(
      db,
      actor.club,
      [driver.userId],
      {
        level: 'info',
        topic: 'events',
        teamId: row.team!.id,
        title: 'Neuer Mitfahrer',
        body: `${rider.firstName} fährt zu „${row.event.title}“ bei dir mit.`,
        link: `/events/${offer.eventId}`,
      },
      now,
    );
  }
  return (await carpoolFor(db, actor, row, now))!;
}

export async function leaveRide(
  db: Db,
  actor: Actor,
  offerId: string,
  personId: string,
  now: Date,
): Promise<Carpool> {
  const [offer] = await db
    .select()
    .from(s.carpoolOffers)
    .where(and(eq(s.carpoolOffers.id, offerId), eq(s.carpoolOffers.clubId, actor.club.id)));
  if (!offer) throw notFound('Die Mitfahrgelegenheit');
  const row = await loadVisibleEvent(db, actor, offer.eventId);
  if (!actor.managedIds.includes(personId) && offer.driverPersonId !== actor.person.id) {
    throw forbidden('Du kannst nur dich oder deine Kinder austragen.');
  }
  await db
    .delete(s.carpoolPassengers)
    .where(
      and(eq(s.carpoolPassengers.offerId, offerId), eq(s.carpoolPassengers.personId, personId)),
    );
  return (await carpoolFor(db, actor, row, now))!;
}

export async function setRideRequest(
  db: Db,
  actor: Actor,
  eventId: string,
  personId: string,
  input: { looking: boolean; note?: string | null },
  now: Date,
): Promise<Carpool> {
  if (!actor.managedIds.includes(personId)) {
    throw forbidden('Du kannst nur für dich oder deine Kinder suchen.');
  }
  const row = await loadOpen(db, actor, eventId, now);
  if (input.looking) {
    if (!(await isRider(db, eventId, personId))) {
      throw new HttpError(409, 'not_participant', 'Nur Teilnehmer des Termins können mitfahren.');
    }
    await db
      .insert(s.carpoolRequests)
      .values({ clubId: actor.club.id, eventId, personId, note: input.note?.trim() || null })
      .onConflictDoUpdate({
        target: [s.carpoolRequests.eventId, s.carpoolRequests.personId],
        set: { note: input.note?.trim() || null },
      });
  } else {
    await db
      .delete(s.carpoolRequests)
      .where(and(eq(s.carpoolRequests.eventId, eventId), eq(s.carpoolRequests.personId, personId)));
  }
  return (await carpoolFor(db, actor, row, now))!;
}
