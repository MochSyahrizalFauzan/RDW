// sistem_penempatan_barang/lib/api.ts
/* eslint-disable @typescript-eslint/no-explicit-any */

import { toast } from "sonner";

const API_URL = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:5000";

export type ApiFetchOptions = RequestInit & {
  silent401?: boolean;

  /**
   * kalau true:
   * - JANGAN auto-redirect ke /login saat 401
   * - tapi tetap throw error (biar bisa ditangkap di catch)
   */
  noRedirect401?: boolean;
};


function isFormData(body: any) {
  return typeof FormData !== "undefined" && body instanceof FormData;
}

function shouldSetJsonContentType(body: any) {
  return body != null && typeof body === "string";
}

function clearAuthStorage() {
  try {
    localStorage.removeItem("user");
    localStorage.removeItem("full_name");
    localStorage.removeItem("role");
    localStorage.removeItem("user_id");
    localStorage.removeItem("username");
  } catch {
    // ignore
  }
}

async function readJsonSafe(res: Response) {
  try {
    return await res.json();
  } catch {
    return {};
  }
}

async function getServerCookieHeader(): Promise<string> {
  const { cookies } = await import("next/headers");
  const all = cookies().getAll();
  if (!all.length) return "";
  return all.map((c) => `${c.name}=${c.value}`).join("; ");
}

function notifyErrorSafe(title: string, description?: string) {
  if (typeof window === "undefined") return;
  toast.error(title, { description, duration: 4000 });
}

function injectClientAuthHeaders(headers: Record<string, string>) {
  if (typeof window === "undefined") return;

  try {
    const role = localStorage.getItem("role");
    const userId = localStorage.getItem("user_id");

    // middleware requireRole.js kamu butuh ini
    if (role) headers["x-user-role"] = role;
    if (userId) headers["x-user-id"] = userId;
  } catch {
    // ignore
  }
}

export async function apiFetch<T = any>(
  path: string,
  options: ApiFetchOptions = {}
): Promise<T> {
  const { silent401, ...fetchOptions } = options;
  const isServer = typeof window === "undefined";

  const cookieHeader = isServer ? await getServerCookieHeader() : "";
  const body = (fetchOptions as any).body;

  const headers: Record<string, string> = {
    ...(fetchOptions.headers as Record<string, string> | undefined),
  };

  if (!headers["Content-Type"] && shouldSetJsonContentType(body) && !isFormData(body)) {
    headers["Content-Type"] = "application/json";
  }

  if (cookieHeader) {
    headers["cookie"] = cookieHeader;
  }

  // ✅ inject header role/user_id dari localStorage untuk backend middleware
  injectClientAuthHeaders(headers);

  const res = await fetch(`${API_URL}${path}`, {
    ...fetchOptions,
    headers,
    credentials: "include",
    cache: "no-store",
  });

// ===== 401 HANDLING =====
if (res.status === 401) {
  const data = await readJsonSafe(res);
  const msg = (data && (data.message || data.error)) || "Unauthorized";

  if (silent401) return null as any;

  if (!isServer) {
    // ✅ kalau noRedirect401 aktif, jangan redirect. lempar error saja.
    if (options.noRedirect401) {
      throw new Error(msg);
    }

    clearAuthStorage();
    window.location.href = "/login";
    return null as any;
  }

  throw new Error(msg);
}


  const data = await readJsonSafe(res);

  // ===== AUTO ERROR TOAST =====
  if (!res.ok) {
    const msg = (data && (data.message || data.error)) || `Request failed (${res.status})`;

    if (!isServer && !silent401) {
      notifyErrorSafe("Terjadi kesalahan", msg);
    }

    throw new Error(msg);
  }

  return data as T;
}

export function apiGet<T = any>(path: string, options: ApiFetchOptions = {}) {
  return apiFetch<T>(path, { ...options, method: "GET" });
}

export function apiPost<T = any>(path: string, body?: any, options: ApiFetchOptions = {}) {
  return apiFetch<T>(path, {
    ...options,
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiPatch<T = any>(path: string, body?: any, options: ApiFetchOptions = {}) {
  return apiFetch<T>(path, {
    ...options,
    method: "PATCH",
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

export function apiDelete<T = any>(path: string, options: ApiFetchOptions = {}) {
  return apiFetch<T>(path, { ...options, method: "DELETE" });
}
