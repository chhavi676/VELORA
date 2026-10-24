import { supabase } from "../lib/supabase.js";

const API_BASE = (import.meta.env.VITE_API_URL || "http://localhost:5000").replace(/\/$/, "").replace(/\/api$/, "");

async function request(path, { method = "GET", body, auth = false } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    // getSession() returns a refreshed token when the old one is about to expire.
    const { data } = (await supabase?.auth.getSession()) || {};
    const token = data?.session?.access_token;
    if (!token) throw new Error("Please sign in to continue.");
    headers.Authorization = `Bearer ${token}`;
  }
  let response;
  try {
    response = await fetch(`${API_BASE}/api${path}`, { method, headers, body: body === undefined ? undefined : JSON.stringify(body) });
  } catch {
    throw new Error("Cannot reach the VÉLORA server. Make sure the API is running (npm run dev) and try again.");
  }
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(payload.error || `Request failed (${response.status}).`);
    error.status = response.status;
    throw error;
  }
  return payload;
}

// Public
export const getHealth = () => request("/health");
export const getProducts = () => request("/products");
export const getProduct = (slugOrId) => request(`/products/${encodeURIComponent(slugOrId)}`);
export const getShows = () => request("/shows");
export const getModels = () => request("/models");

// Signed-in customer
export const createOrder = (payload) => request("/orders", { method: "POST", body: payload, auth: true });
export const getMyOrders = () => request("/orders/mine", { auth: true });
export const cancelMyOrder = (id) => request(`/orders/${id}/cancel`, { method: "PATCH", auth: true });

// Designer / admin
export const getManagedProducts = () => request("/products/manage/list", { auth: true });
export const createProduct = (body) => request("/products", { method: "POST", body, auth: true });
export const updateProduct = (id, body) => request(`/products/${id}`, { method: "PATCH", body, auth: true });

// Admin
export const getAdminSummary = () => request("/admin/summary", { auth: true });
export const getAdminUsers = () => request("/admin/users", { auth: true });
export const getAllOrders = () => request("/orders", { auth: true });
export const setOrderStatus = (id, status) => request(`/orders/${id}/status`, { method: "PATCH", body: { status }, auth: true });
export const setUserRole = (profileId, role) => request(`/auth/profiles/${profileId}/role`, { method: "PATCH", body: { role }, auth: true });
