import type { ClubCash } from '@clubroof/core';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ChoiceChips } from '@/components/ui';
import { useSignedIn } from '@/lib/session';

/**
 * Konto und Kategorie für eine Buchung wählen (Paket K5): Voreinstellung ist das erste Konto und – wenn
 * vorhanden – die Kategorie mit dem Vorzugsnamen. Bei mehreren Kassen steht die Kasse vor dem Konto.
 */
export function useBookingTarget(direction: 'income' | 'expense', preferred?: string) {
  const { api } = useSignedIn();
  const cash = useQuery({ queryKey: ['club-cash'], queryFn: () => api<ClubCash>('/club-cash') });
  const [accountId, setAccountId] = useState<string | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const c = cash.data;
  const accounts = (c?.accounts ?? []).filter((a) => !a.archived);
  const categories = (c?.categories ?? []).filter((k) => !k.archived && k.direction === direction);
  const account = accountId ?? accounts[0]?.id ?? null;
  const category =
    categoryId ?? categories.find((k) => k.name === preferred)?.id ?? categories[0]?.id ?? null;
  const many = (c?.funds.filter((f) => !f.archived).length ?? 0) > 1;
  const picker = (
    <>
      <ChoiceChips
        label="Konto"
        options={accounts.map((a) => ({
          value: a.id,
          label: many
            ? `${c?.funds.find((f) => f.id === a.fundId)?.name ?? ''} › ${a.name}`
            : a.name,
        }))}
        selected={account ? [account] : []}
        onToggle={setAccountId}
      />
      <ChoiceChips
        label="Kategorie"
        options={categories.map((k) => ({ value: k.id, label: k.name }))}
        selected={category ? [category] : []}
        onToggle={setCategoryId}
      />
    </>
  );
  return { cash, account, category, picker, ready: !!account && !!category };
}
