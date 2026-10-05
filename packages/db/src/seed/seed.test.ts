/**
 * Integrationstests gegen eine echte PostgreSQL-Datenbank. Werden übersprungen, wenn
 * `DATABASE_URL` nicht gesetzt ist. Die Tests verändern nur den Demoverein.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../client';
import { runMigrations } from '../migrate';
import { seed, type SeedSummary } from './index';

const url = process.env.DATABASE_URL;

describe.skipIf(!url)('Demodaten', () => {
  const { db, sql } = createDb(url);
  let summary: SeedSummary;

  beforeAll(async () => {
    await runMigrations(url);
    summary = await seed(db);
  }, 60_000);

  afterAll(async () => {
    await sql.end();
  });

  it('legt genau einen Demoverein an und ist wiederholbar', async () => {
    const again = await seed(db);
    expect(again).toEqual(summary);
    const [row] = await sql`select count(*)::int as n from clubs where slug = 'sv-gruen-weiss'`;
    expect(row!.n).toBe(1);
  }, 60_000);

  it('vergibt Rückennummern je Mannschaft nur einmal', async () => {
    const dup = await sql`
      select team_id, jersey_number from team_memberships
      where function = 'player' and jersey_number is not null and valid_to is null
      group by 1, 2 having count(*) > 1`;
    expect(dup).toHaveLength(0);
  });

  it('Spielberichte passen zum Ergebnis, Torschützen stehen im Kader', async () => {
    const mismatch = await sql`
      select d.event_id from match_details d
      where d.report_completed_at is not null and d.goals_for <> (
        select count(*) from match_incidents i
        where i.event_id = d.event_id and i.kind in ('goal', 'penalty_goal', 'own_goal'))`;
    expect(mismatch).toHaveLength(0);
    const outside = await sql`
      select i.id from match_incidents i
      where i.person_id is not null and not exists (
        select 1 from match_lineups l where l.event_id = i.event_id and l.person_id = i.person_id)`;
    expect(outside).toHaveLength(0);
  });

  it('verwendet in allen Tabellen dieselbe club_id', async () => {
    const tables = await sql<{ table_name: string }[]>`
      select table_name from information_schema.columns
      where table_schema = 'public' and column_name = 'club_id'`;
    expect(tables.length).toBeGreaterThan(15);
    for (const { table_name } of tables) {
      const rows = await sql`
        select count(distinct club_id)::int as n from ${sql(table_name)}`;
      expect(rows[0]!.n, table_name).toBeLessThanOrEqual(1);
    }
  });

  it('jede Mannschaft hat Spieler und mindestens eine verantwortliche Person', async () => {
    const rows = await sql`
      select t.badge,
             count(*) filter (where tm.function = 'player')::int as players,
             count(*) filter (where tm.function in ('coach', 'assistant_coach'))::int as coaches
      from teams t join team_memberships tm on tm.team_id = t.id
      group by t.badge`;
    expect(rows).toHaveLength(11);
    for (const r of rows) {
      expect(r.players, r.badge).toBeGreaterThanOrEqual(10);
      expect(r.coaches, r.badge).toBeGreaterThanOrEqual(1);
    }
  });

  it('Teilnehmer gehören zur Mannschaft oder sind als Gastspieler gekennzeichnet', async () => {
    const [row] = await sql`
      select count(*)::int as n
      from event_participants ep
      join events e on e.id = ep.event_id
      where e.team_id is not null
        and not exists (
          select 1 from team_memberships tm
          where tm.team_id = e.team_id and tm.person_id = ep.person_id)
        and (ep.role <> 'guest_player' or ep.guest_from_team_id is null)`;
    expect(row!.n).toBe(0);

    const [guests] = await sql`
      select count(*)::int as n from event_participants where role = 'guest_player'`;
    expect(guests!.n).toBeGreaterThanOrEqual(1);
  });

  it('Kinder bis einschließlich C-Jugend haben einen Elternzugang', async () => {
    const [row] = await sql`
      select count(*)::int as n
      from team_memberships tm
      join persons p on p.id = tm.person_id
      join teams t on t.id = tm.team_id
      where tm.function = 'player'
        and t.badge in ('C1', 'D1', 'E1', 'F1', 'BAM')
        and not exists (select 1 from guardianships g where g.child_person_id = p.id)`;
    expect(row!.n).toBe(0);
  });

  it('Plätze sind nie doppelt belegt', async () => {
    const conflicts = await sql`
      select a.title, b.title, a.starts_at
      from events a
      join events b on a.facility_id = b.facility_id and a.id < b.id
      where a.status = 'scheduled' and b.status = 'scheduled'
        and tstzrange(a.starts_at, a.ends_at) && tstzrange(b.starts_at, b.ends_at)`;
    expect(conflicts).toEqual([]);
  });

  it('Abwesende Spieler sind für Termine im Abwesenheitszeitraum abgesagt', async () => {
    const [row] = await sql`
      select count(*)::int as n
      from absences a
      join event_participants ep on ep.person_id = a.person_id
      join events e on e.id = ep.event_id
      where (e.starts_at at time zone 'Europe/Berlin')::date between a.starts_on and a.ends_on
        and ep.role = 'player'
        and ep.status <> 'no'`;
    expect(row!.n).toBe(0);
  });

  it('Kassenstand der B-Jugend entspricht dem Mockup (512,35 €)', async () => {
    const [row] = await sql`
      select sum(case when ct.direction = 'income' then ct.amount_cents else -ct.amount_cents end)::int as cents
      from cash_transactions ct
      join cash_accounts a on a.id = ct.account_id
      join teams t on t.id = a.team_id
      where t.badge = 'B1' and not ct.is_charge`;
    expect(row!.cents).toBe(51235);
  });

  it('jede Demo-Persona hat ein Login und Benachrichtigungen', async () => {
    const rows = await sql`
      select u.email, count(n.id)::int as notifications
      from users u
      join persons p on p.user_id = u.id
      left join notifications n on n.user_id = u.id
      where u.email like '%@sv-gruen-weiss.example'
      group by u.email`;
    expect(rows).toHaveLength(6);
    for (const r of rows) expect(r.notifications, r.email).toBeGreaterThan(0);
  });
});
