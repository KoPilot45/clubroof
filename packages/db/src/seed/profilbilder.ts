/**
 * Profilbilder des Demovereins (Paket DEMO-PROFILBILDER-LOGO): 20 gelieferte, gezeichnete Avatare unter
 * `apps/api/assets/` (Männer, Frauen, Jungen, Mädchen, je fünf). Die Zuordnung ist deterministisch
 * (stabile Zahl je Person, kein Zufallsgenerator), damit jeder `db:reset` dieselben Bilder liefert.
 * Jede Person erhält ein Bild ihrer Gruppe (Geschlecht, Erwachsene/Kinder); Wiederholungen sind gewollt, nur
 * Eltern und ihre Kinder zeigen nie dasselbe Bild.
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

const PRO_GRUPPE = 5;

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
  /** Feste Zuordnung (Demo-Logins und Familie): Person → Gruppe und Nummer */
  fest: [Person, Gruppe, number][];
}) {
  const { today, persons, guardianships, fest } = ctx;
  const gewaehlt = new Map<string, string>(); // Person-ID → Bild
  const verwandte = new Map<string, Set<string>>();
  const link = (a: string, b: string) => {
    if (!verwandte.has(a)) verwandte.set(a, new Set());
    verwandte.get(a)!.add(b);
  };
  for (const g of guardianships) {
    link(g.guardianPersonId, g.childPersonId);
    link(g.childPersonId, g.guardianPersonId);
  }

  const festIds = new Set<string>();
  for (const [p, g, n] of fest) {
    festIds.add(p.id);
    gewaehlt.set(p.id, bildUrl(g, n));
  }

  const kandidaten = persons
    .filter((p) => !festIds.has(p.id))
    .sort((a, b) => hash(a) - hash(b) || a.lastName.localeCompare(b.lastName));

  for (const p of kandidaten) {
    const kind = alter(p, today) < 18;
    const weiblich = istWeiblich(p);
    const gruppe: Gruppe = kind
      ? weiblich
        ? 'maedchen'
        : 'jungen'
      : weiblich
        ? 'frauen'
        : 'maenner';
    const gesperrt = new Set<string>();
    for (const id of verwandte.get(p.id) ?? []) {
      const u = gewaehlt.get(id);
      if (u) gesperrt.add(u);
    }
    const start = hash(p, 'bild') % PRO_GRUPPE;
    for (let i = 0; i < PRO_GRUPPE; i++) {
      const url = bildUrl(gruppe, ((start + i) % PRO_GRUPPE) + 1);
      if (gesperrt.has(url)) continue;
      gewaehlt.set(p.id, url);
      break;
    }
  }

  for (const p of persons) {
    const url = gewaehlt.get(p.id);
    if (url) p.avatarUrl = url;
  }
}
