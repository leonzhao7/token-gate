# Token Gate API 文档

本文档以当前代码中的路由注册、HTTP handler 和 JSON 类型为准，覆盖健康检查、全部公开代理 API，以及全部 `/admin/api/*` 管理 API。

## 1. 通用约定

### 1.1 服务地址与数据格式

- 默认监听地址：`http://127.0.0.1:8080`，可由 `TG_LISTEN_ADDR` 修改。
- 除上游流式响应和 console sync 流式模式外，接口均返回 `application/json`。
- 时间字段使用 UTC RFC 3339/RFC 3339 Nano 字符串，例如 `2026-07-13T08:30:00Z`。
- 带固定请求结构的管理 API 采用严格 JSON 解码：出现 handler 未声明的字段时返回 `400`。公开代理请求允许相应上游协议的其他字段；`PUT /admin/api/config` 则接受任意 `string -> string` 键值。
- 路径参数 `{id}` 必须是大于 `0` 的十进制整数，否则返回 `400`。

### 1.2 鉴权

公开 `/v1/*` API 必须提供已启用的客户端密钥，支持两种请求头：

```http
Authorization: Bearer tg-example
```

或：

```http
X-Api-Key: tg-example
```

`Authorization` 也接受不带 `Bearer ` 前缀的原始 token。如果两个头同时存在，优先使用 `Authorization`。

`/admin/api/*` 当前没有 admin token、session 或 RBAC，任何能访问服务的人都能调用。管理响应还可能包含明文 `api_key`、客户端 token、代理密码和 console 凭据，因此必须依靠可信网络边界限制访问。

### 1.3 通用错误响应

除上游成功响应和 console sync 的 NDJSON 模式外，Token Gate 自身错误采用：

```json
{
  "error": {
    "message": "error description",
    "type": "token_gate_error"
  }
}
```

常见状态码：

| 状态码 | 含义 |
| --- | --- |
| `400` | JSON、路径参数、过滤参数或字段值无效 |
| `401` | 公开 API 缺少或使用了无效客户端密钥 |
| `404` | 路由、资源或公开代理路径不存在 |
| `500` | 数据库或服务内部错误 |
| `502` | backend console 上游请求失败 |
| `503` | 没有可用 backend，或所有候选 backend 均失败 |

### 1.4 分页响应

Backend、SOCKS5 代理、客户端密钥、usage log 和事件列表使用相同分页参数：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `page` | integer | `1` | 小于 `1` 或无法解析时使用 `1` |
| `limit` | integer | `10` | 小于等于 `0` 或无法解析时使用 `10`；最大 `10000` |

响应结构：

```json
{
  "items": [],
  "total": 0,
  "page": 1,
  "limit": 10
}
```

## 2. 公共数据结构

后续接口通过类型名引用本节结构。标记为“可能省略”的字段使用了 Go `omitempty`，为空时不会出现在 JSON 中。

### 2.1 `Backend`

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `id` | integer | Backend ID |
| `name` | string | 名称 |
| `protocol` | string | `openai`、`anthropic` 或 `both` |
| `backend_type` | string | Console 类型，通常为 `new-api` 或 `sub2api` |
| `base_url` | string | 上游 API 基础 URL |
| `api_key` | string | 上游 API key；为空时可能省略 |
| `console_url` | string | Relay console 基础 URL |
| `tags` | string[] | 标签 |
| `console_username` | string | Console 用户名 |
| `console_password` | string | Console 密码；为空时可能省略 |
| `console_authorization` | string | sub2api Authorization 值；为空时可能省略 |
| `console_checkin_path` | string | sub2api 签到路径；为空时可能省略 |
| `channel_url` | string | sub2api 渠道/定价路径；为空时可能省略 |
| `console_cookie` | string | new-api cookie；为空时可能省略 |
| `console_account_json` | string | 已同步的账户对象，保存为 JSON 字符串 |
| `console_pricing_json` | string | 已同步的定价对象，保存为 JSON 字符串 |
| `notes` | string | 备注 |
| `proxy_id` | integer | `0` 表示直连，否则引用 SOCKS5 代理 |
| `proxy` | `SocksProxy` | 已关联代理；直连或未解析时省略 |
| `status` | string | `normal`、`abnormal` 或 `disabled` |
| `consecutive_failures` | integer | 连续失败次数 |
| `recover_at` | string | `abnormal` 的计划恢复时间；无值时省略 |
| `weight` | integer | 调度权重，持久化时最小为 `1` |
| `models` | string[] | 支持的模型或 glob 模式 |
| `model_mapping` | object | 客户端模型名到上游模型名的精确映射 |
| `created_at` | string | 创建时间 |
| `updated_at` | string | 更新时间 |

代码仍能解码部分请求中的 `endpoints` 字段，但它不会进入 `Backend` 响应，也不参与候选 backend 筛选。

