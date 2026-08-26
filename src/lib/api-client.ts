/**
 * Universal Lightweight REST API Client for aMenuVerse (erpapp-style)
 * Standard HTTP fetch wrapper with automatic JSON parsing and typed error handling.
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  message?: string;
  error?: string;
  count?: number;
}

export class ApiError extends Error {
  status: number;
  data?: unknown;

  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.data = data;
  }
}

export async function apiGet<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Accept: "application/json",
    },
  });

  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!res.ok || json.success === false) {
    throw new ApiError(
      json.error || json.message || `GET ${url} failed with status ${res.status}`,
      res.status,
      json,
    );
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export async function apiPost<T = unknown, B = unknown>(url: string, body?: B): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!res.ok || json.success === false) {
    throw new ApiError(
      json.error || json.message || `POST ${url} failed with status ${res.status}`,
      res.status,
      json,
    );
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export async function apiPut<T = unknown, B = unknown>(url: string, body?: B): Promise<T> {
  const res = await fetch(url, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!res.ok || json.success === false) {
    throw new ApiError(
      json.error || json.message || `PUT ${url} failed with status ${res.status}`,
      res.status,
      json,
    );
  }

  return (json.data !== undefined ? json.data : json) as T;
}

export async function apiDelete<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "DELETE",
    headers: {
      Accept: "application/json",
    },
  });

  const json = (await res.json().catch(() => ({}))) as ApiResponse<T>;

  if (!res.ok || json.success === false) {
    throw new ApiError(
      json.error || json.message || `DELETE ${url} failed with status ${res.status}`,
      res.status,
      json,
    );
  }

  return (json.data !== undefined ? json.data : json) as T;
}
