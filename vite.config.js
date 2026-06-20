import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { defineConfig, loadEnv } from 'vite';
import vue from '@vitejs/plugin-vue';

const execFileAsync = promisify(execFile);

function sendJson(response, statusCode, payload) {
  response.statusCode = statusCode;
  response.setHeader('Content-Type', 'application/json');
  response.end(JSON.stringify(payload));
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

  const { stdout } = await execFileAsync('powershell', ['-NoProfile', '-Command', script], {
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

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

async function cfRequest({ account, body, method, path }) {
  const response = await fetch(`https://api.cloudflare.com/client/v4${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'X-Auth-Email': account.api_email,
      'X-Auth-Key': account.api_key
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: response.status, payload: await response.json().catch(() => null) };
}

async function cfAddZone(account, domain) {
  const existing = await cfRequest({ account, method: 'GET', path: `/zones?name=${encodeURIComponent(domain)}` });
  if (existing.payload?.success && existing.payload.result?.length) return existing.payload.result[0];
  const accounts = await cfRequest({ account, method: 'GET', path: '/accounts' });
  const accountId = accounts.payload?.result?.[0]?.id;
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

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const apiBaseUrl = env.DIGITALPLAT_API_BASE_URL || 'https://domain-api.digitalplat.org/api/v1';

  return {
    plugins: [
      vue(),
      {
        name: 'digitalplat-dev-proxy',
        configureServer(server) {
          server.middlewares.use('/api/digitalplat/status', (_request, response) => {
            sendJson(response, 200, { success: true, data: { apiConfigured: true }, meta: {} });
          });

          server.middlewares.use('/api/digitalplat', async (request, response) => {
            const apiKey = request.headers['x-digitalplat-api-key'];
            if (!apiKey) {
              sendJson(response, 401, { success: false, error: 'DigitalPlat API key is not configured' });
              return;
            }

            const targetPath = request.url || '/';
            const chunks = [];
            for await (const chunk of request) chunks.push(chunk);
            const body = chunks.length ? Buffer.concat(chunks) : undefined;

            try {
              const upstream = await proxyWithPowerShell({
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
              const req = await readJson(request);
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

          server.middlewares.use('/api/cloudflare/zones/delete', async (request, response) => {
            try {
              const req = await readJson(request);
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
              const req = await readJson(request);
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
      host: '0.0.0.0',
      port: 5173
    }
  };
});
