import { execFile, execFileSync, spawn } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pbkdf2Sync, randomBytes, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

const execFileAsync = promisify(execFile);
const localConfigPath = join(process.cwd(), 'config.local.json');
const usersPath = join(process.cwd(), 'data', 'users.json');
const sessionCookieName = 'dg_session';
const sessions = new Map();

function resolvePowerShellPath() {
  const candidates = [
    'C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.6.3.0_x64__8wekyb3d8bbwe\\pwsh.exe',
    'C:\\Program Files\\WindowsApps\\Microsoft.PowerShell_7.6.0.0_x64__8wekyb3d8bbwe\\pwsh.exe',
    'pwsh.exe',
    'pwsh',
    'powershell.exe',
    'powershell'
  ];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()'], {
        stdio: 'ignore',
        windowsHide: true
      });
      return candidate;
    } catch (error) {}
  }
  return 'powershell.exe';
}

const powerShellPath = resolvePowerShellPath();

function resolveCurlPath() {
  const candidates = ['curl', 'curl.exe'];
  for (const candidate of candidates) {
    try {
      execFileSync(candidate, ['--version'], { stdio: 'ignore', windowsHide: true });
      return candidate;
    } catch (error) {}
  }
  return '';
}

const curlPath = resolveCurlPath();

const emptyLocalConfig = {
  digitalplat: { apiKey: '' },
  cloudflare: { activeId: '', accounts: [], domainAccounts: {} }
};

async function readLocalConfig() {
  try {
    const config = JSON.parse(await readFile(localConfigPath, 'utf8'));
    return {
      digitalplat: { ...emptyLocalConfig.digitalplat, ...(config.digitalplat || {}) },
      cloudflare: { ...emptyLocalConfig.cloudflare, ...(config.cloudflare || {}) }
    };
  } catch (error) {
    return structuredClone(emptyLocalConfig);
  }
}

async function writeLocalConfig(config) {
  await writeFile(localConfigPath, `${JSON.stringify(config, null, 2)}\n`);
}

async function readUsersStore() {
  try {
    const store = JSON.parse(await readFile(usersPath, 'utf8'));
    return { users: Array.isArray(store.users) ? store.users : [] };
  } catch (error) {
    return { users: [] };
  }
}

async function writeUsersStore(store) {
  await mkdir(join(process.cwd(), 'data'), { recursive: true });
  await writeFile(usersPath, `${JSON.stringify(store, null, 2)}\n`);
}

function hashPassword(password, salt = randomBytes(16).toString('hex')) {
  const hash = pbkdf2Sync(password, salt, 100000, 32, 'sha256').toString('hex');
  return { salt, hash };
}

function verifyPassword(password, user) {
  const actual = Buffer.from(hashPassword(password, user.salt).hash, 'hex');
  const expected = Buffer.from(user.passwordHash, 'hex');
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}

function parseCookies(request) {
  return Object.fromEntries(
    String(request.headers.cookie || '')
      .split(';')
      .map((item) => item.trim())
      .filter(Boolean)
      .map((item) => {
        const index = item.indexOf('=');
        return [item.slice(0, index), decodeURIComponent(item.slice(index + 1))];
      })
  );
}

function getSessionUserId(request) {
  return sessions.get(parseCookies(request)[sessionCookieName]) || '';
}

function setSessionCookie(response, token) {
  response.setHeader('Set-Cookie', `${sessionCookieName}=${encodeURIComponent(token)}; HttpOnly; SameSite=Lax; Path=/`);
}

function clearSessionCookie(response) {
  response.setHeader('Set-Cookie', `${sessionCookieName}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`);
}

function emptyUserConfig() {
  return structuredClone(emptyLocalConfig);
}

async function readUserConfig(request) {
  const userId = getSessionUserId(request);
  if (!userId) return null;
  const store = await readUsersStore();
  const user = store.users.find((item) => item.id === userId);
  if (!user) return null;
  const config = user.config || {};
  return {
    store,
    user,
    config: {
      digitalplat: { ...emptyLocalConfig.digitalplat, ...(config.digitalplat || {}) },
      cloudflare: { ...emptyLocalConfig.cloudflare, ...(config.cloudflare || {}) }
    }
  };
}

async function writeUserConfig(context, config) {
  context.user.config = config;
  await writeUsersStore(context.store);
}

