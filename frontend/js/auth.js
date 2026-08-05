/**
 * Client-side auth state helpers.
 */
const Auth = {
  getUser() {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch {
      return null;
    }
  },

  setSession(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
  },

  clear() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  },

  isLoggedIn() {
    return !!localStorage.getItem('token');
  },

  isAdmin() {
    const u = this.getUser();
    return u && u.role === 'admin';
  },

  isGuest() {
    const u = this.getUser();
    return u && u.isGuest;
  },

  requireAuth(redirectTo = '/pages/auth.html') {
    if (!this.isLoggedIn()) {
      window.location.href = `${redirectTo}?next=${encodeURIComponent(window.location.pathname)}`;
      return false;
    }
    return true;
  },
};

window.Auth = Auth;
