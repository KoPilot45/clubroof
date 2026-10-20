/**
 * Integrationstests gegen eine echte PostgreSQL-Datenbank. Werden übersprungen, wenn
 * `DATABASE_URL` nicht gesetzt ist. Sie laufen in einer eigenen, frisch angelegten Datenbank,
 * damit sie parallel zu den API-Tests (die ebenfalls den Demoverein einspielen) laufen können.
 */
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createDb } from '../client';
import { runMigrations } from '../migrate';
import { seed, type SeedSummary } from './index';

const baseUrl = process.env.DATABASE_URL;
const DB_NAME = 'clubroof_seed_test';
const url = baseUrl?.replace(/\/[^/?]+(\?|$)/, `/${DB_NAME}$1`);

describe.skipIf(!baseUrl)('Demodaten', () => {
  const admin = createDb(baseUrl);
  let conn: ReturnType<typeof createDb>;
  let db: ReturnType<typeof createDb>['db'];
  let sql: ReturnType<typeof createDb>['sql'];
  let summary: SeedSummary;

  beforeAll(async () => {
    await admin.sql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.sql.unsafe(`CREATE DATABASE ${DB_NAME}`);
    await runMigrations(url);
    conn = createDb(url);
    ({ db, sql } = conn);
    summary = await seed(db);
  }, 60_000);

  afterAll(async () => {
    await conn?.sql.end();
    await admin.sql.unsafe(`DROP DATABASE IF EXISTS ${DB_NAME} WITH (FORCE)`);
    await admin.sql.end();
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

  it('erfasst die Trainingsanwesenheit für alle Mannschaften plausibel', async () => {
    const teams = await sql<{ id: string; name: string }[]>`select id, name from teams`;
    expect(teams).toHaveLength(11);
    const ranges: Record<string, [number, number]> = {
      Bambini: [75, 95],
      'F-Jugend': [75, 95],
      'E-Jugend': [75, 95],
      'D-Jugend': [68, 88],
      'C-Jugend': [68, 88],
      'B-Jugend': [68, 88],
      'A-Jugend': [68, 88],
      Frauen: [62, 80],
      '1. Mannschaft': [68, 82],
      '2. Mannschaft': [52, 68],
      'Alte Herren': [48, 63],
    };
    for (const team of teams) {
      const trainings = await sql<{ id: string; recorded: boolean; recent: boolean }[]>`
        select id, attendance_recorded_at is not null as recorded, starts_at > now() - interval '28 days' as recent
        from events where team_id = ${team.id} and type = 'training' and status = 'scheduled' and starts_at < now()`;
      const recorded = trainings.filter((x) => x.recorded);
      const open = trainings.filter((x) => !x.recorded);
      expect(recorded.filter((x) => x.recent).length, team.name).toBeGreaterThanOrEqual(4);
      expect(open.length, `${team.name}: offene Trainings`).toBeGreaterThanOrEqual(1);
      expect(open.length, `${team.name}: offene Trainings`).toBeLessThanOrEqual(2);

      const rows = await sql<{ person_id: string; recent: boolean; attended: boolean | null }[]>`
        select p.person_id, e.starts_at > now() - interval '28 days' as recent, p.attended
        from event_participants p join events e on e.id = p.event_id
        where e.team_id = ${team.id} and e.type = 'training' and e.status = 'scheduled'
          and e.starts_at < now() and e.attendance_recorded_at is not null and p.role = 'player'`;
      const quote = (100 * rows.filter((r) => r.attended).length) / rows.length;
      const [min, max] = ranges[team.name]!;
      expect(quote, `${team.name}: Quote ${quote.toFixed(0)} %`).toBeGreaterThanOrEqual(min);
      expect(quote, `${team.name}: Quote ${quote.toFixed(0)} %`).toBeLessThanOrEqual(max);

      // Farbstufen wie im Aufstellungsplaner: letzte vier Wochen, gut ≥ 75, mittel 50–74, niedrig < 50
      const players = new Map<string, { n: number; a: number }>();
      for (const r of rows.filter((x) => x.recent)) {
        const v = players.get(r.person_id) ?? { n: 0, a: 0 };
        v.n += 1;
        if (r.attended) v.a += 1;
        players.set(r.person_id, v);
      }
      const tier = (v: { n: number; a: number }) => {
        const percent = (100 * v.a) / v.n;
        return percent >= 75 ? 'gut' : percent >= 50 ? 'mittel' : 'niedrig';
      };
      const tiers = new Set([...players.values()].map(tier));
      expect(tiers.has('gut'), `${team.name}: gut`).toBe(true);
      expect(tiers.has('niedrig'), `${team.name}: niedrig`).toBe(true);
      if (players.size >= 12) expect(tiers.has('mittel'), `${team.name}: mittel`).toBe(true);
    }
  });

  it('Anwesenheit nur bei Zusage, nie bei Absage, Abwesenheit, offenen oder künftigen Terminen', async () => {
    const wrong = await sql`
      select p.event_id from event_participants p join events e on e.id = p.event_id
      where p.attended is true and (p.status <> 'yes' or p.absence_id is not null
        or e.status = 'cancelled' or e.starts_at > now() or e.attendance_recorded_at is null)`;
    expect(wrong).toHaveLength(0);
    const unrecordedValue = await sql`
      select p.event_id from event_participants p join events e on e.id = p.event_id
      where e.attendance_recorded_at is null and p.attended is not null`;
    expect(unrecordedValue).toHaveLength(0);
    const recordedWithoutValue = await sql`
      select p.event_id from event_participants p join events e on e.id = p.event_id
      where e.attendance_recorded_at is not null and e.type = 'training' and p.role = 'player' and p.attended is null`;
    expect(recordedWithoutValue).toHaveLength(0);
    const futureRecorded = await sql`
      select id from events where attendance_recorded_at is not null and (starts_at > now() or status = 'cancelled')`;
    expect(futureRecorded).toHaveLength(0);
  });

  it('Demo-Trainerin hat in B1 und C1 offene Trainings, Max Becker ist regelmäßig dabei', async () => {
    const open = await sql<{ name: string }[]>`
      select distinct t.name from events e join teams t on t.id = e.team_id
      where e.type = 'training' and e.status = 'scheduled' and e.starts_at < now()
        and e.attendance_recorded_at is null and t.name in ('B-Jugend', 'C-Jugend')`;
    expect(open.map((o) => o.name).sort()).toEqual(['B-Jugend', 'C-Jugend']);
    const [max] = await sql<{ a: number; n: number }[]>`
      select count(*) filter (where p.attended)::int a, count(*)::int n
      from event_participants p join events e on e.id = p.event_id join persons x on x.id = p.person_id
      where x.first_name = 'Max' and x.last_name = 'Becker' and e.type = 'training'
        and e.attendance_recorded_at is not null`;
    expect(max!.a / max!.n).toBeGreaterThan(0.75);
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
    expect(rows).toHaveLength(7);
    for (const r of rows) expect(r.notifications, r.email).toBeGreaterThan(0);
  });

  describe('Ausbau der Vereinskasse und Inhalte', () => {
    it('hat Buchungen über mindestens 24 Monate, Einnahmen und Ausgaben', async () => {
      const [row] = await sql`
        select (max(booked_on) - min(booked_on))::int as days,
          count(*) filter (where kind = 'income')::int as income,
          count(*) filter (where kind = 'expense')::int as expense
        from club_cash_entries where cancelled_at is null`;
      expect(row!.days).toBeGreaterThan(24 * 30 - 20);
      expect(row!.income).toBeGreaterThan(20);
      expect(row!.expense).toBeGreaterThan(20);
    });

    it('Beitragsforderungen: Zahlungen übersteigen nie die Forderung, Quote ca. 70 %', async () => {
      const over = await sql`
        select d.id from club_fee_dues d
        join club_fee_payments p on p.due_id = d.id
        where d.cancelled_at is null
        group by d.id, d.amount_cents having sum(p.amount_cents) > d.amount_cents`;
      expect(over).toHaveLength(0);
      const [q] = await sql`
        select coalesce(sum(p.amount_cents), 0)::float / nullif(sum(d.amount_cents), 0) as quote
        from club_fee_dues d
        left join (select due_id, sum(amount_cents) as amount_cents from club_fee_payments group by 1) p
          on p.due_id = d.id
        where d.cancelled_at is null and d.due_on <= current_date`;
      expect(q!.quote).toBeGreaterThan(0.4);
      expect(q!.quote).toBeLessThan(0.97);
    });

    it('Haushaltsplan hat überzogene und unterschrittene Positionen (Soll-Ist)', async () => {
      const rows = await sql<{ planned: number; actual: number }[]>`
        select b.planned_cents as planned,
          coalesce((select sum(e.amount_cents) from club_cash_entries e
            where e.category_id = b.category_id and e.cancelled_at is null
              and e.kind in ('income', 'expense')
              and extract(year from e.booked_on) = b.year), 0)::int as actual
        from club_budget_lines b
        where b.year = extract(year from current_date)`;
      expect(rows.length).toBeGreaterThan(5);
      expect(rows.some((r) => r.actual > r.planned)).toBe(true);
      expect(rows.some((r) => r.actual < r.planned)).toBe(true);
    });

    it('Rücklagen: Bewegungen ergeben positive Salden, Inventar und Steuerdaten vorhanden', async () => {
      const neg = await sql`
        select reserve_id from club_reserve_moves
        group by reserve_id
        having sum(case when kind = 'allocate' then amount_cents else -amount_cents end) < 0`;
      expect(neg).toHaveLength(0);
      const [r] = await sql`select count(*)::int as n from club_reserves`;
      expect(r!.n).toBeGreaterThan(1);
      const [i] = await sql`select count(*)::int as n from club_inventory`;
      expect(i!.n).toBeGreaterThan(5);
      const [t] = await sql`select count(*)::int as n from club_tax_info`;
      expect(t!.n).toBe(1);
    });

    it('Spendenbescheinigungen sind je Jahr fortlaufend und eindeutig', async () => {
      const rows = await sql<{ receipt_no: string }[]>`
        select receipt_no from club_donations where receipt_no is not null order by receipt_no`;
      expect(rows.length).toBeGreaterThan(2);
      const nos = rows.map((r) => r.receipt_no);
      expect(new Set(nos).size).toBe(nos.length);
      for (const no of nos) expect(no).toMatch(/^\d{4}-\d{3}$/);
      const byYear = new Map<string, number[]>();
      for (const no of nos) {
        const [y, n] = no.split('-');
        byYear.set(y!, [...(byYear.get(y!) ?? []), Number(n)]);
      }
      for (const list of byYear.values()) list.forEach((n, i) => expect(n).toBe(i + 1));
    });

    it('Kassenprüfung ist vorhanden, Archiv enthält mehrere Arten', async () => {
      const [a] = await sql`select count(*)::int as n from club_audits`;
      expect(a!.n).toBeGreaterThan(0);
      const kinds = await sql`select distinct kind from archive_entries`;
      expect(kinds.length).toBeGreaterThanOrEqual(4);
    });

    it('Sponsoren decken Stufen und verschiedene Laufzeiten ab', async () => {
      const rows = await sql<{ starts_on: string | null; ends_on: string | null }[]>`
        select starts_on, ends_on from sponsors`;
      expect(rows.length).toBeGreaterThanOrEqual(6);
      const today = new Date().toISOString().slice(0, 10);
      expect(rows.some((r) => r.ends_on && r.ends_on < today)).toBe(true);
      expect(rows.some((r) => r.starts_on && r.starts_on > today)).toBe(true);
      expect(rows.some((r) => !r.ends_on || r.ends_on >= today)).toBe(true);
    });

    it('Sponsoren haben Logos, News Titelbilder, die Beispielrolle Platzwart Nord ist vergeben', async () => {
      const [a] =
        await sql`select count(*)::int as n from sponsors where logo_ref like '/brand/demo-logo-%'`;
      expect(a!.n).toBe(9 - 1 - 1);
      const [b] =
        await sql`select count(*)::int as n from announcements where image_url like '/brand/demo-news-%'`;
      expect(b!.n).toBeGreaterThanOrEqual(4);
      const [c] = await sql`
        select count(*)::int as n from role_assignments ra
        join roles r on r.id = ra.role_id
        where r.name = 'Platzwart Nord' and r.is_system = false`;
      expect(c!.n).toBe(1);
    });
  });
});
