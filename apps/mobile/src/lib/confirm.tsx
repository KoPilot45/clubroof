import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { Dialog } from '@/components/ui';
import { t } from '@/lib/i18n';

/**
 * Löschen fragt immer nach (Stil „Anstoß“, Vorlage U15): „Wirklich löschen?“ mit dem Namen des Eintrags.
 * Der Text sagt, was wirklich geschieht: Archivierbare Einträge (`archive`) wandern ins Archiv, alle anderen werden endgültig gelöscht.
 */
export type DeleteRequest = {
  /** Name des Eintrags, wie ihn die Person kennt */
  name: string;
  /** eigener Text statt der Standardmeldung (z. B. mit Folgen für Verknüpfungen) */
  text?: string;
  /** Beschriftung des roten Knopfs, Standard „Löschen“ */
  confirmLabel?: string;
  /** Überschrift, Standard „Wirklich löschen?“ */
  title?: string;
  /** Der Eintrag wandert ins Archiv (Paket AR): anderer Standardtext, Überschrift und Knopf */
  archive?: boolean;
  onConfirm: () => void | Promise<unknown>;
};

const ConfirmContext = createContext<(request: DeleteRequest) => void>(() => undefined);

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [request, setRequest] = useState<DeleteRequest | null>(null);
  const [busy, setBusy] = useState(false);
  const ask = useCallback((r: DeleteRequest) => setRequest(r), []);
  const value = useMemo(() => ask, [ask]);
  const close = () => {
    if (!busy) setRequest(null);
  };
  return (
    <ConfirmContext.Provider value={value}>
      {children}
      <Dialog
        visible={!!request}
        onClose={close}
        title={
          request?.title ??
          (request?.archive ? t('Ins Archiv verschieben?') : t('Wirklich löschen?'))
        }
        text={
          request?.text ??
          (request
            ? request.archive
              ? t(
                  `„${request.name}“ wird ins Archiv verschoben und lässt sich dort wiederherstellen.`,
                )
              : t(`„${request.name}“ wird gelöscht. Das lässt sich nicht rückgängig machen.`)
            : '')
        }
        confirmLabel={request?.confirmLabel ?? (request?.archive ? t('Archivieren') : t('Löschen'))}
        loading={busy}
        onConfirm={() => {
          if (!request) return;
          setBusy(true);
          void Promise.resolve(request.onConfirm())
            .catch(() => undefined)
            .finally(() => {
              setBusy(false);
              setRequest(null);
            });
        }}
      />
    </ConfirmContext.Provider>
  );
}

/** `const confirmDelete = useConfirmDelete(); confirmDelete({ name, onConfirm: () => del.mutate() })` */
export const useConfirmDelete = () => useContext(ConfirmContext);
