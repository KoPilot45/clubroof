/**
 * Tabelle der Desktop-Ansicht (Paket DT2, Vorlage C): Spalten mit Sortierung per Klick auf den Kopf, Hover, Tastatur
 * (Pfeile wählen die Zeile, Enter öffnet, Leertaste markiert), optionale Mehrfachauswahl mit Sammelaktionen und
 * Export als CSV (Auswahl oder alle Zeilen). Nur für den Desktop gedacht; auf dem Handy bleibt die Liste.
 */
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState, type ReactNode } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { t } from '@/lib/i18n';
import { useTheme } from '@/lib/theme';
import { webState } from '@/lib/web-state';
import { Text } from './app-text';
import { Button, Card, T } from './ui';

export type Column<R> = {
  key: string;
  label: string;
  /** feste Breite; ohne Angabe teilt sich die Spalte den Rest (`flex`) */
  width?: number;
  flex?: number;
  align?: 'right';
  /** Sortierfunktion; ohne Angabe nicht sortierbar */
  sort?: (a: R, b: R) => number;
  render: (row: R) => ReactNode;
  /** Text für den CSV-Export; ohne Angabe fehlt die Spalte im Export */
  csv?: (row: R) => string;
};

export type BulkAction<R> = {
  label: string;
  icon?: 'trash-outline' | 'arrow-undo';
  onPress: (rows: R[]) => void;
};

