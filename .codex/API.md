# DigitalPlat Domains API Reference

本文件是后续网站开发的 API 依据。若实际后端文档有更新，请同步更新本文件与根目录 `SYSTEM.md`。

## Overview

- Product: DigitalPlat Domains
- Purpose: Authenticate with API keys and manage domains programmatically.
- Base URL: `https://domain-api.digitalplat.org/api/v1`
- Auth: Bearer API key in the `Authorization` header.

## Authentication

所有 API 请求都必须携带 Bearer API Key。

```http
Authorization: Bearer <API_KEY>
```

API Key 前缀：

- `dp_live_`: production workloads
- `dp_test_`: development and testing

注意：

- API Key 原文只会在建立时显示一次。
- 后端以 SHA256 hash 存储 API Key。
- 不要在前端源码、Git、公开配置或日志中保存真实 API Key。

## Response Envelope

成功响应使用统一 envelope：

```json
{
  "success": true,
  "data": {},
  "meta": {}
}
```

前端开发时应优先以 `success` 判断请求是否成功，业务数据从 `data` 读取，分页或补充信息从 `meta` 读取。

## Domain Rules

- 注册域名时必须提供 `slot_type`。
- `slot_type` 可用值：`free`、`paid`、`subscription`。
- 官网公开展示的免费后缀包括 `.dpdns.org`、`.qzz.io`、`.us.kg`、`.xx.kg`。
- 付费后缀，例如 `.us.kg`、`.xx.kg`，需要 `paid` 或 `subscription` 容量。
- 删除域名会将域名移入 `pendingdelete`。
- 删除后 DNS 立即停用，域名 7 天后释放。

## Endpoints

### List Domains

```http
GET /api/v1/domains
```

列出目前 API Key 拥有的所有域名。

#### Request

不需要 body。

#### Response

```json
{
  "success": true,
  "data": [
    {
      "name": "example.us.kg",
      "status": "ok",
      "slot_type": "subscription",
      "lifecycle_type": "subscription",
      "expiry_date": "2027-04-08",
      "nameservers": ["ns1.provider.com", "ns2.provider.com"]
    }
  ],
  "meta": {}
}
```

#### curl

```bash
curl https://domain-api.digitalplat.org/api/v1/domains \
  -H "Authorization: Bearer dp_live_xxxxxxxxxxxxxxxxx"
```

### Register Domain

```http
POST /api/v1/domains
```

注册新域名，使用外部 nameservers。

#### Request Body

```json
{
  "domain": "example.us.kg",
  "slot_type": "subscription",
  "nameservers": ["ns1.provider.com", "ns2.provider.com"]
}
```

#### Fields

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `domain` | string | yes | 要注册的完整域名。 |
| `slot_type` | string | yes | `free`、`paid` 或 `subscription`。 |
| `nameservers` | string[] | yes | 外部 nameserver 列表。 |

#### Response

```json
{
  "success": true,
  "data": {
    "name": "example.us.kg",
    "status": "ok",
    "slot_type": "subscription",
    "lifecycle_type": "subscription"
  },
  "meta": {}
}
```

#### curl

```bash
curl https://domain-api.digitalplat.org/api/v1/domains \
  -X POST \
  -H "Authorization: Bearer dp_live_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"domain":"example.us.kg","slot_type":"subscription","nameservers":["ns1.provider.com","ns2.provider.com"]}'
```

### Update Nameservers

```http
PATCH /api/v1/domains/{domain}/nameservers
```

替换指定域名的 delegated nameserver set。

#### Path Parameters

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `domain` | string | yes | 完整域名，例如 `example.us.kg`。 |

#### Request Body

```json
{
  "nameservers": ["ns1.provider.com", "ns2.provider.com"]
}
```

#### Response

```json
{
  "success": true,
  "data": {
    "name": "example.us.kg",
    "nameservers": ["ns1.provider.com", "ns2.provider.com"]
  },
  "meta": {}
}
```

#### curl

```bash
curl https://domain-api.digitalplat.org/api/v1/domains/example.us.kg/nameservers \
  -X PATCH \
  -H "Authorization: Bearer dp_live_xxxxxxxxxxxxxxxxx" \
  -H "Content-Type: application/json" \
  -d '{"nameservers":["ns1.provider.com","ns2.provider.com"]}'
```

### Delete Domain

```http
DELETE /api/v1/domains/{domain}
```

删除指定域名。域名会进入 `pendingdelete`，DNS 立即停用，7 天后释放。

#### Path Parameters

| Parameter | Type | Required | Notes |
| --- | --- | --- | --- |
| `domain` | string | yes | 完整域名，例如 `example.us.kg`。 |

#### Response

```json
{
  "success": true,
  "data": {
    "domain": "example.us.kg",
    "status": "pendingdelete"
  },
  "meta": {}
}
```

#### curl

```bash
curl https://domain-api.digitalplat.org/api/v1/domains/example.us.kg \
  -X DELETE \
  -H "Authorization: Bearer dp_live_xxxxxxxxxxxxxxxxx"
```

## Frontend Development Notes

- 真实 API Key 不得写入前端 bundle；当前开发版将凭证保存到本地 `config.local.json`，该文件必须保持在 `.gitignore` 中。
- 前端页面可写入 DigitalPlat API Key；本地 Vite 代理从 `config.local.json` 读取 API Key 并转发给 DigitalPlat 上游。
- Cloudflare 集成使用本地 Vite 代理 `/api/cloudflare/zones/add`、`/api/cloudflare/zones/delete`、`/api/cloudflare/zones/lookup` 转发到 Cloudflare v4 API。
- Cloudflare 账号由页面写入 `config.local.json`，支持多个账号和默认账号；支持 API Token 与 Global API Key 两种认证，前端请求只传账号 ID，密钥不进入浏览器存储。
- 前端表单应限制 `slot_type` 为 `free`、`paid`、`subscription` 三选一。
- `nameservers` 应以数组提交，并在送出前去除空白项。
- 删除域名是高风险操作，UI 必须有二次确认与明确后果提示。
- 显示域名列表时，至少支持 `name`、`status`、`slot_type`、`lifecycle_type`、`expiry_date`、`nameservers` 字段。

