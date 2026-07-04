let cfConfigCache = {
  accounts: [],
  activeId: '',
  domainAccounts: {}
};

const appBase = import.meta.env.BASE_URL.replace(/\/$/, '');

async function configRequest(path, options = {}) {
  const response = await fetch(`${appBase}/api/config${path}`, {
    ...options,
    headers: {
      ...(options.headers || {}),
      ...(options.body ? { 'Content-Type': 'application/json' } : {})
    }
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || '配置请求失败');
  return payload;
}

function normalizeConfig(data = {}) {
  cfConfigCache = {
    accounts: data.accounts || [],
    activeId: data.activeId || '',
    domainAccounts: data.domainAccounts || {}
  };
  return cfConfigCache;
}

export async function loadCfConfig() {
  const result = await configRequest('/status');
  return normalizeConfig(result?.data?.cloudflare || {});
}

export function getCfAccounts() {
  return cfConfigCache.accounts;
}

export function getActiveCfAccountId() {
  return cfConfigCache.activeId;
}

export async function saveCfAccounts(accounts, activeId) {
  const result = await configRequest('/cloudflare', {
    method: 'POST',
    body: JSON.stringify({
      accounts,
      activeId,
      domainAccounts: cfConfigCache.domainAccounts
    })
  });
  return normalizeConfig(result?.data || {});
}

export function getActiveCfAccount() {
  const accounts = getCfAccounts();
  const activeId = getActiveCfAccountId();
  return accounts.find((item) => item.id === activeId) || accounts[0] || null;
}

export function getCfAccountById(id) {
  return getCfAccounts().find((item) => item.id === id) || null;
}

export function hasCloudflareNameservers(nameservers) {
  return Array.isArray(nameservers) && nameservers.some((item) => String(item).includes('ns.cloudflare.com'));
}

export function getCfDomainAccountMap() {
  return cfConfigCache.domainAccounts || {};
}

export async function rememberDomainCfAccount(domain, account = getActiveCfAccount()) {
  if (!account?.id) return;
  const map = { ...getCfDomainAccountMap(), [domain]: account.id };
  cfConfigCache.domainAccounts = map;
  await saveDomainCfAccount(domain, account.id);
}

export async function forgetDomainCfAccount(domain) {
  const map = { ...getCfDomainAccountMap() };
  delete map[domain];
  cfConfigCache.domainAccounts = map;
  await saveDomainCfAccount(domain, '');
}

export function getDomainCfAccountLabel(domain) {
  const accountId = getCfDomainAccountMap()[domain];
  const account = getCfAccounts().find((item) => item.id === accountId);
  if (!account) return '';
  return (account.name || account.email || '').split('@')[0] || 'CF';
}

function getDeleteCandidates(domain) {
  const accounts = getCfAccounts();
  const mapped = getCfAccountById(getCfDomainAccountMap()[domain]);
  const active = getActiveCfAccount();
  return uniqueAccounts([mapped, active, ...accounts]);
}

function uniqueAccounts(accounts) {
  const seen = new Set();
  return accounts.filter((account) => {
    if (!account?.id || seen.has(account.id)) return false;
    seen.add(account.id);
    return true;
  });
}

async function saveDomainCfAccount(domain, accountId) {
  await configRequest('/cloudflare/domain-account', {
    method: 'POST',
    body: JSON.stringify({ domain, accountId })
  });
}

async function request(path, account, body) {
  const response = await fetch(`${appBase}/api/cloudflare${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      ...body,
      ...(account?.id ? { accountId: account.id } : {}),
      ...(account?.authType ? { auth_type: account.authType } : {}),
      ...(account?.accountId ? { account_id: account.accountId } : {})
    })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'Cloudflare request failed');
  return payload;
}

export function addCfZone(domain, account = getActiveCfAccount()) {
  return request('/zones/add', account, { domains: [domain] });
}

export function listCfZones(account = getActiveCfAccount()) {
  return request('/zones/list', account, {});
}

export function deleteCfZone(domain, account = getActiveCfAccount()) {
  return request('/zones/delete', account, { domains: [domain] });
}

export async function deleteCfZoneSmart(domain) {
  const candidates = getDeleteCandidates(domain);
  if (!candidates.length) {
    const result = await deleteCfZone(domain, null);
    await forgetDomainCfAccount(domain);
    return result;
  }

  const errors = [];
  for (const account of candidates) {
    try {
      const result = await deleteCfZone(domain, account);
      await forgetDomainCfAccount(domain);
      return result;
    } catch (error) {
      errors.push(`${account.email}: ${error.message}`);
    }
  }

  throw new Error(errors.join('；'));
}

export function lookupCfZone(domain, account) {
  return request('/zones/lookup', account, { domains: [domain] });
}
