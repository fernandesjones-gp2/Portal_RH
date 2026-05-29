// Cliente de API para as telas ('use client'). Substitui as chamadas diretas
// ao supabase por fetch nas Route Handlers internas.

async function req(url, options = {}) {
  const res = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    let body;
    try {
      body = await res.json();
    } catch {
      body = { error: res.statusText };
    }
    const err = new Error(body.error || 'request_failed');
    err.status = res.status;
    err.body = body;
    throw err;
  }
  if (res.status === 204) return null;
  return res.json();
}

function crud(base) {
  return {
    list: () => req(base),
    create: (name) => req(base, { method: 'POST', body: JSON.stringify({ name }) }),
    update: (id, name) => req(`${base}/${id}`, { method: 'PATCH', body: JSON.stringify({ name }) }),
    remove: (id) => req(`${base}/${id}`, { method: 'DELETE' }),
  };
}

export const api = {
  me: () => req('/api/users/me'),

  users: {
    list: () => req('/api/users'),
    update: (id, data) => req(`/api/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    remove: (id) => req(`/api/users/${id}`, { method: 'DELETE' }),
  },

  units: crud('/api/units'),
  jobRoles: crud('/api/job-roles'),
  cancellationReasons: crud('/api/cancellation-reasons'),

  rolePermissions: {
    list: (role) =>
      req(`/api/role-permissions${role ? `?role=${encodeURIComponent(role)}` : ''}`),
    add: (role, menu_path) =>
      req('/api/role-permissions', { method: 'POST', body: JSON.stringify({ role, menu_path }) }),
    remove: (role, menu_path) =>
      req('/api/role-permissions', { method: 'DELETE', body: JSON.stringify({ role, menu_path }) }),
  },

  candidates: {
    // params: { status } | { statusIn: 'a,b,c' } + { orderBy, order }
    list: (params = {}) => req(`/api/candidates?${new URLSearchParams(params).toString()}`),
    create: (data) => req('/api/candidates', { method: 'POST', body: JSON.stringify(data) }),
    update: (id, data) => req(`/api/candidates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  },
};
