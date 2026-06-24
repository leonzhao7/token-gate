# Token Gate Design

## 目标

Token Gate 是一个面向 OpenAI-compatible 与 Anthropic-compatible 上游的 AI 网关。

它对外提供统一的 `base_url` 与客户端 `api_key`，对内维护多个 backend，并基于请求的 endpoint、model、backend 状态与 weight 选择上游节点。系统同时提供一个内嵌的管理台，用于管理 backends、client keys、SOCKS5 proxies，以及查看 usage logs / events / dashboard。

核心目标：

- 客户端只感知 Token Gate，不需要知道真实上游地址。
- Token Gate 对大多数 endpoint 保持请求/响应尽量透明；仅在 `/v1/messages` 与 `/v1/responses` 之间做受控跨协议适配。
- backend 选择基于当前持久化配置与运行态故障状态。
- backend 首次失败或返回非 2xx 时，可以自动切换到下一个候选。
- 管理员可以在同一个 backend 资源上维护路由配置和 relay-station console metadata。
- 系统保留足够的 usage logs、audit events 和 dashboard 摘要，支持问题排查。

非目标：

- 不再支持 policy / pool / placement / route-group 这类独立调度层。
- 不做 OpenAI Chat 与 Claude Messages 之间的协议转换。
- 除 `/v1/messages` 与 `/v1/responses` 之外，不做其他 endpoint 的跨协议转换。
- 不伪造官方客户端专有身份、设备指纹或特殊签名。
- 不保存完整请求体或完整响应体，只保存预览和 redacted headers。
- 不做主动 backend health check；backend 运行态只来自真实流量结果。

## 总体架构

```text
OpenAI SDK / Claude SDK / custom client
        |
        | base_url + client api_key
        v
Token Gate public API
        |
        | authenticate client key
        | detect endpoint
        | extract model
        v
Scheduler
        |
        | list backends from SQLite
        | filter by status / model
        | sort by weight desc, id asc
        v
Proxy + Protocol Adapter
        |
        | apply backend auth
        | optional SOCKS5 egress
        | preserve path/query/body/streaming
        | translate only messages <-> responses when needed
        v
OpenAI-compatible / Anthropic-compatible upstream backends
```

主要模块：

- `cmd/token-gate`
  - 进程入口。
- `internal/config`
  - 环境变量配置读取。
- `internal/domain`
  - 核心类型与常量，例如 `Backend`、`ClientKey`、`UsageLog`、endpoint/status/protocol 常量。
- `internal/store`
  - SQLite schema、inline compatibility migration、CRUD、detail 查询、dashboard 聚合、usage/event 检索。
- `internal/scheduler`
  - backend 候选筛选、排序，以及故障/恢复状态写回。
- `internal/proxy`
  - 上游转发、鉴权头替换、SOCKS5 egress，以及仅限 `/v1/messages` <-> `/v1/responses` 的请求/响应转换。
- `internal/app`
  - 公开 API、管理 API、认证、日志与聚合响应。
- `internal/app/web`
  - 内嵌的管理台静态页面与前端 JS 模块。

## 公开 API

