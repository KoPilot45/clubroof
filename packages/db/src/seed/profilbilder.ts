/**
 * Profilbilder des Demovereins (Paket DEMO-PROFILBILDER-LOGO): 20 gelieferte, gezeichnete Avatare unter
 * `apps/api/assets/` (Männer, Frauen, Jungen, Mädchen, je fünf). Die Zuordnung ist deterministisch
 * (stabile Zahl je Person, kein Zufallsgenerator), damit jeder `db:reset` dieselben Bilder liefert.
 */
import { fakerDE as faker } from '@faker-js/faker';

type Gruppe = 'maenner' | 'frauen' | 'jungen' | 'maedchen';
type Person = {
  id: string;
  firstName: string;
  lastName: string;
  birthDate?: string | null;
  membershipStatus?: string | null;
  avatarUrl?: string | null;
};
type Mitglied = { person: Person; fn: 'player' | 'coach' | 'assistant_coach' };

const PRO_GRUPPE = 5;
const ERWACHSENE_QUOTE = 30; // Prozent der übrigen Erwachsenen mit Bild
const KINDER_JE_MANNSCHAFT = 5;

const bildUrl = (g: Gruppe, n: number) =>
  `/brand/demo-avatar-${g}-${String(n).padStart(2, '0')}.webp`;

/** Stabile Zahl je Person (FNV-1a), unabhängig von UUIDs und Reihenfolge. */
function hash(p: Person, salt = ''): number {
  let h = 2166136261;
  for (const ch of `${salt}|${p.firstName}|${p.lastName}|${p.birthDate}`) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h;
}

const NAMEN = faker.rawDefinitions.person!.first_name as { female: string[]; male: string[] };
const WEIBLICH = new Set(NAMEN.female);
const MAENNLICH = new Set(NAMEN.male);

/** Das Geschlecht steht nicht in der Datenbank; es folgt aus dem Vornamen (Namenslisten des Generators). */
function istWeiblich(p: Person): boolean {
  if (WEIBLICH.has(p.firstName) && !MAENNLICH.has(p.firstName)) return true;
  if (MAENNLICH.has(p.firstName)) return false;
  return hash(p, 'sex') % 2 === 0;
}

function alter(p: Person, today: Date): number {
  if (!p.birthDate) return 99;
  const [y, m, d] = p.birthDate.split('-').map(Number) as [number, number, number];
  let a = today.getUTCFullYear() - y;
  if (today.getUTCMonth() + 1 < m || (today.getUTCMonth() + 1 === m && today.getUTCDate() < d)) a--;
  return a;
}

export function weiseProfilbilderZu(ctx: {
  today: Date;
  persons: Person[];
  guardianships: { guardianPersonId: string; childPersonId: string }[];
  teamMembers: Record<string, Mitglied[]>;
  /** Feste Zuordnung (Demo-Logins und Familie): Person → Gruppe und Nummer */
  fest: [Person, Gruppe, number][];
  /** Amtsträger (Vorstand, Kasse, Funktionäre): bekommen immer ein Bild */
  amtstraeger: Person[];
}) {
  const { today, persons, guardianships, teamMembers, fest, amtstraeger } = ctx;
  const gewaehlt = new Map<string, string>(); // Person-ID → Bild
  const teamsJePerson = new Map<string, string[]>();
  const bilderJeTeam = new Map<string, Set<string>>();
  const kinderJeTeam = new Map<string, number>();
  const verwandte = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!verwandte.has(a)) verwandte.set(a, new Set());
    verwandte.get(a)!.add(b);
  };
  for (const g of guardianships) {
    link(g.guardianPersonId, g.childPersonId);
    link(g.childPersonId, g.guardianPersonId);
  }
  for (const [team, list] of Object.entries(teamMembers)) {
    bilderJeTeam.set(team, new Set());
    for (const m of list) {
      const t = teamsJePerson.get(m.person.id) ?? [];
      if (!t.includes(team)) t.push(team);
      teamsJePerson.set(m.person.id, t);
    }
  }
  const istKind = (p: Person) => alter(p, today) < 18;

  const vergeben = (p: Person, url: string) => {
    gewaehlt.set(p.id, url);
    for (const t of teamsJePerson.get(p.id) ?? []) {
      bilderJeTeam.get(t)!.add(url);
      if (istKind(p)) kinderJeTeam.set(t, (kinderJeTeam.get(t) ?? 0) + 1);
    }
  };

  const festIds = new Set<string>();
  for (const [p, g, n] of fest) {
    festIds.add(p.id);
    vergeben(p, bildUrl(g, n));
  }

  const amt = new Set(amtstraeger.map((p) => p.id));
  for (const list of Object.values(teamMembers))
    for (const m of list) if (m.fn !== 'player') amt.add(m.person.id);

  const kandidaten = persons
    .filter((p) => !festIds.has(p.id) && p.membershipStatus !== 'left')
    .sort((a, b) => hash(a) - hash(b) || a.lastName.localeCompare(b.lastName));

  const waehle = (p: Person): boolean => {
    const kind = istKind(p);
    const gruppe: Gruppe = kind
      ? istWeiblich(p)
        ? 'maedchen'
        : 'jungen'
      : istWeiblich(p)
        ? 'frauen'
        : 'maenner';
    const teams = teamsJePerson.get(p.id) ?? [];
    const gesperrt = new Set<string>();
    for (const t of teams) for (const u of bilderJeTeam.get(t)!) gesperrt.add(u);
    for (const id of verwandte.get(p.id) ?? []) {
      const u = gewaehlt.get(id);
      if (u) gesperrt.add(u);
    }
    const start = hash(p, 'bild') % PRO_GRUPPE;
    for (let i = 0; i < PRO_GRUPPE; i++) {
      const url = bildUrl(gruppe, ((start + i) % PRO_GRUPPE) + 1);
      if (gesperrt.has(url)) continue;
      vergeben(p, url);
      return true;
    }
    return false;
  };

  for (const p of kandidaten) {
    if (istKind(p)) {
      const teams = teamsJePerson.get(p.id) ?? [];
      if (teams.length === 0) continue;
      if (teams.some((t) => (kinderJeTeam.get(t) ?? 0) >= KINDER_JE_MANNSCHAFT)) continue;
      // etwa ein Viertel der Kinder, sonst wäre die Grenze je Mannschaft meist zu schnell erreicht
      if (hash(p, 'kind') % 100 >= 25) continue;
      waehle(p);
    } else if (amt.has(p.id) || hash(p, 'erw') % 100 < ERWACHSENE_QUOTE) {
      waehle(p);
    }
  }

  for (const p of persons) {
    const url = gewaehlt.get(p.id);
    if (url) p.avatarUrl = url;
  }
}
