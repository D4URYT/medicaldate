const AUTH_API = import.meta.env.VITE_AUTH_API || "http://localhost:8001";
const USERS_API = import.meta.env.VITE_USERS_API || "http://localhost:8002";
const APPOINTMENTS_API = import.meta.env.VITE_APPOINTMENTS_API || "http://localhost:8003";

export async function apiRequest(base, path, method = "GET", body, token) {
  const response = await fetch(`${base}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data.detail || "Request failed");
  }
  return data;
}

export const api = {
  auth: {
    register: (payload) => apiRequest(AUTH_API, "/register", "POST", payload),
    login: (payload) => apiRequest(AUTH_API, "/login", "POST", payload),
    verify: (token) => apiRequest(AUTH_API, "/verify", "GET", null, token),
    changePassword: (payload, token) => apiRequest(AUTH_API, "/change-password", "PATCH", payload, token),
  },
  users: {
    me: (token) => apiRequest(USERS_API, "/me", "GET", null, token),
    updateMe: (payload, token) => apiRequest(USERS_API, "/me", "PUT", payload, token),
    listUsers: (token) => apiRequest(USERS_API, "/users", "GET", null, token),
    getAdminUser: (id, token) => apiRequest(USERS_API, `/admin/users/${id}`, "GET", null, token),
    updateAdminUser: (id, payload, token) => apiRequest(USERS_API, `/admin/users/${id}`, "PATCH", payload, token),
  },
  appointments: {
    listServices: () => apiRequest(APPOINTMENTS_API, "/services"),
    createService: (payload, token) => apiRequest(APPOINTMENTS_API, "/services", "POST", payload, token),
    createAvailability: (payload, token) => apiRequest(APPOINTMENTS_API, "/availability", "POST", payload, token),
    createAppointment: (payload, token) => apiRequest(APPOINTMENTS_API, "/appointments", "POST", payload, token),
    myAppointments: (token) => apiRequest(APPOINTMENTS_API, "/appointments", "GET", null, token),
    updateStatus: (id, payload, token) => apiRequest(APPOINTMENTS_API, `/appointments/${id}/status`, "PATCH", payload, token),
    cancel: (id, token) => apiRequest(APPOINTMENTS_API, `/appointments/${id}/cancel`, "PATCH", null, token),
  },
};