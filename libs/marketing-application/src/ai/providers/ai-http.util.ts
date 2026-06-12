import axios, { AxiosError } from 'axios';

export async function postProviderJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ status: number; data: T }> {
  const timeout = Number(process.env.AI_TIMEOUT_MS ?? 30_000);
  const maxRetries = Number(process.env.AI_MAX_RETRIES ?? 2);
  let lastError: unknown;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    try {
      const response = await axios.post<T>(url, body, {
        headers,
        timeout,
        validateStatus: () => true,
      });

      if (!isRetryableStatus(response.status) || attempt === maxRetries) {
        return { status: response.status, data: response.data };
      }
      lastError = new Error(`Retryable AI provider status ${response.status}`);
    } catch (error) {
      lastError = error;
      if (!isRetryableError(error) || attempt === maxRetries) throw error;
    }
    await sleep(backoffMs(attempt));
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 429 || status >= 500;
}

function isRetryableError(error: unknown): boolean {
  if (!axios.isAxiosError(error)) return false;
  const axiosError = error as AxiosError;
  return !axiosError.response || isRetryableStatus(axiosError.response.status);
}

function backoffMs(attempt: number): number {
  return Math.min(250 * 2 ** attempt, 2_000);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
