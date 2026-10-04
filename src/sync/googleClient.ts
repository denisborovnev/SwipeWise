import type { GoogleAuth } from '@/auth/google';

export class GoogleApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'GoogleApiError';
  }
}

export type GoogleRequest = <T>(url: string, init?: { method?: string; body?: unknown }) => Promise<T>;

/**
 * JSON requests to Google APIs with the user's access token. A 401 (expired token) is retried once
 * with a fresh token.
 */
export function createGoogleClient(auth: GoogleAuth, fetchFn: typeof fetch = fetch): GoogleRequest {
  const send = async (url: string, token: string, init: { method?: string; body?: unknown }) =>
    fetchFn(url, {
      method: init.method ?? 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
        ...(init.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
      },
      body: init.body !== undefined ? JSON.stringify(init.body) : undefined,
    });

  return async function request<T>(url: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
    let token = await auth.getAccessToken();
    let res = await send(url, token, init);
    if (res.status === 401) {
      await auth.invalidate(token);
      token = await auth.getAccessToken();
      res = await send(url, token, init);
    }
    if (!res.ok) {
      let message = `Google request failed (${res.status})`;
      try {
        const body = (await res.json()) as { error?: { message?: string } };
        message = body.error?.message ?? message;
      } catch {
        // Not JSON – keep the generic message.
      }
      throw new GoogleApiError(res.status, message);
    }
    return (res.status === 204 ? undefined : await res.json()) as T;
  };
}