当前支持的公开端点：

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/embeddings`
- `POST /v1/images/generations`
- `POST /v1/messages`
- `POST /v1/messages/count_tokens`

说明：

- `/v1/models`
  - 返回当前所有 `status=normal` backend 暴露出来的模型集合。
  - 精确模型名会直接出现在结果里。
  - `model_mapping` 的 key 也会作为客户端可见模型暴露。
  - 通配模型模式不会直接出现在列表中。
- `/v1/chat/completions`、`/v1/responses`、`/v1/embeddings`、`/v1/images/generations`
  - 按 OpenAI-compatible 方式透传。
- `/v1/messages`、`/v1/messages/count_tokens`
  - 按 Anthropic-compatible Messages API 透传。
  - 当 backend 协议不同且目标是 `/v1/responses` 时，`/v1/messages` 会被转换后再转发。
  - 当 backend 协议不同且目标是 `/v1/messages` 时，`/v1/responses` 会被转换后再转发。

## 转发与协议转换规则

代理层对大多数 endpoint 尽量保持应用层透明：

- 保留 HTTP method。
- 保留 path 与 query。
- 保留原始请求 body。
- 保留绝大多数普通请求 headers。
- 保留上游响应 body。
- 保留绝大多数普通响应 headers。
- 如果响应是 `text/event-stream`，按流式方式边读边写并 flush。

受控例外：

- 当客户端请求 `/v1/messages` 且命中的 backend 协议是 `openai` 时：
  - 上游 path 改写为 `/v1/responses`
  - 请求/响应在 Anthropic Messages 与 OpenAI Responses 之间双向转换
- 当客户端请求 `/v1/responses` 且命中的 backend 协议是 `anthropic` 时：
  - 上游 path 改写为 `/v1/messages`
  - 请求/响应在 OpenAI Responses 与 Anthropic Messages 之间双向转换
- 以上转换同时覆盖：
  - 普通 JSON 响应
  - `text/event-stream` 流式响应
  - 工具定义 / tool choice
  - tool call / tool result 内容块
- 其他 endpoint 不做协议转换，仍按原 path/body/response shape 转发。

必要改写：

- 客户端 key 支持：
  - `Authorization: Bearer <token>`
  - `X-Api-Key: <token>`
- 转发到 `openai` backend 时：
  - 删除客户端鉴权头。
  - 写入 `Authorization: Bearer <backend_api_key>`。
- 转发到 `anthropic` backend 时：
  - 删除客户端鉴权头。
  - 写入 `X-Api-Key: <backend_api_key>`。
- 删除 hop-by-hop headers，例如：
  - `Connection`
  - `Transfer-Encoding`
  - `Upgrade`
- 不转发客户端原始 `Host` 与 `Content-Length`。

透明性的边界：

- 上游看到的是 Token Gate 出口 IP，或者被绑定的 SOCKS5 proxy 出口 IP。
- 上游看到的是 backend 配置中的 API key，而不是客户端 key。
- 如果上游依赖 TLS 指纹、专用 header 或设备特征，Token Gate 不做规避。

## 请求处理流程

```text
1. 客户端请求 /v1/...
2. 从 Authorization Bearer 或 X-Api-Key 提取 client token
3. 查询 client_keys，验证 key 存在且 enabled
4. 根据 path 判断 endpoint
5. 读取 JSON body，并提取 model
6. Scheduler 选择候选 backend 列表
7. 依次尝试候选 backend
8. 如果 backend 请求失败或上游返回非 2xx，则切到下一个候选
9. 一旦有成功响应，按客户端协议返回；如果命中了 `/v1/messages` <-> `/v1/responses` 适配，则先做响应转换
10. 记录 usage log 与必要的 audit event
11. 根据结果更新 backend status / consecutive_failures / recover_at
```

限制：

- 公开代理路径要求 body 中存在 `model` 字段。
- `GET /v1/models` 不走上述 body 提取流程。
- 只支持当前代码显式识别的公开路径；未知 `/v1/...` 路径返回 `404`。

## 调度模型

当前调度是纯 backend-centric 的，没有 policy 层。

`scheduler.SelectBackend(endpoint, model)` 的流程：

1. 先执行 `RecoverExpiredBackends`，把已过冷却时间的 abnormal backend 恢复成 normal。
2. 读取全部 backends。
3. 过滤条件：
  - `backend.status == normal`
  - backend 支持当前 model，或者 `model_mapping` 中存在该客户端模型的精确映射
4. 对候选集排序：
  - `weight DESC`
  - tie-break 为 `id ASC`
5. 返回排序后的候选列表。

当前没有：

- policy priority
- placement mode
- sticky / pack / spread
- backend pool
- route_mode_override
- route_group

### endpoint 与协议适配

当前 endpoint 常量：

- `chat`
- `responses`
- `embeddings`
- `images`
- `messages`
- `models`

当前调度器不会再用 backend 的 `endpoints` 字段过滤候选。

现行规则是：

- 调度阶段只按 `status` 和 `model` / `model_mapping` 选出候选 backend
- 代理阶段再根据请求 path 与 backend `protocol` 决定：
  - 是否原样转发
  - 是否只对 `/v1/messages` 与 `/v1/responses` 做跨协议转换
- `endpoints` 字段仍然保留在 backend 资源与管理台里，作为配置元数据展示，但不再主导调度。

### model 匹配

backend 的 `models` 使用字符串列表定义能力，支持：

- 精确匹配，例如 `gpt-4o`
- glob 匹配，例如 `claude-*`
- `*`

如果 `models` 不直接匹配，调度器还会检查 `model_mapping`：

- `model_mapping` 的 key 是客户端请求模型名。
- `model_mapping` 的 value 是转发给上游时要替换成的模型名。
- 只支持 key 的精确匹配，不支持映射 key 上的 glob。

## backend 运行态与故障处理

backend 运行态保存在 SQLite 的 `backends` 表中：

- `status`
  - `normal`
  - `abnormal`
  - `disabled`
- `consecutive_failures`
- `recover_at`

运行规则：

- 只有 `normal` backend 会参与调度。
- `disabled` backend 永远不参与调度，只能由管理员手动改回 `normal`。
- `abnormal` backend 也不参与调度，直到 `recover_at` 到期并被恢复。

### 失败与恢复

- backend 请求成功时：
  - `status -> normal`
  - `consecutive_failures -> 0`
  - `recover_at -> ''`
- backend 请求失败或上游返回非 2xx 时：
  - `consecutive_failures + 1`
  - 当连续失败达到 `TG_BACKEND_FAILS` 阈值后：
    - `status -> abnormal`
    - `recover_at -> now + TG_BACKEND_COOLDOWN`
- 每次选择 backend 之前会调用恢复逻辑：
  - `status == abnormal`
  - `recover_at <= now`
  - 则恢复成 `normal`

### failover 触发条件

当前代理层的 failover 逻辑比统计口径更宽：

- 以下情况会尝试下一个候选 backend：
  - 建连失败
  - 请求发送失败
  - 代理/读取过程出错
  - 上游返回任意非 `2xx`
- 只要还有下一个候选，就继续尝试。
- 当前没有单独的 `failover_enabled` 开关。

注意：

- usage/dashboard 里的“failure”统计口径使用 `domain.IsBackendFailureStatus`：
  - 所有 `5xx`
  - 所有 `4xx`，但排除 `400`
- 因此：
  - `3xx` 或 `400` 在代理层会触发 failover
  - 但不会计入 dashboard/backend summary 的 failure 统计

## 数据模型

### client_keys

存储客户端访问 Token Gate 的 key。

主要字段：

- `name`
- `token_hash`
- `token`
- `token_prefix`
- `enabled`
- `created_at`
- `updated_at`

说明：

- 鉴权基于 `token_hash`。
- 明文 `token` 仍保存在 SQLite 中，便于管理台显示与编辑。

### socks_proxies

存储可复用的 SOCKS5 出口代理。

主要字段：

- `name`
- `address`
- `username`
- `password`
- `enabled`
- `created_at`
- `updated_at`

说明：

- `enabled=false` 的 proxy 如果仍被 backend 绑定，请求会失败，不会静默直连。

### backends

存储上游 API 节点与 relay-station console metadata。

主要字段：

- 路由与协议：
  - `name`
  - `protocol`
  - `base_url`
  - `api_key`
  - `proxy_id`
  - `status`
  - `consecutive_failures`
  - `recover_at`
  - `weight`
  - `model_list`
  - `model_mapping`
  - `endpoint_list`
- 管理台 console metadata：
  - `console_url`
  - `tag_list`
  - `console_username`
  - `console_password`
  - `notes`

语义说明：

- `base_url`
  - 真正的上游 API 地址。
- `api_key`
  - 真正转发请求时使用的上游鉴权 secret。
- `console_url`
  - relay-station 控制台地址，只用于管理员查看。
- `console_username` / `console_password`
  - relay-station 控制台登录信息，只作为元数据保存，不参与转发鉴权。
- `tags`
  - 轻量标签，用于管理台搜索和分组观察。

### usage_logs

存储每次公开代理请求的结果摘要。

主要内容：

- client / backend / proxy 标识
- endpoint / model
- status code / status family
- attempts / duration / traffic bytes
- redacted request / response headers
- request / response preview
- trace / request ID

说明：

- 请求/响应 body 只保存预览，不保存完整正文。
- status family 既可以持久化，也可以从 status code 推导。

### audit_events

记录低频运维事件与配置变更。

常见事件来源：

- backend create / update
- 代理失败重试
- backend failover
- 上游异常

## 管理 API

管理 API 使用 `TG_ADMIN_TOKEN` 认证。

认证方式：

- `Authorization: Bearer <TG_ADMIN_TOKEN>`
- `X-Admin-Token: <TG_ADMIN_TOKEN>`

当前主要管理 API：

- Dashboard / search
  - `GET /admin/api/overview`
  - `GET /admin/api/dashboard/summary`
  - `GET /admin/api/dashboard/usage`
  - `GET /admin/api/dashboard/activity`
  - `GET /admin/api/search`
- SOCKS proxies
  - `GET /admin/api/socks-proxies`
  - `GET /admin/api/socks-proxies/{id}/detail`
  - `POST /admin/api/socks-proxies`
  - `PUT /admin/api/socks-proxies/{id}`
  - `DELETE /admin/api/socks-proxies/{id}`
- Backends
  - `GET /admin/api/backends`
  - `GET /admin/api/backends/{id}/detail`
  - `POST /admin/api/backends`
  - `PUT /admin/api/backends/{id}`
  - `DELETE /admin/api/backends/{id}`
- Client keys
  - `GET /admin/api/client-keys`
  - `GET /admin/api/client-keys/{id}/detail`
  - `POST /admin/api/client-keys`
  - `PUT /admin/api/client-keys/{id}`
  - `DELETE /admin/api/client-keys/{id}`
- Events
  - `GET /admin/api/events`
  - `GET /admin/api/events/summary`
  - `GET /admin/api/events/{id}`
- Usage logs
  - `GET /admin/api/usage-logs`
  - `GET /admin/api/usage-logs/stats`
  - `GET /admin/api/usage-logs/{id}`
  - `GET /admin/api/usage-log-options`
  - `DELETE /admin/api/usage-logs`

## 管理台

管理台是嵌入二进制的静态 Web 页面，通过 `/admin/` 访问，没有单独的前端构建步骤。

当前主要页面：

- `Dashboard`
  - summary cards
  - usage chart
  - recent events
  - recent usage
- `Backends`
  - relay-station 视角的 backend 列表
  - 主要列：
    - Name
    - Console URL
    - Status
    - Tags
    - Models
    - Requests 1h
    - Failures 1h
    - Avg Latency
  - expanded row 展示：
    - console username
    - console password presence
    - proxy
    - base URL
    - notes
    - endpoints / mapping
    - recent usage snapshot
  - drawer detail 展示 overview / configuration / metadata / activity
- `Client Keys`
  - CRUD、list、detail drawer
- `Usage Logs`
  - 过滤、分页、stats、detail
- `Events`
  - timeline、summary、detail
- `Settings`
  - 本地 console/admin token 等状态摘要

注意：

- backend 列表与 detail 中不会明文展示 `console_password` 或 `api_key`；只展示 `"set"`。
- embedded UI 修改后，需要重启 Go 进程才能在浏览器里看到新资源。

## 搜索与观测

### 全局搜索

`/admin/api/search` 当前支持搜索：

- backends
- client keys
- proxies
- usage logs
- events

store 侧的 backend 搜索结果当前主要来自：

- `name`
- `base_url`
- `status`

前端资源页自己的 backend 搜索则包含更多字段：

- `name`
- `base_url`
- `console_url`
- `status`
- `console_username`
- `notes`
- `tags`
- `models`
- `endpoints`

### usage logs

usage logs 支持：

- `backend`
- `model`
- `client_key`
- `proxy`
- `status`
- `q`
- `date_from`
- `date_to`

其中 `status` 过滤只接受：

- `2xx`
- `3xx`
- `4xx`
- `5xx`

### backend 列表统计

backend 列表聚合了三类统计：

- `hourly_requests`
  - 最近 1 小时 usage log 总数。
- `hourly_failures`
  - 最近 1 小时 failure 口径内的 usage log 数量。
- `avg_latency_ms`
  - 现有 usage summary 的平均延迟字段。

expanded row 还会显示：

- 最近 30 分钟 success / failure 摘要。

## 安全设计

当前安全模型比较直接，偏向单机管理便利性：

- client 明文 token 存在 SQLite 中，便于管理台展示和编辑。
- backend `api_key` 与 `console_password` 也存储在 SQLite 中。
- 管理 API 只有一个全局 admin token。
- usage log / event / detail 响应尽量避免明文暴露 secret：
  - headers 做 redaction
  - detail/raw 对 `api_key`、`console_password` 做 presence masking

生产环境建议：

- 在反向代理或 LB 层做 HTTPS termination。
- 为 `TG_ADMIN_TOKEN` 使用强随机值。
- 限制 `/admin/` 与 `/admin/api/` 的来源 IP。
- 对 SQLite 文件设置严格权限。
- 如需更强安全性，再引入 KMS 或本机密钥加密 backend secrets。

## 配置

主要环境变量：

- `TG_LISTEN_ADDR`
- `TG_DB_PATH`
- `TG_ADMIN_TOKEN`
- `TG_LOG_LEVEL`
- `TG_BACKEND_COOLDOWN`
- `TG_BACKEND_FAILS`
- `TG_REQUEST_TIMEOUT`
- `TG_SHUTDOWN_TIMEOUT`

说明：

- `TG_BACKEND_COOLDOWN`
  - backend 达到失败阈值后进入 abnormal 的冷却时长。
- `TG_BACKEND_FAILS`
  - 连续失败多少次后进入 abnormal。
- `TG_REQUEST_TIMEOUT`
  - 上游 response header timeout。

## 测试策略

当前测试主要覆盖：

- scheduler 的 endpoint/model/status/weight 选择逻辑
- backend 连续失败、abnormal 恢复与手动状态更新
- 代理层对大多数 endpoint 的 path/query/body/header 透明转发
- `/v1/messages` 与 `/v1/responses` 的受控跨协议请求/响应转换
- OpenAI / Anthropic 两种 backend auth 头替换
- SOCKS5 proxy 绑定与禁用代理失败行为
- SSE 透传与 flush
- app 层 backend/client/proxy CRUD
- usage logs / events / dashboard API
- backend console metadata 的 store/API/UI round-trip
- backend list 的 hourly counters、relay-station 列布局与 detail masking

常用命令：

```bash
GOCACHE=/root/workspace/token-gate/.gocache go test ./...
node --test internal/app/web/*.test.mjs
```

## 已知限制

- `internal/app/app.go` 体积较大，仍是高频改动点。
- backend 搜索在 store 全局搜索和前端资源页搜索之间，字段覆盖范围并不完全一致。
- 当前没有 Prometheus exporter。
- 当前没有 per-client rate limit。
- 当前没有 per-backend max concurrency。
- 当前没有后台主动 health check。
- 当前只支持 JSON body 中读取 `model`，不支持 multipart 等复杂协议。

## 后续方向

- 继续收敛和拆分 `internal/app/app.go` 的职责边界。
- 增加更细的 backend 并发与限流控制。
- 引入 Prometheus metrics 或更标准的观测导出。
- 如果需要更强安全模型，再处理 backend secret 加密与 admin session/RBAC。
