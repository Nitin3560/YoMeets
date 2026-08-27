export type JsonObject = Record<string, unknown>;

export type IntegrationResult = {
  provider: "github" | "google_calendar" | "gmail" | "memory";
  externalId: string;
  url?: string;
  raw: unknown;
};

export type AuthConfig = {
  token: string;
};

export function requireEnv(name: string) {
  const value = process.env[name];

  if (!value) {
    throw new Error(`${name} is required`);
  }

  return value;
}

export async function postJson<T>(url: string, headers: Record<string, string>, body: JsonObject): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    method: "POST"
  });

  if (!response.ok) {
    throw new Error(`POST ${url} failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}

export async function patchJson<T>(url: string, headers: Record<string, string>, body: JsonObject): Promise<T> {
  const response = await fetch(url, {
    body: JSON.stringify(body),
    headers: {
      "Content-Type": "application/json",
      ...headers
    },
    method: "PATCH"
  });

  if (!response.ok) {
    throw new Error(`PATCH ${url} failed with ${response.status}: ${await response.text()}`);
  }

  return response.json() as Promise<T>;
}
