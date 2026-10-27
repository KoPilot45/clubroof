import type {
  AccountInfo,
  LoginResponse,
  MeResponse,
  NoClubLoginResponse,
  TwoFactorChallenge,
} from '@clubroof/core';
import { useQueryClient } from '@tanstack/react-query';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { request, RequestError } from './api';
import { deviceLocale, setLocale } from './i18n';
import { disablePush, enablePush, listenForPushTaps } from './push';
import { resetAccountState } from './account-reset';
import { persistOfflineCache, readOfflineMe, restoreOfflineCache } from './offline-cache';
import { readToken, writeToken } from './token-storage';

type SessionState =
  | { status: 'loading'; token: null; me: null }
  | { status: 'signedOut'; token: null; me: null }
  | { status: 'signedIn'; token: string; me: MeResponse }
  /** Konto ohne Verein: angemeldet, aber noch keinem Verein zugeordnet */
  | { status: 'noClub'; token: string; me: null; account: AccountInfo };

type SessionContextValue = SessionState & {
  /** Liefert eine Challenge, wenn ein zweiter Faktor nötig ist */
  signIn: (email: string, password: string) => Promise<TwoFactorChallenge | null>;
  signOut: () => Promise<void>;
  /** Nutzerdaten (`/me`) neu laden, z. B. nach Änderung von Logo oder Rechten */
  refresh: () => Promise<void>;
  /** Sitzung aus einer Antwort übernehmen (Einladung angenommen, 2-Faktor bestätigt) */
  adopt: (result: LoginResponse | NoClubLoginResponse) => Promise<void>;
  /** Aktiven Verein wechseln (Konten mit mehreren Vereinen) */
  switchClub: (clubId: string) => Promise<void>;
  /** Für API-Aufrufe mit dem Token der Sitzung */
  api: <T>(
    path: string,
    options?: { method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'; body?: unknown },
  ) => Promise<T>;
};

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SessionState>({ status: 'loading', token: null, me: null });
  const queryClient = useQueryClient();

  // Beim Start eine gespeicherte Sitzung wiederherstellen
  useEffect(() => {
    let active = true;
    (async () => {
      const token = await readToken();
      if (!token) return active && setState({ status: 'signedOut', token: null, me: null });
      try {
        const me = await request<MeResponse>('/me', { token });
        await restoreOfflineCache(queryClient, me.user.id);
        if (active) setState({ status: 'signedIn', token, me });
      } catch (error) {
        if (error instanceof RequestError && error.code === 'no_club') {
          const account = await request<AccountInfo>('/account', { token }).catch(() => null);
          if (account) {
            if (active) setState({ status: 'noClub', token, me: null, account });
            return;
          }
        }
        if (error instanceof RequestError && error.status === 0) {
          // Start ohne Verbindung: mit den zuletzt gespeicherten Daten öffnen statt abzumelden
          const cached = await readOfflineMe();
          if (cached) {
            await restoreOfflineCache(queryClient, cached.user.id);
            if (active) setState({ status: 'signedIn', token, me: cached });
            return;
          }
        }
        if (error instanceof RequestError && error.status === 401) await writeToken(null);
        if (active) setState({ status: 'signedOut', token: null, me: null });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const result = await request<LoginResponse | NoClubLoginResponse | TwoFactorChallenge>(
        '/auth/login',
        {
          method: 'POST',
          body: { email, password },
        },
      );
      if ('twoFactorRequired' in result) return result;
      // Neues Konto startet immer ohne Daten des vorherigen (Cache, Offline-Speicher, laufende Abfragen)
      await resetAccountState(queryClient, { keepOutbox: true });
      await writeToken(result.token);
      setState(
        result.me
          ? { status: 'signedIn', token: result.token, me: result.me }
          : { status: 'noClub', token: result.token, me: null, account: result.account },
      );
      return null;
    },
    [queryClient],
  );

  // Offline-Lesen: Daten dieses Kontos laufend auf dem Gerät speichern
  const signedInMe = state.status === 'signedIn' ? state.me : null;
  useEffect(() => {
    if (!signedInMe) return;
    return persistOfflineCache(queryClient, signedInMe);
  }, [signedInMe, queryClient]);

  // Sprache: gewählte Sprache des Kontos, sonst die des Geräts
  const chosenLanguage = state.status === 'signedIn' ? state.me.user.language : null;
  useEffect(() => {
    setLocale(chosenLanguage ?? deviceLocale());
  }, [chosenLanguage]);

  // Angemeldet: Gerät erneut für Push anmelden (nur wenn schon erlaubt) und Tipps auswerten
  useEffect(() => {
    if (state.status !== 'signedIn') return;
    const token = state.token;
    void enablePush((path, options) => request(path, { ...options, token }), false).catch(
      () => undefined,
    );
    return listenForPushTaps();
  }, [state.status, state.token]);

  const signOut = useCallback(async () => {
    const token = state.token;
    if (token) await disablePush((path, options) => request(path, { ...options, token }));
    setState({ status: 'signedOut', token: null, me: null });
    await writeToken(null);
    await resetAccountState(queryClient, { keepOutbox: false });
    if (token) await request('/auth/logout', { method: 'POST', token }).catch(() => undefined);
  }, [state.token, queryClient]);

  const api = useCallback<SessionContextValue['api']>(
    async (path, options) => {
      try {
        return await request(path, { ...options, token: state.token });
      } catch (error) {
        if (error instanceof RequestError && error.status === 401) {
          await writeToken(null);
          setState({ status: 'signedOut', token: null, me: null });
          // wie bei der Abmeldung: keine Daten dieses Kontos im Zwischenspeicher lassen
          await resetAccountState(queryClient, { keepOutbox: true });
        }
        throw error;
      }
    },
    [state.token, queryClient],
  );

  const adopt = useCallback(
    async (result: LoginResponse | NoClubLoginResponse) => {
      await resetAccountState(queryClient, { keepOutbox: true });
      await writeToken(result.token);
      setState(
        result.me
          ? { status: 'signedIn', token: result.token, me: result.me }
          : { status: 'noClub', token: result.token, me: null, account: result.account },
      );
    },
    [queryClient],
  );

  const refresh = useCallback(async () => {
    if (!state.token) return;
    const token = state.token;
    try {
      const me = await request<MeResponse>('/me', { token });
      setState({ status: 'signedIn', token, me });
    } catch (error) {
      if (error instanceof RequestError && error.code === 'no_club') {
        const account = await request<AccountInfo>('/account', { token });
        setState({ status: 'noClub', token, me: null, account });
        return;
      }
      throw error;
    }
  }, [state.token]);

  // Vereinswechsel: die Daten des bisherigen Vereins dürfen nirgends stehen bleiben (Cache, Offline-Speicher)
  const switchClub = useCallback(
    async (clubId: string) => {
      if (state.status !== 'signedIn') return;
      const me = await request<MeResponse>('/me/club', {
        method: 'POST',
        token: state.token,
        body: { clubId },
      });
      await resetAccountState(queryClient, { keepOutbox: false });
      setState({ status: 'signedIn', token: state.token, me });
    },
    [state, queryClient],
  );

  const value = useMemo(
    () => ({ ...state, signIn, signOut, api, refresh, adopt, switchClub }),
    [state, signIn, signOut, api, refresh, adopt, switchClub],
  );
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) throw new Error('useSession muss innerhalb von SessionProvider verwendet werden.');
  return ctx;
}

/** Angemeldete Sitzung – nur in geschützten Bereichen verwenden. */
export function useSignedIn() {
  const session = useSession();
  if (session.status !== 'signedIn') throw new Error('Nicht angemeldet.');
  return session;
}