function saveCsv(name: string, header: string[], lines: string[][]) {
  if (Platform.OS !== 'web') return;
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const text = [header, ...lines].map((l) => l.map(cell).join(';')).join('\r\n');
  const blob = new Blob(['﻿' + text], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export function DataTable<R>({
  columns,
  rows,
  rowKey,
  onRowPress,
  bulkActions,
  selectable: selectableProp,
  exportName,
  defaultSort,
}: {
  columns: Column<R>[];
  rows: R[];
  rowKey: (row: R) => string;
  onRowPress?: (row: R) => void;
  /** mit Sammelaktionen erscheint die Auswahlspalte */
  bulkActions?: BulkAction<R>[];
  /** Auswahlspalte auch ohne Sammelaktionen (Auswahl lässt sich exportieren) */
  selectable?: boolean;
  /** Dateiname (ohne .csv); ohne Angabe kein Export */
  exportName?: string;
  defaultSort?: { key: string; dir: 'asc' | 'desc' };
}) {
  const { colors } = useTheme();
  const [sort, setSort] = useState<{ key: string; dir: 'asc' | 'desc' } | null>(
    defaultSort ?? null,
  );
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [active, setActive] = useState(-1);
  const selectable = selectableProp ?? !!bulkActions?.length;

  const sorted = useMemo(() => {
    const col = columns.find((c) => c.key === sort?.key);
    if (!col?.sort || !sort) return rows;
    const out = [...rows].sort(col.sort);
    return sort.dir === 'desc' ? out.reverse() : out;
  }, [rows, columns, sort]);
  const chosen = sorted.filter((r) => selected.has(rowKey(r)));
  const allOn = sorted.length > 0 && chosen.length === sorted.length;

  const toggle = (key: string) =>
    setSelected((cur) => {
      const next = new Set(cur);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  const exportRows = () => {
    const cols = columns.filter((c) => c.csv);
    saveCsv(
      exportName ?? 'export',
      cols.map((c) => t(c.label)),
      (chosen.length ? chosen : sorted).map((r) => cols.map((c) => c.csv!(r))),
    );
  };

  // Tastatur: Pfeile wählen die Zeile, Enter öffnet, Leertaste markiert (nur im Browser)
  const keys =
    Platform.OS === 'web'
      ? ({
          tabIndex: 0,
          onKeyDown: (e: { key: string; preventDefault: () => void }) => {
            if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((i) =>
                Math.max(0, Math.min(sorted.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1))),
              );
            } else if (e.key === 'Enter' && sorted[active]) onRowPress?.(sorted[active]!);
            else if (e.key === ' ' && selectable && sorted[active]) {
              e.preventDefault();
              toggle(rowKey(sorted[active]!));
            }
          },
        } as object)
      : {};

  const sizeOf = (c: Column<R>) =>
    c.width ? { width: c.width } : { flex: c.flex ?? 1, minWidth: 0 };
  const box = (checked: boolean) => (
    <View
      style={{
        width: 20,
        height: 20,
        borderRadius: 5,
        borderWidth: 2,
        borderColor: checked ? colors.primary : colors.border,
        backgroundColor: checked ? colors.primary : 'transparent',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {checked ? <Ionicons name="checkmark" size={14} color={colors.onPrimary} /> : null}
    </View>
  );

  return (
    <View style={{ gap: 10 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <T variant="caption" style={{ flex: 1 }}>
          {selected.size > 0
            ? t(`${chosen.length} von ${sorted.length} ausgewählt`)
            : t(`${sorted.length} Einträge`)}
        </T>
        {chosen.length > 0
          ? bulkActions?.map((a) => (
              <Button
                key={a.label}
                label={a.label}
                icon={a.icon}
                size="sm"
                variant="outline"
                onPress={() => a.onPress(chosen)}
              />
            ))
          : null}
        {exportName && Platform.OS === 'web' ? (
          <Button
            label={chosen.length ? 'Auswahl exportieren' : 'Als CSV exportieren'}
            icon="download-outline"
            size="sm"
            variant="outline"
            onPress={exportRows}
          />
        ) : null}
      </View>
      <Card list style={{ paddingHorizontal: 4 }}>
        <View role="table" {...keys} style={{ outlineStyle: 'none' } as object}>
          <View
            role="row"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingVertical: 10,
              paddingHorizontal: 12,
              borderBottomWidth: 1,
              borderBottomColor: colors.anstoss.divider,
            }}
          >
            {selectable ? (
              <Pressable
                accessibilityRole="checkbox"
                accessibilityLabel={t('Alle auswählen')}
                accessibilityState={{ checked: allOn }}
                onPress={() =>
                  setSelected(allOn ? new Set() : new Set(sorted.map((r) => rowKey(r))))
                }
              >
                {box(allOn)}
              </Pressable>
            ) : null}
            {columns.map((c) => {
              const on = sort?.key === c.key;
              return (
                <Pressable
                  key={c.key}
                  role="columnheader"
                  accessibilityLabel={c.sort ? `${t(c.label)}, ${t('sortieren')}` : t(c.label)}
                  disabled={!c.sort}
                  onPress={() =>
                    setSort(
                      on && sort?.dir === 'asc'
                        ? { key: c.key, dir: 'desc' }
                        : { key: c.key, dir: 'asc' },
                    )
                  }
                  style={[
                    sizeOf(c),
                    { flexDirection: 'row', alignItems: 'center', gap: 4 },
                    c.align === 'right' ? { justifyContent: 'flex-end' } : null,
                  ]}
                >
                  <T variant="overline" color={on ? colors.primaryText : undefined}>
                    {c.label}
                  </T>
                  {on ? (
                    <Ionicons
                      name={sort?.dir === 'asc' ? 'arrow-up' : 'arrow-down'}
                      size={12}
                      color={colors.primaryText}
                    />
                  ) : null}
                </Pressable>
              );
            })}
          </View>
          {sorted.map((r, i) => {
            const key = rowKey(r);
            const isSel = selected.has(key);
            return (
              <Pressable
                key={key}
                role="row"
                onPress={() => {
                  setActive(i);
                  onRowPress?.(r);
                }}
                style={(state) => ({
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                  paddingVertical: 10,
                  paddingHorizontal: 12,
                  borderBottomWidth: i === sorted.length - 1 ? 0 : 1,
                  borderBottomColor: colors.anstoss.divider,
                  borderLeftWidth: 3,
                  borderLeftColor: active === i ? colors.primary : 'transparent',
                  backgroundColor:
                    isSel || webState(state).hovered ? colors.anstoss.overlay : 'transparent',
                })}
              >
                {selectable ? (
                  <Pressable
                    accessibilityRole="checkbox"
                    accessibilityLabel={t('Zeile auswählen')}
                    accessibilityState={{ checked: isSel }}
                    onPress={() => toggle(key)}
                  >
                    {box(isSel)}
                  </Pressable>
                ) : null}
                {columns.map((c) => (
                  <View
                    key={c.key}
                    role="cell"
                    style={[sizeOf(c), c.align === 'right' ? { alignItems: 'flex-end' } : null]}
                  >
                    {c.render(r)}
                  </View>
                ))}
              </Pressable>
            );
          })}
        </View>
      </Card>
    </View>
  );
}

/** Einfacher Text in einer Zelle. */
export function Cell({ children, muted }: { children: ReactNode; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <Text
      numberOfLines={1}
      style={{ fontSize: 13.5, color: muted ? colors.onSurfaceMuted : colors.onSurface }}
      verbatim
    >
      {children}
    </Text>
  );
}