### 2.2 `BackendView`

`BackendView` 包含 `Backend` 的全部字段，并增加：

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| `request_count` | integer | 该 backend 的历史 usage log 数 |
| `avg_latency_ms` | number | 历史平均耗时 |
| `last_used_at` | string | 最后使用时间；无记录时省略 |
| `model_count` | integer | `models` 数量 |
| `hourly_requests` | integer | 最近一小时请求数 |
| `hourly_failures` | integer | 最近一小时失败数 |
| `recent_stats.window_minutes` | integer | 固定为 `30` |
| `recent_stats.successes` | integer | 最近 30 分钟 2xx 数 |
| `recent_stats.failures` | integer | 最近 30 分钟非 2xx 数 |

### 2.3 `SocksProxy`

```text
id: integer
name: string
address: string                 # host:port
username: string
password: string               # 为空时可能省略
enabled: boolean
created_at: string
updated_at: string
```

SOCKS5 列表项还增加 `bound_backend_count`、`request_count`、`traffic_bytes`、`avg_latency_ms`，有使用记录时增加 `last_used_at`。

### 2.4 `ClientKey`

```text
id: integer
name: string
token: string                  # 为空时可能省略；token_hash 永不输出
token_prefix: string
allowed_models: string
enabled: boolean
created_at: string
updated_at: string
```

客户端密钥列表项还增加 `masked_token`、`usage_count`，有使用记录时增加 `last_used_at`。

注意：当前代码只保存和返回 `allowed_models`，公开代理请求并没有用它限制模型。

### 2.5 `UsageLog`

```text
id: integer
request_id: string
client_id: integer
client_name: string
client_token_prefix: string
method: string
path: string
query: string
endpoint: string
model: string
backend_id: integer
backend_name: string
proxy_id: integer
proxy_name: string
attempts: integer
status_code: integer
status_family: string           # 2xx/3xx/4xx/5xx/other
duration_ms: integer
error_message: string
client_ip: string
user_agent: string
trace_id: string
request_bytes: integer
response_bytes: integer
input_tokens: integer
output_tokens: integer
input_cache_tokens: integer
request_headers_json: string
request_body_preview: string
response_headers_json: string
response_body_preview: string
preview_truncated: boolean
is_stream: boolean
created_at: string
```

### 2.6 `AuditEvent`

```text
id: integer
level: string
type: string
category: string
severity: string
actor: string
resource_type: string
resource_id: integer
message: string
client_name: string
model: string
endpoint: string
backend_name: string
created_at: string
```

### 2.7 Resource detail 响应

Backend、客户端密钥和 SOCKS5 代理 detail API 使用：

```json
{
  "overview": [
    { "key": "name", "label": "Name", "value": "example" }
  ],
  "configuration": [],
  "metadata": [],
  "raw": {},
  "activity": {
    "usage": [],
    "usage_logs": [],
    "events": [],
    "backends": []
  }
}
```

`overview`、`configuration`、`metadata` 是 `{key,label,value}` 数组。`activity` 内的空数组可能因 `omitempty` 被省略。

## 3. 系统与公开代理 API

### 3.1 健康检查

`GET /healthz`

- 鉴权：无。
- 请求：无。
- 成功响应：`200`。

```json
{ "ok": true }
```

### 3.2 查询公开模型

`GET /v1/models`

- 鉴权：客户端密钥。
- 请求：无。
- 成功响应：`200`，OpenAI-compatible list。

```json
{
  "object": "list",
  "data": [
    {
      "id": "gpt-4o",
      "object": "model",
      "owned_by": "token-gate"
    }
  ]
}
```

只汇总 `status=normal` backend 的模型。`models` 中含 `*`/`?` 的模式不会直接列出；`model_mapping` 的客户端侧 key 会列出，已作为映射目标出现的上游模型名不会重复列出。结果顺序未保证。此接口当前不会按客户端的 `allowed_models` 过滤。

### 3.3 上游代理接口

| 方法 | 路径 | 请求协议 |
| --- | --- | --- |
| `POST` | `/v1/chat/completions` | OpenAI Chat Completions-compatible |
| `POST` | `/v1/responses` | OpenAI Responses-compatible |
| `POST` | `/v1/embeddings` | OpenAI Embeddings-compatible |
| `POST` | `/v1/images/generations` | OpenAI Images-compatible |
| `POST` | `/v1/messages` | Anthropic Messages-compatible |
| `POST` | `/v1/messages/count_tokens` | Anthropic token counting-compatible |

路由层实际允许任意 HTTP 方法进入 `/v1/` handler，但以上是受支持的标准用法。其他精确路径会返回 `404 unsupported endpoint`。

网关只强制请求体是 JSON 对象且包含非空 `model`：