function publicCloudflareAccount(account) {
  return {
    id: account.id,
    name: account.name || account.email,
    email: account.email,
    authType: account.authType || inferCfAuthType(account),
    accountId: account.accountId || '',
    configured: Boolean(account.apiKey || account.api_key)
  };
}

function toCfRequestAccount(config, accountId) {
  const accounts = config.cloudflare.accounts || [];
  const selected =
    accounts.find((account) => account.id === accountId) ||
    accounts.find((account) => account.id === config.cloudflare.activeId) ||
    accounts[0] ||
    {};
  return {
    api_email: selected.email || '',
    api_key: selected.apiKey || selected.api_key || '',
    auth_type: selected.authType || inferCfAuthType(selected),
    account_id: selected.accountId || selected.account_id || ''
  };
}

function inferCfAuthType(account) {
  if (account.authType) return account.authType;
  if (!account.email || String(account.apiKey || account.api_key || '').startsWith('cfut_')) return 'token';
  return 'global';
}

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
}

async function proxyWithCurl({ apiKey, body, method, url }) {
  if (!curlPath) throw new Error('curl is not installed on this server');
  const args = [
    '-sS',
    '-w',
    '\n%{http_code}',
    '-X',
    method,
    '-H',
    `Authorization: Bearer ${apiKey}`,
    '-H',
    'Accept: application/json'
  ];
  if (body) {
    args.push('-H', 'Content-Type: application/json', '--data-binary', '@-');
  }
  args.push(url);
  const stdout = await runCurl(args, body);
  const marker = stdout.lastIndexOf('\n');
  if (marker < 0) throw new Error('curl response missing status code');
  return { status: Number(stdout.slice(marker + 1)) || 502, body: stdout.slice(0, marker) };
}

function runCurl(args, body) {
  return new Promise((resolve, reject) => {
    const child = spawn(curlPath, args, { windowsHide: true });
    const stdout = [];
    const stderr = [];
    child.stdout.on('data', (chunk) => stdout.push(chunk));
    child.stderr.on('data', (chunk) => stderr.push(chunk));
    child.on('error', reject);
    child.on('close', (code) => {
      const output = Buffer.concat(stdout).toString('utf8');
      if (code === 0) resolve(output);
      else reject(new Error(Buffer.concat(stderr).toString('utf8') || `curl exited with code ${code}`));
    });
    if (body) child.stdin.end(body);
    else child.stdin.end();
  });
}

async function proxyWithPowerShell({ apiKey, body, method, url }) {
  const script = `
$headers = @{ Authorization = "Bearer $env:DIGITALPLAT_PROXY_KEY"; Accept = "application/json" }
$params = @{ Uri = $env:DIGITALPLAT_PROXY_URL; Method = $env:DIGITALPLAT_PROXY_METHOD; Headers = $headers; UseBasicParsing = $true; ErrorAction = "Stop" }
if ($env:DIGITALPLAT_PROXY_BODY) {
  $params.Body = $env:DIGITALPLAT_PROXY_BODY
  $params.ContentType = "application/json"
}
try {
  $result = Invoke-WebRequest @params
  [pscustomobject]@{ status = [int]$result.StatusCode; body = $result.Content } | ConvertTo-Json -Compress
} catch {
  $response = $_.Exception.Response
  $status = if ($response) { [int]$response.StatusCode } else { 502 }
  $content = if ($response -and $response.Content) { $response.Content.ReadAsStringAsync().GetAwaiter().GetResult() } else { $_.Exception.Message }
  [pscustomobject]@{ status = $status; body = $content } | ConvertTo-Json -Compress
}
`;

  const { stdout } = await execFileAsync(powerShellPath, ['-NoProfile', '-Command', script], {
    env: {
      ...process.env,
      DIGITALPLAT_PROXY_BODY: body ? body.toString('utf8') : '',
      DIGITALPLAT_PROXY_KEY: apiKey,
      DIGITALPLAT_PROXY_METHOD: method,
      DIGITALPLAT_PROXY_URL: url
    },
    windowsHide: true
  });

  return JSON.parse(stdout.trim());
}

