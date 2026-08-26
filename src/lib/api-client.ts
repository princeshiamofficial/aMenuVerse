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

function getAuthHeaders(): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: "application/json",
  };
  if (typeof document !== "undefined") {
    let token = "";
    // 1. Try parsing menuverse_session from document.cookie
    try {
      const match = document.cookie.match(/menuverse_session=([^;]+)/);
      if (match && match[1] && match[1] !== "logged_out") {
        token = decodeURIComponent(match[1].trim());
      }
    } catch {
      /* ignore */
    }

    // 2. Fallback to localStorage
    if (!token && typeof localStorage !== "undefined") {
      const lsToken =
        localStorage.getItem("menuverse_session") ||
        localStorage.getItem("session_token") ||
        localStorage.getItem("token");
      if (lsToken && lsToken !== "logged_out") {
        token = lsToken.trim();
      }
    }

    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
      headers["x-session-token"] = token;
    }
  }
  return headers;
}

export async function apiGet<T = unknown>(url: string): Promise<T> {
  const res = await fetch(url, {
    method: "GET",
    headers: getAuthHeaders(),
    credentials: "include",
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
  const headers = getAuthHeaders();
  headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: "POST",
    headers,
    credentials: "include",
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
  const headers = getAuthHeaders();
  headers["Content-Type"] = "application/json";

  const res = await fetch(url, {
    method: "PUT",
    headers,
    credentials: "include",
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
    headers: getAuthHeaders(),
    credentials: "include",
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
