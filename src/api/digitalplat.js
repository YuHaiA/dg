const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');
const baseUrl = `${appBase}/api/digitalplat`;
const configBaseUrl = `${appBase}/api/config`;

export function getStoredApiKey() {
  return '';
}

export async function setStoredApiKey(value) {
  return configRequest('/digitalplat', {
    method: 'POST',
    body: JSON.stringify({ apiKey: value.trim() })
  });
}

async function request(path, options = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) {
    const message = payload?.message || payload?.error || `Request failed (${response.status})`;
    throw new Error(message);
  }

  return payload;
}

async function configRequest(path, options = {}) {
  const response = await fetch(`${configBaseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || '配置保存失败');
  return payload;
}

function normalizeDomain(item) {
  return {
    ...item,
    name: item.name || item.domain,
    expiry_date: item.expiry_date || item.expires_at
  };
}

export async function listDomains() {
  const result = await request('/domains');
  return {
    ...result,
    data: Array.isArray(result?.data) ? result.data.map(normalizeDomain) : []
  };
}

export function registerDomain(data) {
  return request('/domains', {
    method: 'POST',
    body: JSON.stringify(data)
  });
}

export function updateNameservers(domain, nameservers) {
  return request(`/domains/${encodeURIComponent(domain)}/nameservers`, {
    method: 'PATCH',
    body: JSON.stringify({ nameservers })
  });
}

export function deleteDomain(domain) {
  return request(`/domains/${encodeURIComponent(domain)}`, {
    method: 'DELETE'
  });
}

export function getApiStatus() {
  return request('/status');
}
