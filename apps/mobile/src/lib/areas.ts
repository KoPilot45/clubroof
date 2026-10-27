/**
 * Eigene Bereiche „Admin-Verwaltung“ und „Vereinskasse“ (Paket AV): Kategorien mit farbigen Untergruppen und
 * Funktionskacheln. Rechte prüft weiterhin der Server; hier wird nur ein- und ausgeblendet.
 */
import type { MeResponse } from '@clubroof/core';
import type { TintKey } from '@clubroof/design-tokens';
import { router, type Href } from 'expo-router';
import type { IconName, TileItem } from '@/components/ui';

export type AreaGroup = { key: string; title: string; tint: TintKey; tiles: TileItem[] };
export type AreaCategory = {
  key: string;
  label: string;
  icon: IconName;
  groups: AreaGroup[];
};

/** Farben der Untergruppen innerhalb einer Kategorie, der Reihe nach. */
const TINTS: TintKey[] = ['blue', 'orange', 'violet', 'green', 'pink'];

type Def = [key: string, label: string, icon: IconName, href: Href | null, show?: boolean];

const tiles = (defs: Def[]): TileItem[] =>
  defs
    .filter(([, , , , show = true]) => show)
    // ohne Ziel = Funktion folgt in einem späteren Paket („Bald verfügbar“)
    .map(([key, label, icon, href]) => ({
      key,
      label,
      icon,
      ...(href ? { onPress: () => router.push(href) } : { soon: true }),
    }));

/** Gruppen mit Kacheln; leere Gruppen entfallen, die Farben laufen über die verbleibenden Gruppen. */
function groups(list: [string, Def[]][]): AreaGroup[] {
  return list
    .map(([title, defs]) => ({ title, tiles: tiles(defs) }))
    .filter((g) => g.tiles.length > 0)
    .map((g, i) => ({
      key: g.title,
      title: g.title,
      tint: TINTS[i % TINTS.length]!,
      tiles: g.tiles,
    }));
}

