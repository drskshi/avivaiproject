/**
 * Thin fetch wrapper for the Express API.
 */
const API = {
  base: '/api',

  getToken() {
    return localStorage.getItem('token');
  },

  headers(json = true) {
    const h = {};
    if (json) h['Content-Type'] = 'application/json';
    const token = this.getToken();
    if (token) h.Authorization = `Bearer ${token}`;
    return h;
  },

  async request(path, options = {}) {
    const res = await fetch(`${this.base}${path}`, {
      ...options,
      headers: { ...this.headers(!(options.body instanceof FormData)), ...options.headers },
    });
    let data = null;
    try {
      data = await res.json();
    } catch {
      data = { success: false, message: 'Invalid server response.' };
    }
    if (!res.ok) {
      const err = new Error(data.message || `Request failed (${res.status})`);
      err.status = res.status;
      err.data = data;
      throw err;
    }
    return data;
  },

  get(path) {
    return this.request(path);
  },

  post(path, body) {
    return this.request(path, { method: 'POST', body: JSON.stringify(body) });
  },

  patch(path, body) {
    return this.request(path, { method: 'PATCH', body: JSON.stringify(body) });
  },

  delete(path) {
    return this.request(path, { method: 'DELETE' });
  },
};

window.API = API;