```json
{
  "model": "gpt-4o"
}
```

其余字段按相应 OpenAI/Anthropic API 结构传入并尽量透传。查询字符串和大部分客户端请求头也会转发，但客户端的 `Authorization`、`X-Api-Key` 会被移除，并替换为 backend 自己的凭据。

成功响应：

- 上游返回 2xx 时，保留上游状态码、响应头和响应体。
- SSE 上游响应保持 `text/event-stream`；普通响应通常为 JSON。
- 任一上游网络错误或非 2xx 会尝试下一个候选 backend；所有候选均失败时返回 Token Gate `503` 错误，不直接把最后一个上游非 2xx 返回给客户端。

请求选择规则：backend 必须为 `normal`，且 `models` 模式匹配请求模型或 `model_mapping` 存在同名客户端 key；然后按 `weight DESC, id ASC` 尝试。命中 `model_mapping` 时，发给上游的 `model` 会被改写。

#### `/v1/messages` 与 `/v1/responses` 跨协议转换

- 客户端调用 `/v1/messages`、命中 OpenAI backend 时，上游路径改为 `/v1/responses`，转换 `messages -> input`、`system -> instructions`、`max_tokens -> max_output_tokens`、停止序列、tools、tool choice、tool call/result，并把响应转回 Anthropic Messages 结构。
- 客户端调用 `/v1/responses`、命中 Anthropic backend 时，上游路径改为 `/v1/messages`，执行反向转换，并把响应转回 Responses 结构。
- JSON 和 SSE 均支持上述双向适配。
- `/v1/messages/count_tokens` 在 OpenAI backend 上也会进入 Messages-to-Responses 路径转换；其他 endpoint 不做跨协议转换。

## 4. Dashboard 与搜索 API

本节接口均无管理鉴权、无请求体。

### 4.1 总览

`GET /admin/api/overview`

成功响应 `200`：

```text
backends: BackendView[]          # 全部 backend
socks_proxies: integer          # 代理总数
client_keys: integer            # 客户端密钥总数
events: AuditEvent[]            # 最近 20 条
```

### 4.2 Dashboard 摘要

`GET /admin/api/dashboard/summary`

成功响应 `200`：

```json
{
  "cards": {
    "backends": { "count": 3, "enabled": 2, "failures": 1 },
    "client_keys": { "count": 4, "enabled": 2 },
    "proxies": { "count": 1 }
  },
  "counts": {
    "backends": 3,
    "client_keys": 4,
    "socks_proxies": 1
  },
  "growth": {
    "requests": 12.5,
    "errors": -5
  },
  "status": {
    "healthy_backends": 2,
    "recent_errors": 1,
    "active_clients": 2
  },
  "sparkline": [
    { "label": "Jul 13", "requests": 20 }
  ]
}
```

`growth` 比较当前 7 天与前 7 天；`recent_errors` 统计最近 24 小时；`sparkline` 是最近 7 天 UTC 日桶。`cards` 中值为 `0` 的 `enabled`、`successes`、`failures` 字段可能省略。

### 4.3 Dashboard 使用趋势

`GET /admin/api/dashboard/usage?range=7d`

查询参数：`range` 支持 `24h`/`1d`、`7d`、`30d`；其他值按 `7d` 处理。

成功响应 `200`：

```json
{
  "range": "7d",
  "series": [
    {
      "label": "Jul 13",
      "requests": 20,
      "successes": 18,
      "failures": 2,
      "latency_ms": 2400,
      "traffic_bytes": 123456,
      "error_rate": 10
    }
  ]
}
```

`24h` 返回 24 个 UTC 小时桶，其余返回 UTC 日桶。`successes`、`failures`、`latency_ms`、`traffic_bytes` 为 `0` 时可能省略；`latency_ms` 是桶内总耗时，不是平均值。

### 4.4 Dashboard 最近活动

`GET /admin/api/dashboard/activity`

成功响应 `200`：

```text
events: AuditEvent[]             # 最近 10 条
usage: UsageLog[]                # 最近 10 条
usage_logs: UsageLog[]           # 与 usage 相同，兼容字段
summary: Array<{category:string,count:integer}>
```

### 4.5 全局搜索

`GET /admin/api/search?q=alpha&limit=6`

| 参数 | 默认值 | 说明 |
| --- | --- | --- |
| `q` | `""` | 搜索词；空值直接返回各类空数组 |
| `limit` | `6` | 每一资源类别的上限；最大 `20` |

成功响应 `200`：

```json
{
  "query": "alpha",
  "results": {
    "backends": [],
    "client_keys": [],
    "proxies": [],
    "usage_logs": [],
    "events": []
  }
}
```

每个结果项结构为：

```text
kind: string
id: integer
title: string
subtitle: string
meta: object
status: string
target_page: string
target_id: integer
```

