import { translate, type ApiError } from '@clubroof/core';
import { getLocale } from './i18n';

/** Adresse des Backends, z. B. aus `.env` (EXPO_PUBLIC_API_URL). */
export const API_URL = (process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3000').replace(
  /\/$/,
  '',
);

export class RequestError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    // Fehlertexte kommen deutsch vom Server und werden in der gewählten Sprache angezeigt
    super(translate(message, getLocale()));
  }
}

type Options = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
};

export async function request<T>(
  path: string,
  { method = 'GET', body, token }: Options = {},
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'content-type': 'application/json' } : {}),
        ...(token ? { authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new RequestError(
      0,
      'offline',
      'Keine Verbindung zum Server. Bitte prüfe deine Internetverbindung.',
    );
  }

  if (response.status === 204) return undefined as T;
  const data = (await response.json().catch(() => null)) as (T & Partial<ApiError>) | null;
  if (!response.ok) {
    throw new RequestError(
      response.status,
      data?.error ?? 'unknown',
      data?.message ?? 'Es ist ein unerwarteter Fehler aufgetreten.',
    );
  }
  return data as T;
}
