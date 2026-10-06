import { router, type Href } from 'expo-router';

const KNOWN = [
  '/events/',
  '/news/',
  '/polls/',
  '/absences',
  '/exchange/',
  '/admin/news/',
  '/admin/invites',
  '/teams/',
];

/** Öffnet einen internen Link aus der API (Aktionen, Benachrichtigungen). */
export function openLink(link: string | null | undefined) {
  if (link && KNOWN.some((prefix) => link.startsWith(prefix))) router.push(link as Href);
  else router.push('/notifications');
}
