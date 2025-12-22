# XPM API 连接指南

本文档说明如何正确连接到 Xero Practice Manager (XPM) API。

## 目录

1. [OAuth 2.0 认证流程](#oauth-20-认证流程)
2. [API 端点配置](#api-端点配置)
3. [请求格式和参数](#请求格式和参数)
4. [常见错误和解决方案](#常见错误和解决方案)
5. [代码示例](#代码示例)

---

## OAuth 2.0 认证流程

### 1. 应用配置要求

在 Xero Developer Portal 中配置应用时，确保：

- **Redirect URI** 正确配置（例如：`http://localhost:3000/api/xero/callback`）
- **Scopes** 必须包含：
  - `openid`
  - `profile`
  - `email`
  - `offline_access`
  - `practicemanager` ⚠️ **重要：这是 XPM API 必需的 scope**

⚠️ **重要提示**：某些租户/应用不能在同一认证中混合使用 Accounting 和 XPM scopes。如果遇到 scope 冲突错误，请使用**仅 XPM scope** 的客户端。

### 2. 启动 OAuth 流程

**端点**：`GET /api/xpm/connect`

这个端点会：
1. 创建 XPM-only 客户端（仅包含 `practicemanager` scope）
2. 构建 Xero 授权 URL
3. 重定向用户到 Xero 授权页面

**示例**：
```typescript
// 前端调用
window.location.href = '/api/xpm/connect';
```

### 3. OAuth 回调处理

**端点**：`GET /api/xero/callback?code=xxx&state=xxx`

回调处理会：
1. 使用授权码交换 access token 和 refresh token
2. 加密并存储 token 到数据库
3. 重定向到成功页面

### 4. Token 存储

Token 需要安全存储（建议加密）：
- `access_token`: 用于 API 请求
- `refresh_token`: 用于刷新过期的 access token
- `expires_at`: token 过期时间戳
- `tenant_id`: Xero 租户 ID（每个组织都有唯一的 tenant_id）

---

## API 端点配置

### 基础 URL

所有 XPM API 请求的基础 URL：
```
https://api.xero.com
```

### 可用的 API 版本和端点

XPM API 有多个版本，不同租户可能使用不同的版本。建议按以下优先级尝试：

#### 版本 3.0（推荐，WorkflowMax 风格）

**发票列表端点**（按优先级）：
1. `GET /practicemanager/3.0/invoice.api/list?from=yyyymmdd&to=yyyymmdd`
2. `GET /practicemanager/3.0/invoice.api/list?from=yyyymmdd&to=yyyymmdd&detailed=true`
3. `GET /api/v3/invoice.api/list?from=yyyymmdd&to=yyyymmdd`（v3 别名）

**日期格式**：`yyyymmdd`（例如：`20250101` 表示 2025年1月1日）

**其他 v3 端点**：
- Clients: `/practicemanager/3.0/client.api/list`
- Jobs: `/practicemanager/3.0/job.api/list`
- Tasks: `/practicemanager/3.0/task.api/list`
- Time Entries: `/practicemanager/3.0/time.api/list`
- Staff: `/practicemanager/3.0/staff.api/list`
- Quotes: `/practicemanager/3.0/quote.api/list`
- Categories: `/practicemanager/3.0/category.api/list`
- Costs: `/practicemanager/3.0/cost.api/list`

#### 版本 2.0（备用）

**发票端点**：
- `GET /practicemanager/2.0/invoices?invoicedDateFrom=YYYY-MM-DD&invoicedDateTo=YYYY-MM-DD&pageSize=200&page=1`
- `GET /practicemanager/2.0/invoices`（全量，需要客户端过滤）

**日期格式**：`YYYY-MM-DD`（ISO 格式）

**其他 v2 端点**：
- Clients: `/api.xro/2.0/Clients`
- Jobs: `/api.xro/2.0/Jobs`
- Tasks: `/api.xro/2.0/Tasks`
- Time: `/api.xro/2.0/Time`
- Staff: `/api.xro/2.0/Staff`
- Quotes: `/api.xro/2.0/Quotes`
- Expense Claims: `/api.xro/2.0/ExpenseClaims`

---

## 请求格式和参数

### 必需的 HTTP Headers

每个 API 请求必须包含以下 headers：

```http
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
Accept: application/xml, application/json;q=0.9, */*;q=0.8
```

**说明**：
- `Authorization`: Bearer token，使用从 OAuth 流程获取的 `access_token`
- `xero-tenant-id`: Xero 租户 ID（每个组织唯一）
- `Accept`: 支持 XML 和 JSON，XPM API 可能返回 XML 格式

### 获取 Tenant ID

在 OAuth 回调后，可以通过以下端点获取连接的租户信息：

```http
GET https://api.xero.com/connections
Authorization: Bearer {access_token}
```

返回示例：
```json
[
  {
    "id": "tenant-id-here",
    "tenantId": "tenant-id-here",
    "tenantType": "ORGANISATION",
    "tenantName": "Your Organisation Name",
    "createdDateUtc": "2025-01-01T00:00:00",
    "updatedDateUtc": "2025-01-01T00:00:00"
  }
]
```

### 日期参数格式

**v3 API**：
- 格式：`yyyymmdd`（无分隔符）
- 示例：`20250101`（2025年1月1日）
- 参数名：`from` 和 `to`

**v2 API**：
- 格式：`YYYY-MM-DD`（ISO 格式）
- 示例：`2025-01-01`
- 参数名：`invoicedDateFrom` 和 `invoicedDateTo`

### Token 刷新

Access token 会过期（通常 30 分钟）。在请求前检查过期时间，如果即将过期（建议提前 1 分钟），使用 `refresh_token` 刷新：

```typescript
// 伪代码示例
if (tokenSet.expires_at * 1000 < Date.now() + 60_000) {
  const refreshed = await xeroClient.refreshToken();
  await saveTokenSet(tenantId, refreshed);
  accessToken = refreshed.access_token;
}
```

---

## 常见错误和解决方案

### 1. 404 Not Found

**原因**：端点路径错误或租户不支持该 API 版本

**解决方案**：
- 按优先级尝试多个端点（v3 → v2）
- 检查租户是否已启用 XPM
- 确认 scope 包含 `practicemanager`

### 2. 401 Unauthorized

**原因**：
- Access token 过期或无效
- 缺少 `xero-tenant-id` header
- Token 未正确传递

**解决方案**：
- 刷新 access token
- 检查 Authorization header 格式：`Bearer {token}`
- 确保包含 `xero-tenant-id` header

### 3. 403 Forbidden

**原因**：
- Scope 不足（缺少 `practicemanager`）
- 租户未授权应用访问 XPM

**解决方案**：
- 确认 OAuth scope 包含 `practicemanager`
- 重新授权连接（使用 XPM-only scope）

### 4. Scope 冲突错误

**错误信息**：`invalid_scope` 或类似错误

**原因**：某些租户不允许在同一认证中混合 Accounting 和 XPM scopes

**解决方案**：
- 使用**仅 XPM scope** 的客户端进行认证
- 不要同时请求 `accounting.*` 和 `practicemanager` scopes

### 5. XML vs JSON 响应

**问题**：XPM API 可能返回 XML 格式，而不是 JSON

**解决方案**：
- 在 Accept header 中包含 `application/xml`
- 实现 XML 解析逻辑（或使用 XML 解析库）
- 检查响应 Content-Type，根据类型解析

---

## 代码示例

### 完整的 API 请求示例（带端点回退）

```typescript
async function fetchXpmInvoices(
  tenantId: string,
  accessToken: string,
  from: string, // YYYY-MM-DD
  to: string    // YYYY-MM-DD
) {
  // 转换日期格式：YYYY-MM-DD -> yyyymmdd
  const yyyymmdd = (d: string) => d.split("-").join("");
  const f = yyyymmdd(from);
  const t = yyyymmdd(to);

  // 按优先级尝试的端点列表
  const endpoints = [
    // v3 主要端点
    `https://api.xero.com/practicemanager/3.0/invoice.api/list?from=${f}&to=${t}`,
    `https://api.xero.com/practicemanager/3.0/invoice.api/list?from=${f}&to=${t}&detailed=true`,
    // v3 别名
    `https://api.xero.com/api/v3/invoice.api/list?from=${f}&to=${t}`,
    // v2 备用
    `https://api.xero.com/practicemanager/2.0/invoices?invoicedDateFrom=${from}&invoicedDateTo=${to}&pageSize=200&page=1`,
    `https://api.xero.com/practicemanager/2.0/invoices`
  ];

  let lastError: any = null;
  let lastResponse: any = null;

  for (const endpoint of endpoints) {
    try {
      const response = await fetch(endpoint, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "xero-tenant-id": tenantId,
          Accept: "application/xml, application/json;q=0.9, */*;q=0.8",
        },
      });

      if (response.status >= 200 && response.status < 300) {
        const text = await response.text();
        
        // 尝试解析 JSON
        try {
          return JSON.parse(text);
        } catch {
          // 如果不是 JSON，可能是 XML，需要解析
          // 这里可以添加 XML 解析逻辑
          return { raw: text, format: 'xml' };
        }
      }

      if (response.status === 404) {
        // 端点不存在，尝试下一个
        continue;
      }

      // 其他错误，记录但继续尝试
      lastError = {
        status: response.status,
        statusText: response.statusText,
        endpoint,
      };
      continue;
    } catch (error) {
      lastError = error;
      continue;
    }
  }

  // 所有端点都失败
  throw new Error(
    `Failed to fetch invoices from all endpoints. Last error: ${JSON.stringify(lastError)}`
  );
}
```

### OAuth 连接示例（Next.js API Route）

```typescript
import { NextResponse } from "next/server";
import { XeroClient } from "xero-node";

export async function GET() {
  const xero = new XeroClient({
    clientId: process.env.XERO_CLIENT_ID!,
    clientSecret: process.env.XERO_CLIENT_SECRET!,
    redirectUris: [process.env.XERO_REDIRECT_URI!],
    scopes: [
      "openid",
      "profile",
      "email",
      "offline_access",
      "practicemanager" // XPM scope
    ],
  });

  const url = await xero.buildConsentUrl();
  return NextResponse.redirect(url);
}
```

### Token 刷新示例

```typescript
async function getValidAccessToken(tenantId: string): Promise<string> {
  // 1. 从数据库加载 token set
  const tokenSet = await loadTokenSet(tenantId);
  
  // 2. 检查是否即将过期（提前 1 分钟刷新）
  const expiresAt = tokenSet.expires_at ? tokenSet.expires_at * 1000 : 0;
  const shouldRefresh = expiresAt < Date.now() + 60_000;
  
  if (shouldRefresh) {
    // 3. 刷新 token
    const xero = new XeroClient({
      clientId: process.env.XERO_CLIENT_ID!,
      clientSecret: process.env.XERO_CLIENT_SECRET!,
      redirectUris: [process.env.XERO_REDIRECT_URI!],
      scopes: ["practicemanager"],
    });
    
    xero.setTokenSet(tokenSet);
    const refreshed = await xero.refreshToken();
    
    // 4. 保存新的 token
    await saveTokenSet(tenantId, refreshed);
    
    return refreshed.access_token!;
  }
  
  return tokenSet.access_token!;
}
```

### 获取连接的租户信息

```typescript
async function getConnections(accessToken: string) {
  const response = await fetch("https://api.xero.com/connections", {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch connections: HTTP ${response.status}`);
  }

  return await response.json();
}
```

---

## 总结检查清单

在实现 XPM API 连接时，请确保：

- [ ] OAuth scope 包含 `practicemanager`
- [ ] Redirect URI 在 Xero Developer Portal 中正确配置
- [ ] 使用正确的 API 端点（优先尝试 v3，然后 v2）
- [ ] 所有请求包含 `Authorization: Bearer {token}` header
- [ ] 所有请求包含 `xero-tenant-id` header
- [ ] 实现 token 刷新逻辑（在过期前刷新）
- [ ] 处理 XML 和 JSON 两种响应格式
- [ ] 实现端点回退机制（如果第一个端点失败，尝试其他版本）
- [ ] 正确处理日期格式（v3: `yyyymmdd`, v2: `YYYY-MM-DD`）
- [ ] 错误处理和重试逻辑

---

## 参考资源

- [Xero API 文档](https://developer.xero.com/documentation)
- [Xero Practice Manager API](https://developer.xero.com/documentation/api/practicemanager)
- [Xero OAuth 2.0 指南](https://developer.xero.com/documentation/guides/oauth2/overview)

---

**最后更新**：2025年1月
