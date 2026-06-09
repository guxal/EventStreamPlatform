export function unwrapQueryRows<T extends Record<string, unknown>>(result: unknown): T[] {
  if (!Array.isArray(result) || result.length === 0) {
    return [];
  }

  if (Array.isArray(result[0])) {
    return result[0] as T[];
  }

  return result as T[];
}

export function firstQueryRow<T extends Record<string, unknown>>(result: unknown): T {
  const rows = unwrapQueryRows<T>(result);
  const row = rows[0];

  if (!row) {
    throw new Error('Expected a database row but none was returned');
  }

  return row;
}
