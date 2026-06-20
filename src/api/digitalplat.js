const baseUrl = '/api/digitalplat';
const apiKeyStorageKey = 'digitalplat_api_key';

export function getStoredApiKey() {
  return window.localStorage.getItem(apiKeyStorageKey) || '';
}

export function setStoredApiKey(value) {
  const apiKey = value.trim();
  if (apiKey) window.localStorage.setItem(apiKeyStorageKey, apiKey);
  else window.localStorage.removeItem(apiKeyStorageKey);
}

async function request(path, options = {}) {
  const apiKey = getStoredApiKey();
  const response = await fetch(`${baseUrl}${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(apiKey ? { 'X-DigitalPlat-Api-Key': apiKey } : {}),
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
  return Promise.resolve({ success: true, data: { apiConfigured: Boolean(getStoredApiKey()) }, meta: {} });
}
