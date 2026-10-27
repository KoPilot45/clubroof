import type { GuardianAccess } from '@clubroof/core';

/** Texte der drei Stufen des Elternzugangs (Paket KIND-EIGENER-ZUGANG). */
export const ACCESS_LEVELS: {
  value: GuardianAccess;
  icon: 'people-outline' | 'eye-outline' | 'person-outline';
  title: string;
  parents: string;
  child: string;
}[] = [
  {
    value: 'manage',
    icon: 'people-outline',
    title: 'Mitsicht und Mitentscheiden',
    parents:
      'Ihr antwortet, meldet Abwesenheiten und bucht Fahrten für das Kind und seht die Kasse weiter.',
    child:
      'Deine Eltern sehen deine Termine und antworten, melden Abwesenheiten und buchen Fahrten für dich.',
  },
  {
    value: 'view',
    icon: 'eye-outline',
    title: 'Nur Mitsicht',
    parents: 'Ihr seht Termine, Zusagen und Kasse, könnt aber nichts für das Kind tun.',
    child:
      'Deine Eltern sehen deine Termine, können aber nichts für dich tun. Du antwortest selbst.',
  },
  {
    value: 'none',
    icon: 'person-outline',
    title: 'Eigenständig',
    parents: 'Ihr seht und tut nichts mehr für das Kind. Das Kind entscheidet allein.',
    child: 'Deine Eltern sehen nichts mehr von dir und tun nichts für dich.',
  },
];

export const accessTitle = (a: GuardianAccess) => ACCESS_LEVELS.find((l) => l.value === a)!.title;
