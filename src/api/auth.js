const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');
const baseUrl = `${appBase}/api/auth`;

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || '认证请求失败');
  return payload;
}

export function getAuthStatus() {
  return request('/status');
}

export function loginUser(data) {
  return request('/login', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function registerUser(data) {
  return request('/register', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function logoutUser() {
  return request('/logout', { method: 'POST' });
}