可搜索 backend 名称/base URL/status、客户端名称/token prefix、代理名称/address/username、usage request ID/client/model/backend，以及事件 type/message/backend/model。

## 5. Backend 管理 API

### 5.1 查询 Backend 列表

`GET /admin/api/backends?page=1&limit=10`

- 请求：通用分页参数。
- 成功响应：`200`，通用分页响应，`items` 为 `BackendView[]`。
- 错误：`500`。

列表中的嵌入 `Backend` 没有屏蔽凭据；非空 `api_key`、console 凭据和关联代理密码可能直接返回。

### 5.2 导出 Backend

`GET /admin/api/backends/export`

- 请求：无。
- 成功响应：`200`，并设置 `Content-Disposition: attachment; filename="token-gate-backends.json"`。

```json
{
  "backends": [
    {
      "name": "relay-a",
      "protocol": "openai",
      "backend_type": "new-api",
      "base_url": "https://api.example.com",
      "api_key": "secret",
      "console_url": "https://console.example.com",
      "tags": ["paid"],
      "console_username": "admin",
      "console_password": "secret",
      "console_authorization": "",
      "console_checkin_path": "",
      "channel_url": "",
      "console_cookie": "session=...",
      "console_account_json": "{}",
      "console_pricing_json": "{}",
      "notes": "",
      "proxy_id": 0,
      "status": "normal",
      "consecutive_failures": 0,
      "weight": 1,
      "models": ["gpt-4o"],
      "model_mapping": {}
    }
  ]
}
```

导出包含明文密钥。`endpoints` 当前不会出现在导出内容中。

### 5.3 导入 Backend

`POST /admin/api/backends/import`

请求体与导出结构相同。每个 item 支持导出示例中的全部字段，也能解码 `endpoints: string[]`，但当前导入逻辑不会保存 `endpoints`。

校验规则：

- `name` 必须非空，且不能与数据库或本次导入中的名称重复，比较时忽略大小写和首尾空格。
- `base_url` 必须是带 host 的 `http`/`https` URL；非空 `console_url` 同样校验。
- `proxy_id` 必须大于等于 `0`，非 `0` 时代理必须存在。
- `status` 为空时为 `normal`，否则只能是 `normal`、`abnormal`、`disabled`。
- `consecutive_failures` 不能为负数；`weight` 最小规范化为 `1`。

成功响应：`201`。

```json
{
  "imported": 1,
  "backends": [
    { "id": 1, "name": "relay-a" }
  ]
}
```

`backends` 中每项是完整 `Backend`。任一项失败时整个导入事务失败并返回 `400`。

### 5.4 创建 Backend

`POST /admin/api/backends`

请求体：

```json
{
  "name": "relay-a",
  "protocol": "openai",
  "backend_type": "new-api",
  "base_url": "https://api.example.com/v1",
  "api_key": "upstream-secret",
  "console_url": "https://console.example.com",
  "tags": ["paid", "primary"],
  "console_username": "admin",
  "console_password": "console-secret",
  "console_authorization": "",
  "console_checkin_path": "",
  "channel_url": "",
  "console_cookie": "session=...",
  "console_user_id": "123",
  "notes": "example",
  "proxy_id": 0,
  "status": "normal",
  "weight": 10,
  "models": ["gpt-4o", "gpt-4.1-*"],
  "model_mapping": { "gpt-public": "gpt-upstream" },
  "endpoints": []
}
```

字段行为：

- `base_url` 必须为有效 `http`/`https` URL；`console_url` 非空时也必须有效。
- `protocol` 会规范化：`anthropic`/`claude` -> `anthropic`，双协议别名 -> `both`，其他值 -> `openai`。
- `backend_type` 支持 `new-api` 和 `sub2api` 别名；其他非空值规范化为 `new-api`，空值保持空。
- `new-api` 只保存 `console_cookie`，会清空 sub2api 专属 authorization/check-in/channel 字段；`sub2api` 的行为相反。
- `console_user_id` 存入内部 `console_account_json.id`；空字符串会删除该 id。
- `proxy_id=0` 表示直连；其他值必须引用已存在代理。
- `status` 和 `endpoints` 虽可被当前 decoder 接受，但创建 handler 不使用它们；新 backend 状态为 `normal`，endpoint 列表为空。
- `weight < 1` 会保存为 `1`。

成功响应：`201` + 完整 `Backend`。校验、唯一约束等失败返回 `400`。

### 5.5 更新 Backend

`PUT /admin/api/backends/{id}`

请求字段与创建接口相同。该接口不是 PATCH：除下述例外，未提供的字段会使用 JSON 零值覆盖原值。

