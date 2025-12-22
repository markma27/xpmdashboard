# XPM API 快速参考

## 🔑 关键端点

### OAuth 连接
```
GET /api/xpm/connect
```
启动 XPM-only OAuth 流程

### 发票 API（带自动回退）
```
GET /api/xpm/invoices?tenantId={tenantId}&from=YYYY-MM-DD&to=YYYY-MM-DD
```

## 📋 必需的 Headers

```http
Authorization: Bearer {access_token}
xero-tenant-id: {tenant_id}
Accept: application/xml, application/json;q=0.9, */*;q=0.8
```

## 🔗 API 端点（按优先级）

### v3 端点（推荐）
```
https://api.xero.com/practicemanager/3.0/invoice.api/list?from=yyyymmdd&to=yyyymmdd
https://api.xero.com/api/v3/invoice.api/list?from=yyyymmdd&to=yyyymmdd
```

### v2 端点（备用）
```
https://api.xero.com/practicemanager/2.0/invoices?invoicedDateFrom=YYYY-MM-DD&invoicedDateTo=YYYY-MM-DD
```

## 📅 日期格式

- **v3**: `yyyymmdd` (例如: `20250101`)
- **v2**: `YYYY-MM-DD` (例如: `2025-01-01`)

## ⚠️ 常见错误

| 错误 | 原因 | 解决方案 |
|------|------|----------|
| 404 | 端点不存在 | 尝试下一个端点版本 |
| 401 | Token 过期 | 刷新 access token |
| 403 | Scope 不足 | 确保包含 `practicemanager` scope |
| Scope 冲突 | 混合 Accounting + XPM | 使用 XPM-only scope |

## ✅ Scope 配置

```typescript
scopes: [
  "openid",
  "profile", 
  "email",
  "offline_access",
  "practicemanager" // ⚠️ 必需
]
```

## 🔄 Token 刷新

```typescript
if (expires_at * 1000 < Date.now() + 60_000) {
  // 刷新 token
}
```

## 📚 完整文档

查看 `XPM_API_CONNECTION_GUIDE.md` 获取详细说明和代码示例。
