import type { ClubCashFund } from '@clubroof/core';
import { ChoiceChips } from '@/components/ui';
import { t } from '@/lib/i18n';

/** Umschalter „Alle | Kasse …“ (Paket K6); erscheint nur, wenn es mehrere Kassen gibt. */
export function FundSwitcher({
  funds,
  value,
  onChange,
}: {
  funds: ClubCashFund[];
  value: string | null;
  onChange: (id: string | null) => void;
}) {
  const active = funds.filter((f) => !f.archived);
  if (active.length < 2) return null;
  const selected = value && active.some((f) => f.id === value) ? value : 'all';
  return (
    <ChoiceChips
      scroll
      selected={[selected]}
      onToggle={(v) => onChange(v === 'all' ? null : v)}
      options={[
        { value: 'all', label: t('Alle') },
        ...active.map((f) => ({ value: f.id, label: f.name })),
      ]}
    />
  );
}
