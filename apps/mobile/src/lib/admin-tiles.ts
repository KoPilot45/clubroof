/**
 * Verwaltungs-Kacheln der Rolle (Paket MS): im Verein-Tab als Kategorie „Verwaltung“, immer alle
 * ausführbaren Funktionen ohne Einklappen. „Übersicht“ führt in den Admin-Modus mit Zahlen und
 * Protokoll. Rechte prüft weiterhin der Server; hier wird nur ein- und ausgeblendet.
 */
import type { MeResponse } from '@clubroof/core';
import { router } from 'expo-router';
import type { TileItem } from '@/components/ui';

export function adminFunctionTiles(me: MeResponse): TileItem[] {
  const a = me.admin;
  const has = (module: string) => me.clubModules.includes(module);
  const overview = me.canAdminister || Object.values(a).some(Boolean);
  const tiles: (TileItem | false)[] = [
    overview && {
      key: 'admin-overview',
      label: 'Übersicht',
      icon: 'speedometer',
      onPress: () => router.push('/admin'),
    },
    a.readMembers && {
      key: 'members',
      label: 'Mitglieder',
      icon: 'people',
      onPress: () => router.push('/admin/members'),
    },
    a.manageMembers && {
      key: 'member-new',
      label: 'Mitglied anlegen',
      icon: 'person-add',
      onPress: () => router.push('/admin/member-new'),
    },
    a.manageMembers && {
      key: 'import',
      label: 'Import',
      icon: 'document-text',
      onPress: () => router.push('/admin/import'),
    },
    (a.manageRoles || a.readMembers) && {
      key: 'roles',
      label: 'Rollen & Rechte',
      icon: 'key',
      onPress: () => router.push('/admin/roles'),
    },
    a.manageTransfers && {
      key: 'transfers',
      label: 'Spielerbewegungen',
      icon: 'swap-horizontal',
      onPress: () => router.push('/admin/transfers'),
    },
    (a.manageTeams || a.planSeason) && {
      key: 'admin-teams',
      label: 'Mannschaften & Saison',
      icon: 'shirt',
      onPress: () => router.push('/admin/teams'),
    },
    a.planEvents && {
      key: 'schedule-import',
      label: 'Spielplan importieren',
      icon: 'cloud-download',
      onPress: () => router.push('/schedule-import'),
    },
    a.planEvents && {
      key: 'club-event-new',
      label: 'Veranstaltung planen',
      icon: 'balloon',
      onPress: () => router.push('/admin/club-event-new'),
    },
    (me.news.write || me.news.publish) && {
      key: 'editorial',
      label: 'News schreiben',
      icon: 'create',
      onPress: () => router.push('/admin/news'),
    },
    me.clubCash?.viewer === 'treasury' && {
      key: 'clubcash',
      label: 'Vereinskasse',
      icon: 'wallet',
      onPress: () => router.push('/club-cash'),
    },
    has('facility_booking') &&
      me.equipment.manage && {
        key: 'block-pitch',
        label: 'Platz sperren',
        icon: 'lock-closed',
        onPress: () => router.push('/facilities/block-new'),
      },
    me.canManageClub && {
      key: 'club-design',
      label: 'Verein & Design',
      icon: 'shield',
      onPress: () => router.push('/admin/club'),
    },
    a.manageModules && {
      key: 'modules',
      label: 'Funktionen',
      icon: 'apps',
      onPress: () => router.push('/admin/modules'),
    },
    me.canManageClub &&
      has('sponsors') && {
        key: 'sponsors-admin',
        label: 'Sponsoren verwalten',
        icon: 'heart',
        onPress: () => router.push('/admin/sponsors'),
      },
    me.canInvite && {
      key: 'invites',
      label: 'Einladen',
      icon: 'person-add-outline',
      onPress: () => router.push('/admin/invites'),
    },
    a.readAudit && {
      key: 'audit',
      label: 'Änderungsprotokoll',
      icon: 'list',
      onPress: () => router.push('/admin/audit'),
    },
  ];
  return tiles.filter((t): t is TileItem => !!t);
}