- 空 `protocol` 保留原值。
- 空 `api_key` 保留原值，因此不能用该接口把已有 API key 清空。
- 空 `status` 保留当前状态；只接受显式 `normal` 或 `disabled`。`abnormal` 是调度器管理状态，手工提交会返回 `400`。
- 未提供 `console_user_id` 时保留账户 JSON；提供空字符串时删除其中的 id。
- `console_password`、`console_url`、tags、notes、models、mapping 等未提供时会被清空。
- `endpoints` 被接受但不应用，原有内部值保持不变。

成功响应：`200` + 完整 `Backend`。资源不存在返回 `404`；路径、字段或引用无效返回 `400`。

### 5.6 删除 Backend

`DELETE /admin/api/backends/{id}`

成功响应：`200`。

```json
{ "deleted": 12 }
```

删除不存在的正整数 ID 也会返回上述成功结构；数据库错误返回 `500`。

### 5.7 Backend 详情

`GET /admin/api/backends/{id}/detail`

- 成功响应：`200`，Resource detail 结构。
- `overview` 包含名称、backend type、console 信息、状态、失败计数、恢复时间、代理、协议和权重。
- `configuration` 包含 API key 是否设置、tags、notes、models、mapping、base URL，以及已解析的账户/定价 JSON。
- `metadata` 包含 ID 和创建/更新时间。
- `raw` 是 `Backend`，但 `api_key`、`console_password`、`console_cookie` 被替换为 `"set"` 或 `""`；其他 console 字段仍按原值返回。
- `activity` 返回最近 10 条相关 usage log 和事件。
- 无效 ID 返回 `400`，资源不存在返回 `404`。

### 5.8 Console 请求日志结构

以下 console 接口返回的 `requests` 为实际访问 relay console 的请求记录：

```json
{
  "time": "2026-07-13T08:30:00.123Z",
  "method": "GET",
  "path": "/api/user/self",
  "status_code": 200,
  "body": "{\"success\":true}"
}
```

网络请求未获得响应时 `status_code` 为 `0`。`body` 可能包含 console 返回的敏感内容。

### 5.9 Console 签到

`POST /admin/api/backends/{id}/console/checkin`

- 请求体：无。
- 仅支持 `backend_type=new-api`，要求有效 `console_url`；可能使用已有 cookie/user ID，或使用 console 用户名和密码登录。
- 成功响应：`200`。

```json
{
  "backend": {},
  "checkin": {},
  "account": {},
  "requests": []
}
```

`backend` 为更新后的完整 `Backend`；`checkin`、`account` 结构取决于 new-api console。

失败响应在通用错误对象旁增加 `requests`：无效 backend/配置返回 `400`，console 失败返回 `502`，保存失败返回 `500`。

### 5.10 Console 定价同步

`POST /admin/api/backends/{id}/console/pricing`

- 请求体：无。
- 仅支持 `backend_type=new-api`，调用 console `/api/pricing`，并按 `focus_models` 配置过滤后保存。
- 成功响应：`200`。

```json
{
  "backend": {},
  "pricing": {},
  "requests": []
}
```

错误响应和状态码规则与 console 签到一致。

### 5.11 Console 全量同步

`POST /admin/api/backends/{id}/console/sync`

- 请求体：无。
- 支持 `new-api` 和 `sub2api`。
- `new-api` 同步 status、账户、按需签到和定价；`sub2api` 使用 `console_authorization` 同步账户，并按配置的路径执行签到和渠道/定价请求。

普通成功响应 `200`：

```json
{
  "backend": {},
  "status": {},
  "checkin": null,
  "account": {},
  "pricing": {},
  "requests": []
}
```

`new-api` 响应包含 `status`；`sub2api` 响应不包含 `status`。`checkin` 或 `pricing` 未执行时可为 `null`。普通模式错误与前述 console 错误结构相同，状态为 `400`、`502` 或 `500`。

#### NDJSON 流式模式

添加 `?stream=1` 或请求头 `Accept: application/x-ndjson`：

```http
POST /admin/api/backends/1/console/sync?stream=1
Accept: application/x-ndjson
```

响应 HTTP 状态固定先写为 `200`，每行一个 JSON 对象：

```json
{"type":"request","request":{"time":"...","method":"GET","path":"/api/status","status_code":200,"body":"..."}}
{"type":"complete","response":{"backend":{},"status":{},"checkin":null,"account":{},"pricing":{},"requests":[]}}
```

流式业务错误不会改变 HTTP 200，而是最后输出：

```json
{"type":"error","status":502,"message":"console error","requests":[]}
```

该模式是换行分隔 JSON（NDJSON），不是 SSE。

## 6. SOCKS5 代理管理 API

### 6.1 查询代理列表

`GET /admin/api/socks-proxies?page=1&limit=10`

