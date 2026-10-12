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
        [
          'Auftritt',
          [
            ['club', 'Verein & Design', 'shield', '/admin/club', club],
            ['areas', 'Bereiche', 'git-branch', '/admin/teams', a.manageTeams || a.planSeason],
          ],
        ],
        [
          'System',
          [
            ['modules', 'Funktionen', 'apps', '/admin/modules', a.manageModules],
            ['security', 'Sicherheit', 'lock-closed', '/account', club],
            ['notifications', 'Benachrichtigungen', 'notifications', null, club],
          ],
        ],
        [
          'Abo & Kontrolle',
          [
            ['plan', 'Plan & Abo', 'card', null, club],
            ['audit', 'Änderungsprotokoll', 'list', '/admin/audit', a.readAudit],
          ],
        ],
      ]),
    },
  ];
  return cats.filter((c) => c.groups.length > 0);
}

/** Wer die Admin-Verwaltung öffnen darf: Verwaltungsrolle oder einzelne Verwaltungsrechte. */
export const canOpenAdmin = (me: MeResponse) =>
  me.canAdminister || Object.values(me.admin).some(Boolean) || me.news.write || me.news.publish;

/** Wer die Vereinskasse als eigenen Bereich öffnen darf. */
export const canOpenClubCash = (me: MeResponse) => !!me.clubCash;

/** Kategorien der Vereinskasse: Buchung, Beiträge, Planung, Prüfung. */
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
        ['Kassenbuch', [['entries', 'Kassenbuch', 'book', '/club-cash/entries', full]]],
        [
          'Einrichtung',
          [['accounts', 'Konten & Kategorien', 'settings', '/club-cash/manage', true]],
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
          [['fee-setup', 'Beitragsarten', 'options', '/club-cash/fee-setup', manage]],
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
            ['budget', 'Haushaltsplan', 'clipboard', null, true],
            ['actual', 'Soll-Ist', 'git-compare', null, true],
          ],
        ],
        [
          'Abschluss',
          [
            ['reserves', 'Rücklagen', 'wallet', null, true],
            ['year-end', 'Jahresabschluss', 'document-text', null, true],
          ],
        ],
      ]),
    },
    {
      key: 'pruefung',
      label: 'Prüfung',
      icon: 'checkmark-done',
      groups: groups([
        ['Kassenprüfung', [['audit', 'Kassenprüfung', 'search', null, true]]],
        ['Spenden', [['donations', 'Spendenquittungen', 'ribbon', null, true]]],
      ]),
    },
  ];
}
