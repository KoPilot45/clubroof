/**
 * Eigener Zugang für Kinder: SQL-Bedingungen für Verknüpfungen Eltern → Kind je Stufe.
 * Zentrale Stelle, damit Benachrichtigungen, Erinnerungen und Kontakte dieselbe Regel nutzen.
 */
import { schema as s } from '@clubroof/db';
import { eq, ne } from 'drizzle-orm';

/** Eltern sehen das Kind (Stufe 1 und 2): Benachrichtigungen, Kalender, Kasse */
export const guardianSeesChild = ne(s.guardianships.access, 'none');
/** Eltern entscheiden mit (Stufe 1): Erinnerungen zum Antworten */
export const guardianActsForChild = eq(s.guardianships.access, 'manage');
