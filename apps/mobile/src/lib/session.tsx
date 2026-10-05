import type { LoginResponse, MeResponse } from '@clubroof/core';
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
import { readToken, writeToken } from './token-storage';

type SessionState =
  | { status: 'loading'; token: null; me: null }
  | { status: 'signedOut'; token: null; me: null }
  | { status: 'signedIn'; token: string; me: MeResponse };

type SessionContextValue = SessionState & {
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  /** Für API-Aufrufe mit dem Token der Sitzung */
  api: <T>(
    path: string,
    options?: { method?: 'GET' | 'POST' | 'PUT' | 'DELETE'; body?: unknown },
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
    const result = await request<LoginResponse>('/auth/login', {
      method: 'POST',
      body: { email, password },
    });
    await writeToken(result.token);
    setState({ status: 'signedIn', token: result.token, me: result.me });
  }, []);

  const signOut = useCallback(async () => {
    const token = state.token;
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

  const value = useMemo(() => ({ ...state, signIn, signOut, api }), [state, signIn, signOut, api]);
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