- 成功响应：`200`，通用分页响应。
- `items` 为扩展后的 `SocksProxy[]`，增加 `bound_backend_count`、`request_count`、`traffic_bytes`、`avg_latency_ms`、可选 `last_used_at`。
- 错误：`500`。

### 6.2 创建代理

`POST /admin/api/socks-proxies`

```json
{
  "name": "proxy-a",
  "address": "127.0.0.1:1080",
  "username": "user",
  "password": "secret",
  "enabled": true
}
```

`address` 必须是 `host:port`，host 非空，端口在 `1..65535`。成功返回 `201` + `SocksProxy`；校验或唯一约束失败返回 `400`。

### 6.3 更新代理

`PUT /admin/api/socks-proxies/{id}`

请求体与创建相同，并按全量替换处理；例如省略 `password` 会清空密码，省略 `enabled` 会设为 `false`。

成功返回 `200` + `SocksProxy`；无效 ID/字段返回 `400`，资源不存在返回 `404`。

### 6.4 删除代理

`DELETE /admin/api/socks-proxies/{id}`

```json
{ "deleted": 3 }
```

删除时所有引用该代理的 backend 会先改为 `proxy_id=0`。不存在的正整数 ID 也返回 `200`；数据库错误返回 `500`。

### 6.5 代理详情

`GET /admin/api/socks-proxies/{id}/detail`

- 成功响应：`200`，Resource detail 结构。
- `overview`：名称、是否启用、关联 backend 数。
- `configuration`：地址、用户名。
- `metadata`：ID、创建和更新时间。
- `raw`：完整 `SocksProxy`，包括非空明文密码。
- `activity`：最近 10 条 usage log，以及全部关联 backend；关联 backend 也可能包含凭据。
- 无效 ID 返回 `400`，不存在返回 `404`。

## 7. 客户端密钥管理 API

### 7.1 查询客户端密钥列表

`GET /admin/api/client-keys?page=1&limit=10`

- 成功响应：`200`，通用分页响应。
- `items` 为扩展后的 `ClientKey[]`，增加 `masked_token`、`usage_count` 和可选 `last_used_at`。
- 当前基础 `ClientKey.token` 仍会返回明文 token；`masked_token` 并不意味着原字段已隐藏。
- 错误：`500`。

### 7.2 创建客户端密钥

`POST /admin/api/client-keys`

```json
{
  "name": "client-a",
  "token": "",
  "allowed_models": "gpt-4o,gpt-4.1",
  "enabled": true
}
```

`token` 为空时自动生成 `tg-...` token。成功返回 `201`：

```json
{
  "client": {},
  "issued_token": "tg-generated-token"
}
```

`client` 为完整 `ClientKey`。数据库唯一约束等失败返回 `400`；生成 token 失败返回 `500`。

### 7.3 更新客户端密钥

`PUT /admin/api/client-keys/{id}`

请求体与创建相同，但当前更新 handler 忽略 `token`，不会轮换或修改已有 token；`name`、`allowed_models`、`enabled` 按全量替换。

成功返回 `200`：

```json
{
  "client": {},
  "issued_token": ""
}
```

无效 ID/JSON 返回 `400`，资源不存在返回 `404`。

### 7.4 删除客户端密钥

`DELETE /admin/api/client-keys/{id}`

```json
{ "deleted": 4 }
```

不存在的正整数 ID 也返回 `200`；数据库错误返回 `500`。

### 7.5 客户端密钥详情

`GET /admin/api/client-keys/{id}/detail`

- 成功响应：`200`，Resource detail 结构。
- `overview`：名称、启用状态、token prefix、使用次数、最后使用时间。
- `configuration`：完整明文 token。
- `metadata`：ID、创建和更新时间。
- `raw`：完整 `ClientKey`。
- `activity`：最近 10 条 usage log 和事件。
- 无效 ID 返回 `400`，不存在返回 `404`，统计查询失败返回 `500`。

## 8. Usage Log 与统计 API

### 8.1 通用 Usage Log 过滤参数

以下参数用于列表、统计和条件删除：

| 参数 | 说明 |
| --- | --- |
| `backend` | Backend 名称 |
| `model` | 模型名称 |
| `client_key` | 客户端名称 |
| `proxy` | 代理名称；直连日志通常为 `direct` |
| `status` | 仅允许 `2xx`、`3xx`、`4xx`、`5xx` |
| `q` | 模糊搜索 request ID、trace ID、client、model、backend、path、error message |
| `date_from` | RFC 3339 起始时间 |
| `date_to` | RFC 3339 结束时间 |

无效 `status` 返回 `400`。无法解析的时间不会报错，而是被当作未提供。

### 8.2 查询 Usage Log 列表

`GET /admin/api/usage-logs?page=1&limit=10&backend=relay-a&status=2xx`