async function proxyUpstream(options) {
  if (process.platform === 'win32') return proxyWithPowerShell(options);
  return proxyWithCurl(options);
}

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function cfRequest({ account, body, method, path }) {
  const authHeaders =
    account.auth_type === 'token'
      ? { Authorization: `Bearer ${account.api_key}` }
      : { 'X-Auth-Email': account.api_email, 'X-Auth-Key': account.api_key };
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

async function cfAddZone(account, domain) {
  const existing = await cfRequest({ account, method: 'GET', path: `/zones?name=${encodeURIComponent(domain)}` });
  if (existing.payload?.success && existing.payload.result?.length) return existing.payload.result[0];
  const accounts = account.account_id ? null : await cfRequest({ account, method: 'GET', path: '/accounts' });
  const accountId = account.account_id || accounts?.payload?.result?.[0]?.id;
  if (!accountId) throw new Error('无法获取 CF Account ID，请检查账号');
  const created = await cfRequest({
    account,
    method: 'POST',
    path: '/zones',
    body: { name: domain, account: { id: accountId }, type: 'full', jump_start: true }
  });
  if (!created.payload?.success) throw new Error(JSON.stringify(created.payload?.errors || []));
  return created.payload.result;
}

async function cfDeleteZone(account, domain) {
  const found = await cfRequest({ account, method: 'GET', path: `/zones?name=${encodeURIComponent(domain)}` });
  const zone = found.payload?.result?.[0];
  if (!found.payload?.success || !zone) throw new Error('未在 CF 账号中找到该域名');
  const deleted = await cfRequest({ account, method: 'DELETE', path: `/zones/${zone.id}` });
  if (!deleted.payload?.success) throw new Error(JSON.stringify(deleted.payload?.errors || []));
  return zone;
}

async function cfFindZone(account, domain) {
  const found = await cfRequest({ account, method: 'GET', path: `/zones?name=${encodeURIComponent(domain)}` });
  if (!found.payload?.success) throw new Error(JSON.stringify(found.payload?.errors || []));
  return found.payload.result?.[0] || null;
}

async function cfListZones(account) {
  const data = [];
  let page = 1;
  let totalPages = 1;
  do {
    const listed = await cfRequest({ account, method: 'GET', path: `/zones?per_page=50&page=${page}` });
    if (!listed.payload?.success) throw new Error(JSON.stringify(listed.payload?.errors || []));
    data.push(...(listed.payload.result || []));
    totalPages = listed.payload.result_info?.total_pages || 1;
    page += 1;
  } while (page <= totalPages);
  return data;
}

function resolveCfAccount(requestBody, fallbackAccount) {
  return {
    ...requestBody,
    api_email: requestBody.api_email || fallbackAccount.api_email,
    api_key: requestBody.api_key || fallbackAccount.api_key,
    account_id: requestBody.account_id || fallbackAccount.account_id || '',
    auth_type: requestBody.auth_type || fallbackAccount.auth_type || inferCfAuthType({
      email: requestBody.api_email || fallbackAccount.api_email,
      apiKey: requestBody.api_key || fallbackAccount.api_key
    })
  };
}

function assertCfAccount(account) {
  if (!account.api_key || (account.auth_type !== 'token' && !account.api_email)) {
    throw new Error('请先配置 Cloudflare 账号');
  }
}

function resolveCfRequestBody(requestBody, config) {
  const fallbackAccount = toCfRequestAccount(config, requestBody.accountId);
  return resolveCfAccount(requestBody, fallbackAccount);
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.DIGITALPLAT_API_BASE_URL || 'https://domain-api.digitalplat.org/api/v1';

  return {
    base: env.VITE_BASE || '/',
    plugins: [
      vue(),
      {
        name: 'digitalplat-dev-proxy',
        configureServer(server) {
          server.middlewares.use('/api/auth/status', async (request, response) => {
            const store = await readUsersStore();
            const userId = getSessionUserId(request);
            const user = store.users.find((item) => item.id === userId);
            sendJson(response, 200, {
              success: true,
              data: {
                initialized: store.users.length > 0,
                authenticated: Boolean(user),
                user: user ? { id: user.id, username: user.username } : null
              },
              meta: {}
            });
          });

          server.middlewares.use('/api/auth/register', async (request, response) => {
            try {
              const body = await readJson(request);
              const username = String(body.username || '').trim();
              const password = String(body.password || '');
              if (!username || password.length < 6) throw new Error('用户名不能为空，密码至少 6 位');
              const store = await readUsersStore();
              if (store.users.some((item) => item.username === username)) throw new Error('用户名已存在');
              const { salt, hash } = hashPassword(password);
              const user = {
                id: randomBytes(16).toString('hex'),
                username,
                salt,
                passwordHash: hash,
                config: await readLocalConfig()
              };
              store.users.push(user);
              await writeUsersStore(store);
              const token = randomBytes(24).toString('hex');
              sessions.set(token, user.id);
              setSessionCookie(response, token);
              sendJson(response, 200, { success: true, data: { user: { id: user.id, username } }, meta: {} });
            } catch (error) {
              sendJson(response, 400, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/auth/login', async (request, response) => {
            try {
              const body = await readJson(request);
              const store = await readUsersStore();
              const user = store.users.find((item) => item.username === String(body.username || '').trim());
              if (!user || !verifyPassword(String(body.password || ''), user)) throw new Error('用户名或密码错误');
              const token = randomBytes(24).toString('hex');
              sessions.set(token, user.id);
              setSessionCookie(response, token);
              sendJson(response, 200, { success: true, data: { user: { id: user.id, username: user.username } }, meta: {} });
            } catch (error) {
              sendJson(response, 401, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/auth/logout', (request, response) => {
            const token = parseCookies(request)[sessionCookieName];
            if (token) sessions.delete(token);
            clearSessionCookie(response);
            sendJson(response, 200, { success: true, data: {}, meta: {} });
          });

          server.middlewares.use('/api/config/status', async (request, response) => {
            const context = await readUserConfig(request);
            if (!context) {
              sendJson(response, 401, { success: false, error: '请先登录' });
              return;
            }
            const config = context.config;
            sendJson(response, 200, {
              success: true,
              data: {
                digitalplat: { apiConfigured: Boolean(config.digitalplat.apiKey) },
                cloudflare: {
                  accounts: config.cloudflare.accounts.map(publicCloudflareAccount),
                  activeId: config.cloudflare.activeId,
                  domainAccounts: config.cloudflare.domainAccounts || {}
                }
              },
              meta: {}
            });
          });

          server.middlewares.use('/api/config/digitalplat', async (request, response) => {
            try {
              const body = await readJson(request);
              const context = await readUserConfig(request);
              if (!context) throw new Error('请先登录');
              const config = context.config;
              config.digitalplat.apiKey = String(body.apiKey || '').trim();
              await writeUserConfig(context, config);
              sendJson(response, 200, { success: true, data: { apiConfigured: Boolean(config.digitalplat.apiKey) }, meta: {} });
            } catch (error) {
              sendJson(response, 500, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/config/cloudflare/domain-account', async (request, response) => {
            try {
              const body = await readJson(request);
              const context = await readUserConfig(request);
              if (!context) throw new Error('请先登录');
              const config = context.config;
              config.cloudflare.domainAccounts = config.cloudflare.domainAccounts || {};
              if (body.accountId) config.cloudflare.domainAccounts[body.domain] = body.accountId;
              else delete config.cloudflare.domainAccounts[body.domain];
              await writeUserConfig(context, config);
              sendJson(response, 200, { success: true, data: { domainAccounts: config.cloudflare.domainAccounts }, meta: {} });
            } catch (error) {
              sendJson(response, 500, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/config/cloudflare', async (request, response) => {
            try {
              const body = await readJson(request);
              const context = await readUserConfig(request);
              if (!context) throw new Error('请先登录');
              const config = context.config;
              const accounts = Array.isArray(body.accounts) ? body.accounts : [];
              const existingAccounts = config.cloudflare.accounts || [];
              config.cloudflare.accounts = accounts.map((account) => ({
                id: account.id,
                name: account.name || account.email,
                email: account.email,
                authType: account.authType || inferCfAuthType(account),
                accountId: account.accountId || account.account_id || '',
                apiKey:
                  account.apiKey ||
                  account.api_key ||
                  existingAccounts.find((item) => item.id === account.id)?.apiKey ||
                  ''
              }));
              config.cloudflare.activeId = body.activeId || config.cloudflare.accounts[0]?.id || '';
              config.cloudflare.domainAccounts = body.domainAccounts || config.cloudflare.domainAccounts || {};
              await writeUserConfig(context, config);
              sendJson(response, 200, {
                success: true,
                data: {
                  accounts: config.cloudflare.accounts.map(publicCloudflareAccount),
                  activeId: config.cloudflare.activeId,
                  domainAccounts: config.cloudflare.domainAccounts
                },
                meta: {}
              });
            } catch (error) {
              sendJson(response, 500, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/digitalplat/status', async (request, response) => {
            const context = await readUserConfig(request);
            if (!context) {
              sendJson(response, 401, { success: false, error: '请先登录' });
              return;
            }
            const config = context.config;
            sendJson(response, 200, { success: true, data: { apiConfigured: Boolean(config.digitalplat.apiKey) }, meta: {} });
          });

          server.middlewares.use('/api/digitalplat', async (request, response) => {
            const context = await readUserConfig(request);
            if (!context) {
              sendJson(response, 401, { success: false, error: '请先登录' });
              return;
            }
            const config = context.config;
            const apiKey = config.digitalplat.apiKey;
            if (!apiKey) {
              sendJson(response, 401, { success: false, error: 'DigitalPlat API key is not configured' });
              return;
            }

            const targetPath = request.url || '/';
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            const body = chunks.length ? Buffer.concat(chunks) : undefined;

            try {
              const upstream = await proxyUpstream({
                apiKey,
                body,
                method: request.method || 'GET',
                url: `${apiBaseUrl}${targetPath}`
              });
              response.statusCode = upstream.status;
              response.setHeader('Content-Type', 'application/json');
              response.end(upstream.body);
            } catch (error) {
              sendJson(response, 502, { success: false, error: error.message || 'Proxy request failed' });
            }
          });

          server.middlewares.use('/api/cloudflare/zones/add', async (request, response) => {
            try {
              const context = await readUserConfig(request);
              if (!context) throw new Error('请先登录');
              const config = context.config;
              const req = resolveCfRequestBody(await readJson(request), config);
              assertCfAccount(req);
              const data = [];
              for (const domain of req.domains || []) {
                const zone = await cfAddZone(req, domain);
                data.push({ domain, status: zone.status, name_servers: zone.name_servers || [], msg: '已托管' });
              }
              sendJson(response, 200, { success: true, data });
            } catch (error) {
              sendJson(response, 500, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/cloudflare/zones/list', async (request, response) => {
            try {
              const context = await readUserConfig(request);
              if (!context) throw new Error('请先登录');
              const config = context.config;
              const req = resolveCfRequestBody(await readJson(request), config);
              assertCfAccount(req);
              const zones = await cfListZones(req);
              const data = zones.map((zone) => ({
                id: zone.id,
                name: zone.name,
                status: zone.status,
                type: zone.type,
                paused: zone.paused,
                name_servers: zone.name_servers || [],
                created_on: zone.created_on,
                modified_on: zone.modified_on
              }));
              sendJson(response, 200, { success: true, data, meta: { total: data.length } });
            } catch (error) {
              sendJson(response, 500, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/cloudflare/zones/delete', async (request, response) => {
            try {
              const context = await readUserConfig(request);
              if (!context) throw new Error('请先登录');
              const config = context.config;
              const req = resolveCfRequestBody(await readJson(request), config);
              assertCfAccount(req);
              const data = [];
              for (const domain of req.domains || []) {
                const zone = await cfDeleteZone(req, domain);
                data.push({ domain, status: 'deleted', name_servers: zone.name_servers || [], msg: '已删除 CF 托管' });
              }
              sendJson(response, 200, { success: true, data });
            } catch (error) {
              sendJson(response, 500, { success: false, error: error.message });
            }
          });

          server.middlewares.use('/api/cloudflare/zones/lookup', async (request, response) => {
            try {
              const context = await readUserConfig(request);
              if (!context) throw new Error('请先登录');
              const config = context.config;
              const req = resolveCfRequestBody(await readJson(request), config);
              assertCfAccount(req);
              const data = [];
              for (const domain of req.domains || []) {
                const zone = await cfFindZone(req, domain);
                data.push({ domain, found: Boolean(zone), status: zone?.status || '', name_servers: zone?.name_servers || [] });
              }
              sendJson(response, 200, { success: true, data });
            } catch (error) {
              sendJson(response, 500, { success: false, error: error.message });
            }
          });
        }
      }
    ],
    server: {
      allowedHosts: ['mycodexy.duckdns.org', 'localhost', '127.0.0.1'],
      host: '0.0.0.0',
      port: 5173
    }
  };
});
