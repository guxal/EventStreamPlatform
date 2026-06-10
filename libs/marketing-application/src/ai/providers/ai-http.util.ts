import axios from 'axios';

export async function postProviderJson<T>(
  url: string,
  headers: Record<string, string>,
  body: unknown,
): Promise<{ status: number; data: T }> {
  const response = await axios.post<T>(url, body, {
    headers,
    validateStatus: () => true,
  });

  return { status: response.status, data: response.data };
}