- 请求：通用分页参数 + 通用过滤参数。
- 成功响应：`200`，通用分页响应，`items` 为 `UsageLog[]`。
- 错误：过滤无效返回 `400`，存储错误返回 `500`。

### 8.3 Usage Log 汇总统计

`GET /admin/api/usage-logs/stats?backend=relay-a&status=2xx`

成功响应 `200`：

```json
{
  "totals": {
    "requests": 100,
    "successes": 98,
    "failures": 2
  },
  "latency": {
    "avg_ms": 123.4,
    "p95_ms": 300
  },
  "status_families": [
    { "family": "2xx", "count": 98 },
    { "family": "5xx", "count": 2 }
  ]
}
```

使用与列表相同的过滤参数和错误规则。

当前实现中 `successes` 统计 `200..399`，而 `failures` 使用“非 2xx”规则，因此 3xx 会同时进入二者；`status_families` 则按状态码族独立计数。

### 8.4 Usage Log 详情

`GET /admin/api/usage-logs/{id}`

成功响应 `200`：

```json
{
  "overview": {
    "request_id": "req-...",
    "status_code": 200,
    "backend": "relay-a",
    "model": "gpt-4o",
    "input_tokens": 10,
    "output_tokens": 20,
    "input_cache_tokens": 2
  },
  "request": {
    "bytes": 100,
    "body_preview": "...",
    "headers_json": "{}",
    "method": "POST",
    "path": "/v1/responses",
    "query": ""
  },
  "response": {
    "bytes": 200,
    "body_preview": "...",
    "headers_json": "{}",
    "status_family": "2xx",
    "is_stream": false
  },
  "metadata": {
    "id": 1,
    "trace_id": "req-...",
    "proxy_name": "direct",
    "preview_truncated": false,
    "created_at": "2026-07-13T08:30:00Z"
  },
  "raw": {}
}
```

`raw` 为完整 `UsageLog`。无效 ID 返回 `400`，不存在返回 `404`。

### 8.5 Usage Log 筛选选项

`GET /admin/api/usage-log-options`

成功响应 `200`：

```json
{
  "backends": ["relay-a"],
  "models": ["gpt-4o"],
  "client_keys": ["client-a"],
  "proxies": ["direct", "proxy-a"]
}
```

失败返回 `500`。

### 8.6 删除 Usage Log

`DELETE /admin/api/usage-logs`

- 不带过滤参数时清空全部 usage log。
- 带任一通用过滤参数时只删除匹配项。
- 无请求体。

成功响应 `200`：

```json
{
  "cleared": true,
  "filter": {
    "BackendName": "relay-a",
    "Model": "",
    "ClientName": "",
    "ProxyName": "",
    "Status": "",
    "Query": "",
    "DateFrom": "0001-01-01T00:00:00Z",
    "DateTo": "0001-01-01T00:00:00Z"
  },
  "deleted": 12
}
```

`filter` 当前直接序列化内部 Go 结构，因此字段名是 PascalCase，未提供的时间是 Go 零时间。无效 `status` 返回 `400`，存储错误返回 `500`。

### 8.7 Backend 小时/模型统计

`GET /admin/api/backend-hourly-model-stats`

查询参数：

| 参数 | 说明 |
| --- | --- |
| `backend` | 可选 backend 名称 |
| `model` | 可选模型名称 |
| `start_hour` | 可选 RFC 3339 时间，转换到 UTC 后必须整点 |
| `end_hour` | 可选 RFC 3339 时间，转换到 UTC 后必须整点；包含该小时 |

`start_hour > end_hour`、格式无效或非整点返回 `400`。

成功响应 `200`：

```json
{
  "query": {
    "backend": null,
    "model": null,
    "start_hour": "2026-07-13T07:00:00Z",
    "end_hour": "2026-07-13T08:00:00Z"
  },
  "scope": {
    "backends": [
      { "id": 1, "name": "relay-a" }
    ],
    "models": ["gpt-4o"],
    "time_range": {
      "start_hour": "2026-07-13T07:00:00Z",
      "end_hour": "2026-07-13T08:00:00Z",
      "timezone": "UTC"
    }
  },
  "items": [
    {
      "backend_id": 1,
      "backend": "relay-a",
      "model": "gpt-4o",
      "hour": "2026-07-13T08:00:00Z",
      "requests": 10,
      "successes": 9,
      "failures": 1,
      "input_tokens": 100,
      "output_tokens": 50,
      "input_cache_tokens": 20,
      "success_avg_duration_ms": 123.4,
      "success_request_bytes": 1000,
      "success_response_bytes": 5000
    }
  ]
}
```

统计中的 token、平均耗时和字节数只累计成功请求；`requests = successes + failures`。存储错误返回 `500`。

## 9. 审计事件 API

### 9.1 通用事件过滤参数

