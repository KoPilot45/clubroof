import type { PollSummary } from '@clubroof/core';
import { formatRemaining } from '@/lib/format';
import { Chip } from './ui';

export function PollStatus({ poll }: { poll: PollSummary }) {
  if (!poll.isOpen) return <Chip tone="archived" label="Beendet" />;
  if (poll.myOptionId) return <Chip tone="success" icon="checkmark" label="Abgestimmt" />;
  return <Chip tone="action" label={poll.closesAt ? formatRemaining(poll.closesAt) : 'Offen'} />;
}
