import type { TileHub, TileInfo } from '@clubroof/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { TileItem } from '@/components/ui';
import { useSignedIn } from './session';

/** Kachel-Infos eines Menüs („Du hast 12,50 € offen“); fehlen sie, bleiben die Kacheln einfach ohne Hinweis. */
export function useTileInfo(hub: TileHub, teamId?: string | null) {
  const { api } = useSignedIn();
  const query = useQuery({
    queryKey: ['tile-info', hub, teamId ?? null],
    queryFn: () => api<TileInfo>(`/tile-info?hub=${hub}${teamId ? `&teamId=${teamId}` : ''}`),
    enabled: hub !== 'team' && hub !== 'cash' ? true : !!teamId,
    staleTime: 20_000,
  });
  return query.data;
}

/** Hinweis, Zähler und Ton vom Server in die Kacheln einsetzen. */
export function withTileInfo(tiles: TileItem[], info: TileInfo | undefined): TileItem[] {
  if (!info) return tiles;
  return tiles.map((tile) => {
    const entry = info[tile.key];
    if (!entry) return tile;
    return {
      ...tile,
      hint: entry.hint ?? tile.hint,
      badge: entry.badge ?? tile.badge,
      tone: entry.tone ?? tile.tone,
    };
  });
}

/** Bereich beim Öffnen als angesehen merken; danach verschwindet „n neu“ in den Kacheln. */
export function useMarkSeen(key: string | null) {
  const { api } = useSignedIn();
  const queryClient = useQueryClient();
  useEffect(() => {
    if (!key) return;
    void api('/me/seen', { method: 'POST', body: { key } })
      .then(() => queryClient.invalidateQueries({ queryKey: ['tile-info'] }))
      .catch(() => undefined);
    // nur beim Öffnen des Bereichs
  }, [key]);
}
