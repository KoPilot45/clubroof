import { Redirect } from 'expo-router';
import { useEffect } from 'react';
import { t } from '@/lib/i18n';
import { useToast } from '@/lib/toast';

/** Seitenwächter: ohne Recht zurück zu Mehr mit kurzem Hinweis, statt einer leeren Seite mit Fehlermeldung. */
export function NoAccessRedirect({ area }: { area: 'admin' | 'cash' }) {
  const toast = useToast();
  useEffect(() => {
    toast({
      message: t(
        area === 'admin'
          ? 'Dafür fehlt dir die Berechtigung (Verwaltung).'
          : 'Dafür fehlt dir die Berechtigung (Vereinskasse).',
      ),
    });
  }, [toast, area]);
  return <Redirect href="/mehr" />;
}