| 参数 | 说明 |
| --- | --- |
| `category` | 事件类别 |
| `severity` | 严重级别 |
| `actor` | 操作者 |
| `backend` | Backend 名称 |
| `q` | 模糊搜索 |
| `date_from` | RFC 3339 起始时间 |
| `date_to` | RFC 3339 结束时间 |

无法解析的时间被当作未提供，不返回 `400`。

### 9.2 查询事件列表

`GET /admin/api/events?page=1&limit=10&category=backend`

- 请求：通用分页参数 + 通用事件过滤参数。
- 成功响应：`200`，通用分页响应，`items` 为 `AuditEvent[]`。
- 错误：`500`。

### 9.3 事件汇总

`GET /admin/api/events/summary?category=backend`

使用通用事件过滤参数。成功响应 `200`：

```json
{
  "total": 20,
  "categories": [
    { "category": "backend", "count": 10 }
  ],
  "severities": [
    { "severity": "warn", "count": 2 }
  ],
  "actors": [
    { "actor": "system", "count": 20 }
  ],
  "time_series": []
}
```

`time_series` 当前固定为空数组。失败返回 `500`。

### 9.4 事件详情

`GET /admin/api/events/{id}`

成功响应 `200`：

```json
{
  "overview": {
    "type": "backend_failover",
    "message": "...",
    "category": "backend",
    "severity": "warn",
    "actor": "system",
    "backend": "relay-a",
    "client_name": "client-a",
    "model": "gpt-4o",
    "endpoint": "responses"
  },
  "configuration": {},
  "metadata": {
    "id": 1,
    "created_at": "2026-07-13T08:30:00Z",
    "resource_type": "backend",
    "resource_id": 1
  },
  "raw": {},
  "activity": {}
}
```

`raw` 为完整 `AuditEvent`。无效 ID 返回 `400`，不存在返回 `404`。

### 9.5 清空事件

`DELETE /admin/api/events`

查询参数会被忽略，始终清空全部事件。成功响应 `200`：

```json
{
  "cleared": true,
  "deleted": 20
}
```

数据库错误返回 `500`。

## 10. 配置 API

所有配置值在 HTTP API 中均为字符串。

### 10.1 查询配置

`GET /admin/api/config`

成功响应 `200`：

```json
{
  "listen_addr": ":8080",
  "db_path": "./token-gate.db",
  "log_level": "info",
  "backend_cooldown": "10m0s",
  "backend_fails": "3",
  "backend_console_user_agent": "Token-Gate/1.0",
  "focus_models": "",
  "request_timeout": "30s",
  "shutdown_timeout": "10s"
}
```

数据库中存在非空值时优先返回数据库值，否则返回当前进程配置默认值。失败返回 `500`。

### 10.2 更新配置

`PUT /admin/api/config`

请求体为字符串 map，可只发送要修改的键：

```json
{
  "log_level": "debug",
  "backend_cooldown": "5m",
  "backend_fails": "5",
  "backend_console_user_agent": "Token-Gate/1.1",
  "focus_models": "gpt-4o,gpt-4.1-*",
  "request_timeout": "45s",
  "shutdown_timeout": "15s"
}
```

已知字段校验：

- `log_level`：`debug`、`info`、`warn`、`warning`、`error`。
- `backend_cooldown`、`request_timeout`、`shutdown_timeout`：Go duration，例如 `30s`、`5m`。
- `backend_fails`：可由 `strconv.Atoi` 解析的整数；handler 没有限制正数。
- `backend_console_user_agent`：去空格后非空、最长 512 字符，且不能含 CR/LF。

其他键也会被保存，但不会出现在 GET 的固定响应字段中。成功返回 `200`，响应与 `GET /admin/api/config` 相同；校验失败返回 `400`，保存失败返回 `500`。

更新会立即修改 handler 持有的部分进程配置，但已经创建的 scheduler、proxy client、HTTP server 和数据库连接不会全部随之重建。尤其 `listen_addr`、`db_path`、`shutdown_timeout` 的 settings 值不会改变 `cmd/token-gate` 当前使用的监听器、数据库或关闭超时；这些启动参数应通过对应 `TG_*` 环境变量配置后重启进程。

### 10.3 从数据库重载配置

`POST /admin/api/config/reload`

- 请求体：无。
- 从 settings 表重新读取可热加载字段。
- 成功响应：`200`。

```json
{ "status": "reloaded" }
```

读取失败返回 `500`。该接口不会重建 scheduler/proxy client、重启进程，也不会切换监听地址或数据库。

## 11. 非 API 路由

- `GET /` 返回 `307 Temporary Redirect`，目标为 `/admin/`。
- 未注册路径返回 `404`。
- `/admin/` 是管理控制台页面路径，不属于 JSON API；其实际静态资源是否可用取决于部署时的前端构建/静态文件服务配置。
