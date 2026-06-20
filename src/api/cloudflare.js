const accountsKey = 'cloudflare_accounts';
const activeKey = 'cloudflare_active_account';
const domainAccountKey = 'cloudflare_domain_accounts';

export function getCfAccounts() {
  return JSON.parse(window.localStorage.getItem(accountsKey) || '[]');
}

export function getActiveCfAccountId() {
  return window.localStorage.getItem(activeKey) || '';
}

export function saveCfAccounts(accounts, activeId) {
  window.localStorage.setItem(accountsKey, JSON.stringify(accounts));
  window.localStorage.setItem(activeKey, activeId || accounts[0]?.id || '');
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
  return JSON.parse(window.localStorage.getItem(domainAccountKey) || '{}');
}

export function rememberDomainCfAccount(domain, account = getActiveCfAccount()) {
  if (!account?.id) return;
  const map = getCfDomainAccountMap();
  map[domain] = account.id;
  window.localStorage.setItem(domainAccountKey, JSON.stringify(map));
}

export function forgetDomainCfAccount(domain) {
  const map = getCfDomainAccountMap();
  delete map[domain];
  window.localStorage.setItem(domainAccountKey, JSON.stringify(map));
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

async function request(path, account, body) {
  const response = await fetch(`/api/cloudflare${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, api_email: account.email, api_key: account.apiKey })
  });
  const payload = await response.json().catch(() => null);
  if (!response.ok || payload?.success === false) throw new Error(payload?.error || 'Cloudflare request failed');
  return payload;
}

export function addCfZone(domain, account = getActiveCfAccount()) {
  if (!account) throw new Error('请先配置 Cloudflare 账号');
  return request('/zones/add', account, { domains: [domain] });
}

export function deleteCfZone(domain, account = getActiveCfAccount()) {
  if (!account) throw new Error('请先配置 Cloudflare 账号');
  return request('/zones/delete', account, { domains: [domain] });
}

export async function deleteCfZoneSmart(domain) {
  const candidates = getDeleteCandidates(domain);
  if (!candidates.length) throw new Error('请先配置 Cloudflare 账号');

  const errors = [];
  for (const account of candidates) {
    try {
      const result = await deleteCfZone(domain, account);
      forgetDomainCfAccount(domain);
      return result;
    } catch (error) {
      errors.push(`${account.email}: ${error.message}`);
    }
  }

  throw new Error(errors.join('；'));
}

export function lookupCfZone(domain, account) {
  if (!account) throw new Error('请先配置 Cloudflare 账号');
  return request('/zones/lookup', account, { domains: [domain] });
}
