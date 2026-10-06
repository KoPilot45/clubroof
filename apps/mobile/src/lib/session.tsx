import type { LoginResponse, MeResponse, TwoFactorChallenge } from '@clubroof/core';
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
import { disablePush, enablePush, listenForPushTaps } from './push';
import { readToken, writeToken } from './token-storage';

type SessionState =
  | { status: 'loading'; token: null; me: null }
  | { status: 'signedOut'; token: null; me: null }
  | { status: 'signedIn'; token: string; me: MeResponse };

type SessionContextValue = SessionState & {
  /** Liefert eine Challenge, wenn ein zweiter Faktor nötig ist */
  signIn: (email: string, password: string) => Promise<string | null>;
  signOut: () => Promise<void>;
  /** Nutzerdaten (`/me`) neu laden, z. B. nach Änderung von Logo oder Rechten */
  refresh: () => Promise<void>;
  /** Sitzung aus einer Antwort übernehmen (Einladung angenommen, 2-Faktor bestätigt) */
  adopt: (result: LoginResponse) => Promise<void>;
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
        if (active) setState({ status: 'signedIn', token, me });
      } catch (error) {
        if (error instanceof RequestError && error.status === 401) await writeToken(null);
        if (active) setState({ status: 'signedOut', token: null, me: null });
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const result = await request<LoginResponse | TwoFactorChallenge>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    if ('twoFactorRequired' in result) return result.challenge;
    await writeToken(result.token);
    setState({ status: 'signedIn', token: result.token, me: result.me });
    return null;
  }, []);

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
    queryClient.clear();
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
        }
        throw error;
      }
    },
    [state.token],
  );

  const adopt = useCallback(async (result: LoginResponse) => {
    await writeToken(result.token);
    setState({ status: 'signedIn', token: result.token, me: result.me });
  }, []);

  const refresh = useCallback(async () => {
    if (!state.token) return;
    const me = await request<MeResponse>('/me', { token: state.token });
    setState({ status: 'signedIn', token: state.token, me });
  }, [state.token]);

  const value = useMemo(
    () => ({ ...state, signIn, signOut, api, refresh, adopt }),
    [state, signIn, signOut, api, refresh, adopt],
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
