const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001';

async function request(path, options = {}) {
  const token = localStorage.getItem('konekta_token');
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.error || `API request failed (${response.status})`);
  }
  return payload.data;
}

export function login(email, password) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
}

export function registerAccount(data) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function getCurrentUser() {
  const raw = localStorage.getItem('konekta_user');
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    localStorage.removeItem('konekta_user');
    localStorage.removeItem('konekta_token');
    return null;
  }
}

export function logout() {
  localStorage.removeItem('konekta_token');
  localStorage.removeItem('konekta_user');
}

export function listRequests() {
  return request('/api/requests');
}

export function getDashboardStats() {
  return request('/api/dashboard/stats');
}

export function updateMyProfile(data) {
  return request('/api/users/me', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
}

export function changeMyPassword(currentPassword, newPassword) {
  return request('/api/users/me/password', {
    method: 'PATCH',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
}

export function createRequest(data) {
  return request('/api/requests', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function verifyRequest(id) {
  return request(`/api/requests/${id}/verify`, { method: 'PATCH' });
}

export function updateRequestStatus(id, status) {
  return request(`/api/requests/${id}/status`, {
    method: 'PATCH',
    body: JSON.stringify({ status }),
  });
}

export function createDonor(data) {
  return request('/api/donors', {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export function findDonors(bloodType, municipality = '') {
  const query = new URLSearchParams({ bloodType });
  if (municipality) query.set('municipality', municipality);
  return request(`/api/donors/matches?${query.toString()}`);
}

export function listAdminUsers() {
  return request('/api/admin/users');
}

export function normalizeRequest(row) {
  return {
    apiId: row.id,
    id: row.public_id || `KR-${String(row.id).padStart(4, '0')}`,
    patient: row.patient_name,
    blood: row.blood_type,
    location: row.hospital_name,
    urgency: row.urgency,
    status: row.status,
    time: row.created_at ? new Date(row.created_at).toLocaleString() : 'Agora',
    donors: row.match_count || 0,
  };
}
