export interface JsonResponse<T> {
  status: number;
  body: T;
}

export async function jsonRequest<T>(
  input: string,
  init?: RequestInit
): Promise<JsonResponse<T>> {
  const response = await fetch(input, {
    ...init,
    headers: {
      "content-type": "application/json",
      ...(init?.headers ?? {})
    }
  });

  const text = await response.text();
  const body = text ? (JSON.parse(text) as T) : (null as T);

  return {
    status: response.status,
    body
  };
}

export function assertStatus(actual: number, expected: number, context: string): void {
  if (actual !== expected) {
    throw new Error(`${context}: expected status ${expected}, received ${actual}`);
  }
}

export function assert(condition: unknown, message: string): asserts condition {
  if (!condition) {
    throw new Error(message);
  }
}
