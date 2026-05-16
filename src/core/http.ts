import { ProviderError } from './AppError';

export interface HttpRequestOptions {
  method?: string;
  headers?: Record<string, string>;
  body?: BodyInit;
  timeoutMs: number;
}

export interface PagedResponse<T> {
  items: T[];
  hasMore: boolean;
  nextPage?: number;
}

export async function fetchJson<T>(
  provider: string,
  url: string,
  options: HttpRequestOptions
): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs);

  try {
    const response = await fetch(url, {
      method: options.method ?? 'GET',
      headers: {
        accept: 'application/json',
        ...options.headers
      },
      body: options.body,
      signal: controller.signal
    });

    if (!response.ok) {
      throw new ProviderError(
        readableHttpError(provider, response.status),
        response.status,
        provider
      );
    }

    const text = await response.text();
    return parseResponsePayload<T>(provider, text);
  } catch (error) {
    if (error instanceof ProviderError) {
      throw error;
    }
    if (error instanceof Error && error.name === 'AbortError') {
      throw new ProviderError(`${provider} request timed out.`, undefined, provider);
    }
    throw new ProviderError(
      `${provider} request failed: ${error instanceof Error ? error.message : String(error)}`,
      undefined,
      provider
    );
  } finally {
    clearTimeout(timeout);
  }
}

export function parseResponsePayload<T>(provider: string, text: string): T {
  const payload = text.trim().replace(/^\uFEFF/, '');
  if (!payload) {
    return undefined as T;
  }

  try {
    return JSON.parse(payload) as T;
  } catch {
    // Some DevOps endpoints return a JavaScript object literal with data:(function(){...})
    // instead of strict JSON. Treat it as a trusted same-origin API response.
    try {
      return Function(`"use strict"; return (${payload});`)() as T;
    } catch (error) {
      const snippet = payload.slice(0, 120).replace(/\s+/g, ' ');
      throw new ProviderError(
        `${provider} returned a response that could not be parsed: ${snippet}`,
        undefined,
        provider
      );
    }
  }
}

export function readableHttpError(provider: string, status: number): string {
  switch (status) {
    case 400:
      return `${provider} rejected the request. Check URL and query settings.`;
    case 401:
      return `${provider} authentication failed. Check the stored credentials.`;
    case 403:
      return `${provider} access was denied. Check account permissions.`;
    case 404:
      return `${provider} endpoint was not found. Check the base URL.`;
    case 429:
      return `${provider} rate limit exceeded. Try again later.`;
    default:
      if (status >= 500) {
        return `${provider} is currently returning server errors.`;
      }
      return `${provider} request failed with HTTP ${status}.`;
  }
}
