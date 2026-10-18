import { useLocalSearchParams } from 'expo-router';
import { ArchiveView } from '@/components/archive-view';

/** Archiv einer Mannschaft (Paket AR): gelöschte Aufgaben für das Trainerteam. */
export default function TeamArchiveScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <ArchiveView teamId={id} />;
}