/** Kategorien der Admin-Verwaltung: Mitglieder, Sport, Inhalte, Verein. */
export function adminCategories(me: MeResponse): AreaCategory[] {
  const a = me.admin;
  const has = (m: string) => me.clubModules.includes(m);
  const club = me.canManageClub;
  const cats: AreaCategory[] = [
    {
      key: 'mitglieder',
      label: 'Mitglieder',
      icon: 'people',
      groups: groups([
        [
          'Personen',
          [
            ['members', 'Mitglieder', 'people', '/admin/members', a.readMembers],
            ['member-new', 'Mitglied anlegen', 'person-add', '/admin/member-new', a.manageMembers],
            ['import', 'Importieren', 'document-text', '/admin/import', a.manageMembers],
            ['export', 'Exportieren', 'download', null, a.readMembers],
            ['cleanup', 'Bereinigen', 'sparkles', null, a.manageMembers],
          ],
        ],
        [
          'Zugang & Rechte',
          [
            ['invites', 'Einladen', 'person-add-outline', '/admin/invites', me.canInvite],
            ['roles', 'Rollen & Rechte', 'key', '/admin/roles', a.manageRoles || a.readMembers],
            ['privacy', 'Datenschutz', 'shield-checkmark', null, club],
          ],
        ],
        [
          'Bewegung',
          [
            [
              'transfers',
              'Spielerbewegungen',
              'swap-horizontal',
              '/admin/transfers',
              a.manageTransfers,
            ],
          ],
        ],
      ]),
    },
    {
      key: 'sport',
      label: 'Sport',
      icon: 'shirt',
      groups: groups([
        [
          'Mannschaften',
          [
            [
              'admin-teams',
              'Mannschaften & Saison',
              'shirt',
              '/admin/teams',
              a.manageTeams || a.planSeason,
            ],
            ['team-new', 'Mannschaft anlegen', 'add-circle', '/admin/team-new', a.manageTeams],
            ['season', 'Saisonwechsel', 'calendar', '/admin/teams', a.planSeason],
          ],
        ],
        [
          'Spielbetrieb',
          [
            [
              'schedule-import',
              'Spielplan importieren',
              'cloud-download',
              '/schedule-import',
              a.planEvents,
            ],
            [
              'club-event-new',
              'Veranstaltung planen',
              'balloon',
              '/admin/club-event-new',
              a.planEvents,
            ],
            ['club-events', 'Veranstaltungen', 'calendar', '/admin/club-events', a.planEvents],
            ['referees', 'Schiedsrichter-Soll', 'flag', '/referees', me.referees.manage],
          ],
        ],
        [
          'Anlage',
          [
            ['facilities', 'Anlagen & Plätze', 'location', null, me.equipment.manage],
            [
              'block-pitch',
              'Platz sperren',
              'lock-closed',
              '/facilities/block-new',
              has('facility_booking') && me.equipment.manage,
            ],
            [
              'equipment',
              'Material',
              'cube',
              '/equipment',
              has('equipment') && me.equipment.manage,
            ],
          ],
        ],
      ]),
    },
    {
      key: 'inhalte',
      label: 'Inhalte',
      icon: 'newspaper',
      groups: groups([
        [
          'Mitteilungen',
          [
            [
              'editorial',
              'News-Redaktion',
              'create',
              '/admin/news',
              me.news.write || me.news.publish,
            ],
            [
              'polls',
              'Umfragen',
              'stats-chart',
              '/polls',
              has('polls') && me.create.polls.length > 0,
            ],
            ['forum', 'Forum-Moderation', 'chatbubbles', '/forum', has('forum') && a.readMembers],
          ],
        ],
        [
          'Ablage',
          [
            [
              'docs',
              'Dokumente',
              'folder',
              '/documents',
              has('documents') && me.create.documents.length > 0,
            ],
            ['contacts', 'Ansprechpartner', 'call', '/contacts', club],
            ['wiki', 'Vereinswissen', 'book', '/wiki', has('wiki') && club],
          ],
        ],
        [
          'Partner & Helfer',
          [
            ['sponsors-admin', 'Sponsoren', 'heart', '/admin/sponsors', club && has('sponsors')],
            ['helpers', 'Helfer', 'hand-left', '/helpers', has('helpers') && a.planEvents],
          ],
        ],
      ]),
    },
    {
      key: 'verein',
      label: 'Verein',
      icon: 'shield',
      groups: groups([
        ['Auftritt', [['club', 'Verein & Design', 'shield', '/admin/club', club]]],
        [
          'Struktur',
          [
            ['departments', 'Abteilungen', 'git-branch', '/admin/departments', club],
            ['funds', 'Kassen', 'wallet', '/admin/funds', canOpenClubCash(me)],
          ],
        ],
        [
          'System',
          [
            ['modules', 'Funktionen', 'apps', '/admin/modules', a.manageModules],
            ['security', 'Sicherheit', 'lock-closed', '/account', club],
            ['support', 'Support', 'help-buoy', '/admin/support', club],
            ['notifications', 'Benachrichtigungen', 'notifications', null, club],
          ],
        ],
        [
          'Abo & Kontrolle',
          [
            ['plan', 'Plan & Abo', 'card', null, club],
            ['audit', 'Änderungsprotokoll', 'list', '/admin/audit', a.readAudit],
            ['archive', 'Archiv', 'archive', '/admin/archive', a.readArchive],
          ],
        ],
      ]),
    },
  ];
  return cats.filter((c) => c.groups.length > 0);
}

/**
 * Wer die Admin-Verwaltung öffnen darf: Verwaltungsrolle oder einzelne Verwaltungsrechte. Das Recht
 * „News schreiben“ gehört nicht dazu – die Redaktion erreicht man unter Verein → Verwaltung.
 */
export const canOpenAdmin = (me: MeResponse) =>
  me.canAdminister || Object.values(me.admin).some(Boolean);

/** Redaktion (News schreiben/veröffentlichen) darf `/admin/news…` auch ohne Verwaltungsrecht öffnen. */
export const canOpenAdminPath = (me: MeResponse, path: string) =>
  canOpenAdmin(me) || ((me.news.write || me.news.publish) && path.startsWith('/admin/news'));

/** Wer die Vereinskasse als eigenen Bereich öffnen darf. */
export const canOpenClubCash = (me: MeResponse) => me.clubCash?.viewer === 'treasury';

/** Vorstand mit freigegebener Einsicht: nur die reine Kassenübersicht (Verein → Vereinsleben). */
export const canSeeCashOverview = (me: MeResponse) => me.clubCash?.viewer === 'board';

