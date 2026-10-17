import { CLUB_CASH_AREA_LABEL, type ClubCashStats } from '@clubroof/core';
import { formatEuro, formatEuroShort, formatPercent } from './format';
import { dateFormat, t } from './i18n';

const MONTH_SHORT = dateFormat({ month: 'short', timeZone: 'UTC' });
const MONTH_LONG = dateFormat({ month: 'long', timeZone: 'UTC' });

/** Beschriftung eines Periodenschlüssels: „Okt“ bzw. „Q3“. */
export function periodLabel(key: string, long = false): string {
  if (key.includes('-Q')) return key.slice(key.indexOf('-') + 1);
  const d = new Date(`${key}-01T00:00:00Z`);
  return (long ? MONTH_LONG : MONTH_SHORT).format(d).replace('.', '');
}

/** „2,0 T€ über dem Vorjahr“-Satz für den Kassenstand (Aussage in Worten, automatisch berechnet). */
export function balanceSentence(s: ClubCashStats): string | null {
  if (s.balance.length === 0) return null;
  const diff = s.totals.balanceCents - s.totals.previousBalanceCents;
  const top = s.balance.reduce((a, b) => (b.cents > a.cents ? b : a));
  const vs =
    diff === 0
      ? t('Der Bestand entspricht dem Vorjahr.')
      : diff > 0
        ? t(`Der Bestand liegt ${formatEuroShort(diff)} über dem Vorjahr.`)
        : t(`Der Bestand liegt ${formatEuroShort(-diff)} unter dem Vorjahr.`);
  return `${vs} ${t(`Höchster Stand: ${periodLabel(top.key, true)}.`)}`;
}

export function flowsSentence(s: ClubCashStats): string {
  const saldo = s.totals.incomeCents - s.totals.expenseCents;
  return saldo >= 0
    ? t(
        `Einnahmen ${formatEuro(s.totals.incomeCents)}, Ausgaben ${formatEuro(s.totals.expenseCents)} – ein Überschuss von ${formatEuro(saldo)}.`,
      )
    : t(
        `Einnahmen ${formatEuro(s.totals.incomeCents)}, Ausgaben ${formatEuro(s.totals.expenseCents)} – ein Minus von ${formatEuro(-saldo)}.`,
      );
}

export function areasSentence(s: ClubCashStats): string | null {
  const best = [...s.areas].sort((a, b) => b.incomeCents - a.incomeCents)[0];
  if (!best || best.incomeCents === 0) return null;
  return t(
    `Die meisten Einnahmen kommen aus dem Bereich ${CLUB_CASH_AREA_LABEL[best.area]} (${formatEuro(best.incomeCents)}).`,
  );
}

/** Plan gegen Ist: Anzahl der Ausgabenposten über Plan. */
export function planSentence(s: ClubCashStats): string | null {
  if (!s.plan) return null;
  const expenses = s.plan.lines.filter((l) => l.direction === 'expense');
  const over = expenses.filter((l) => l.actualCents > l.plannedCents);
  if (expenses.length === 0) return null;
  return over.length === 0
    ? t('Alle Ausgabenposten liegen im Plan.')
    : over.length === 1
      ? t(`1 von ${expenses.length} Ausgabenposten liegt über dem Plan.`)
      : t(`${over.length} von ${expenses.length} Ausgabenposten liegen über dem Plan.`);
}

export function feesSentence(s: ClubCashStats): string | null {
  if (!s.fees || s.fees.dueCents === 0) return null;
  const rate = (s.fees.paidCents / s.fees.dueCents) * 100;
  const over =
    s.fees.overdueCount === 0
      ? t('Nichts ist überfällig.')
      : s.fees.overdueCount === 1
        ? t(`1 Beitrag ist überfällig (${formatEuro(s.fees.overdueCents)}).`)
        : t(
            `${s.fees.overdueCount} Beiträge sind überfällig (${formatEuro(s.fees.overdueCents)}).`,
          );
  return `${t(`${formatPercent(rate)} der Beiträge sind bezahlt.`)} ${over}`;
}

export function departmentsSentence(s: ClubCashStats): string | null {
  const top = s.departments[0];
  if (!top) return null;
  return t(`${top.name} hat mit ${formatEuro(top.expenseCents)} die meisten Ausgaben.`);
}

/** Plan-Abweichung als Chip-Text mit Zeichen: „79 %“ bzw. „▲ +18 %“ (Überschreitung). */
export function planChip(planned: number, actual: number): { label: string; over: boolean } {
  if (planned <= 0) return { label: actual > 0 ? t('ohne Plan') : '–', over: actual > 0 };
  const pct = Math.round((actual / planned) * 100);
  return pct > 100
    ? { label: `▲ +${pct - 100} %`, over: true }
    : { label: `${pct} %`, over: false };
}

/** Rücklagen: wie viele ihr Ziel erreicht haben. */
export function reservesSentence(s: ClubCashStats): string | null {
  const withGoal = s.reserves.filter((r) => r.targetCents);
  if (withGoal.length === 0) return null;
  const done = withGoal.filter((r) => r.balanceCents >= r.targetCents!).length;
  return done === 0
    ? t('Noch keine Rücklage hat ihr Ziel erreicht.')
    : done === 1
      ? t(`1 von ${withGoal.length} Rücklagen hat ihr Ziel erreicht.`)
      : t(`${done} von ${withGoal.length} Rücklagen haben ihr Ziel erreicht.`);
}