/** Kategorien der Vereinskasse: Buchung, Beiträge, Planung, Auswertung. */
export function cashCategories(me: MeResponse): AreaCategory[] {
  const manage = !!me.clubCash?.manage;
  const full = me.clubCash?.level === 'full';
  return [
    {
      key: 'buchung',
      label: 'Buchung',
      icon: 'receipt',
      groups: groups([
        [
          'Erfassen',
          [
            ['income', 'Einnahme', 'arrow-down', '/club-cash/new?kind=income', manage],
            ['expense', 'Ausgabe', 'arrow-up', '/club-cash/new?kind=expense', manage],
            ['transfer', 'Umbuchung', 'swap-horizontal', '/club-cash/new?kind=transfer', manage],
          ],
        ],
        [
          'Auslagen & Vergütungen',
          [
            ['claims', 'Auslagen', 'receipt', '/club-cash/claims', manage],
            ['allowances', 'Pauschalen', 'ribbon', '/club-cash/allowances', full],
          ],
        ],
        [
          'Besondere Einnahmen',
          [
            ['grants', 'Zuschüsse', 'gift', '/club-cash/grants', full],
            ['team-grants', 'Mannschaftszuschuss', 'shirt', '/club-cash/team-grants', full],
            ['sponsors', 'Sponsoren', 'heart', '/club-cash/sponsors', full],
            ['donations', 'Spenden', 'heart', '/club-cash/donations', full],
          ],
        ],
        ['Kassenbuch', [['entries', 'Kassenbuch', 'book', '/club-cash/entries', full]]],
        [
          'Einrichtung',
          [
            ['accounts', 'Konten & Kategorien', 'settings', '/club-cash/manage', true],
            ['funds', 'Kassen', 'wallet', '/club-cash/funds', true],
          ],
        ],
      ]),
    },
    {
      key: 'beitraege',
      label: 'Beiträge',
      icon: 'people',
      groups: groups([
        ['Mitglieder', [['fees', 'Beitragsübersicht', 'people', '/club-cash/fees', true]]],
        [
          'Einrichtung',
          [
            ['fee-setup', 'Beitragsarten', 'options', '/club-cash/fee-setup', manage],
            [
              'cash-import',
              'Aus Datei übernehmen',
              'document-text',
              '/import?area=fee_types',
              manage,
            ],
          ],
        ],
        [
          'Mahnwesen',
          [
            [
              'fee-import',
              'Kontoauszug importieren',
              'cloud-upload',
              '/club-cash/fee-import',
              manage,
            ],
            ['reminders', 'Erinnerungen', 'notifications', '/club-cash/fees', manage],
          ],
        ],
      ]),
    },
    {
      key: 'planung',
      label: 'Planung',
      icon: 'analytics',
      groups: groups([
        [
          'Haushalt',
          [
            ['budget', 'Haushaltsplan', 'clipboard', '/club-cash/budget?mode=plan', true],
            ['actual', 'Soll-Ist', 'git-compare', '/club-cash/budget?mode=actual', true],
          ],
        ],
        [
          'Abschluss',
          [
            ['reserves', 'Rücklagen', 'wallet', '/club-cash/reserves', true],
            ['year-end', 'Jahresabschluss', 'document-text', '/club-cash/closing', full],
            ['inventory', 'Inventar', 'cube', '/club-cash/inventory', full],
          ],
        ],
      ]),
    },
    {
      key: 'auswertung',
      label: 'Auswertung',
      icon: 'stats-chart',
      groups: groups([
        [
          'Statistik',
          [
            ['stats-overview', 'Überblick', 'speedometer', '/club-cash/stats?topic=overview', true],
            [
              'stats-flows',
              'Einnahmen & Ausgaben',
              'swap-vertical',
              '/club-cash/stats?topic=flows',
              true,
            ],
            ['stats-plan', 'Plan gegen Ist', 'git-compare', '/club-cash/stats?topic=plan', true],
            ['stats-fees', 'Beiträge', 'people', '/club-cash/stats?topic=fees', true],
            [
              'stats-departments',
              'Abteilungen',
              'business',
              '/club-cash/stats?topic=departments',
              true,
            ],
          ],
        ],
        ['Prüfung', [['audit', 'Kassenprüfung', 'search', '/club-cash/audit', true]]],
        ['Steuer', [['tax', 'Steuerdaten', 'document-text', '/club-cash/tax', full]]],
      ]),
    },
  ];
}
