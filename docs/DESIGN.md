# Token Gate Design

## 目标

Token Gate 是一个 AI 透明代理。它对外提供统一的 `base_url` 和客户端 `api_key`，对内连接多个 OpenAI-compatible 或 Claude/Anthropic 后端 LLM 服务，并根据请求模型自动选择合适后端。

核心目标：

- 客户端只感知 Token Gate，不需要知道真实后端 LLM 服务。
- 后端服务按模型、端点、运行态冷却状态和调度策略被自动选择。
- 同一客户端访问同一模型时默认稳定落到同一后端。
- 后端不可用时，自动切到下一个可用候选。
- 请求体和响应体不改写，支持 JSON 和 SSE 流式响应透传。
- 提供轻量 Web 管理台和管理 API。

非目标：

- 不做跨厂商请求体适配；OpenAI Chat/Responses 和 Claude Messages 必须由客户端按对应协议发起，后端也必须支持对应协议。
- 不伪造官方客户端专有身份、签名或设备指纹。
- 不在流式响应已经开始输出后做无损切换。
- 不保存完整请求体或响应体日志。

## 总体架构

```text
OpenAI SDK / Claude SDK / AI Client
        |
        | base_url + client api_key
        v
Token Gate Public API
        |
        | authenticate client key
        | extract endpoint + model
        v
Scheduler
        |
        | filter by model / endpoint / pool / cooldown
        | rank by placement policy
        v
Transparent Proxy
        |
        | rewrite auth header by backend protocol
        | preserve method / path / query / body
        v
OpenAI-compatible / Claude-compatible Backend LLM Servers
```

主要模块：

- `cmd/token-gate`: 程序入口。
- `internal/app`: HTTP 路由、管理 API、公开 API。
- `internal/proxy`: 透明转发、SSE 透传。
- `internal/scheduler`: backend 筛选、调度策略、运行时失败和冷却状态。
- `internal/store`: SQLite schema 和 CRUD。
- `internal/domain`: 核心类型和常量。
- `internal/app/web`: 管理台静态资源。

## 公开 API

当前支持的公开端点：

- `GET /v1/models`
- `POST /v1/chat/completions`
- `POST /v1/responses`
- `POST /v1/embeddings`
- `POST /v1/images/generations`
- `POST /v1/messages`
- `POST /v1/messages/count_tokens`

`/v1/images/generations` 用于兼容 `gpt-image-2` 等图像生成模型。代理层不解释图像参数，也不转换 URL/base64 响应格式，后端必须本身兼容 OpenAI images API。

`/v1/messages` 和 `/v1/messages/count_tokens` 用于兼容 Claude/Anthropic Messages API。代理层不解释 `messages`、`max_tokens`、`system`、`tools` 等字段，也不转换 OpenAI Chat 格式和 Claude Messages 格式。

## 透明转发规则

代理层会尽量保持应用层透明：

- 保留 HTTP method。
- 保留 path 和 query。
- 保留原始请求 body。
- 保留普通请求 header。
- 保留上游响应 body。
- 保留普通响应 header。
- SSE 响应按流式方式边读边写，并触发 flush。

必要改写：

- 入站客户端 key 可来自 `Authorization: Bearer <token>` 或 `X-Api-Key: <token>`。
- 出站到 `openai` backend 时，删除客户端鉴权头并写入 `Authorization: Bearer <backend_api_key>`。
- 出站到 `anthropic` backend 时，删除客户端鉴权头并写入 `X-Api-Key: <backend_api_key>`。
- 删除 hop-by-hop headers，例如 `Connection`、`Transfer-Encoding`、`Upgrade`。
- 不转发客户端原始 `Host` 和 `Content-Length`。

透明性边界：

- 后端网络层会看到请求来自 Token Gate 出口 IP；如果 Backend 绑定 SOCKS5 代理，则会看到 SOCKS5 代理出口 IP。
- 后端会看到 Token Gate 配置的 backend API key。
- 如果后端根据 TLS 指纹、出口 IP 或专有 header 判断来源，Token Gate 不做规避。

## 请求处理流程

```text
1. 客户端请求 /v1/...
2. 从 `Authorization: Bearer <token>` 或 `X-Api-Key: <token>` 提取客户端 key
3. 查询 client_keys，验证 key 是否启用
4. 根据请求 path 判断 endpoint
5. 从 JSON body 读取 model
6. Scheduler 选择候选 backend 列表
7. 按候选顺序请求 backend
8. 若首个 backend 在首包前失败或返回可重试状态，尝试下一个
9. 将成功 backend 的响应原样返回客户端
10. 记录必要的审计事件和运行态失败信息
```

可重试状态：

- 连接失败
- 请求发送失败
- 响应头超时
- HTTP `429`
- HTTP `5xx`，但不包括 `501 Not Implemented`

不可无损重试：

- 响应已经开始写给客户端后失败。
- SSE 流中途断开。
- 客户端主动取消请求。

## 调度模型

调度分两层：

1. Eligibility: 先筛选可用 backend。
2. Placement: 再按策略排序候选 backend。

Eligibility 条件：

- backend 已启用。
- backend 支持请求 endpoint。
- backend 支持请求 model。
- 如果 model policy 指定了 backend pool，则 backend 必须属于该 pool。
- backend 未处于冷却期；如果全部候选都处于冷却期，则直接返回失败。

模型匹配支持：

- 精确匹配，例如 `gpt-4o`。
- 通配匹配，例如 `gpt-image-*`。
- 全匹配 `*`。

endpoint 匹配支持：

- `chat`
- `responses`
- `embeddings`
- `images`
- `messages`
- `models`
- `*`

## Placement Policy

Token Gate 支持三种 placement policy。

### sticky

默认策略。

```text
route_key = client_api_key_hash + "|" + model
```

特点：

- 同一客户端 key 请求同一模型，稳定落到同一 backend。
- 不同客户端通常会自然分散。
- backend 增减时，只有部分 key 会迁移。

适用场景：

- 希望用户体验稳定。
- 后端有上下文缓存、模型冷启动或供应商侧缓存。

### pack

集中策略。

```text
route_key = route_group + "|" + model
```

特点：

- 同一 `route_group` 下，不同客户端访问同一模型时优先落到同一 backend。
- 如果客户端没有设置 `route_group`，默认使用 `shared`。

适用场景：

- 希望相同模型的请求尽量集中。
- 希望减少后端模型冷启动或缓存碎片。

### spread

分散策略。

```text
route_key = client_api_key_hash + "|" + model
score = rendezvous_score / (active_requests + 1)
```

特点：

- 保留一定稳定性。
- 同时根据当前活跃请求数做偏置，让请求更倾向分散到较空闲 backend。

适用场景：

- 希望不同客户端请求同一模型时尽量分散。
- 后端并发能力有限，需要更均衡的活跃负载。

## Rendezvous Hashing

候选 backend 使用 rendezvous hashing 排序：

```text
score = weight / -ln(hash(route_key, backend_identity))
```

优势：

- 选择结果稳定。
- backend 增减时扰动较小。
- 支持 backend weight。
- 不需要持久化大量 sticky 绑定。

backend identity 当前由 backend `name` 和 `base_url` 参与计算。

## 故障处理

Token Gate 不自动探测 backend health，不会后台周期性请求上游。运行态只来自真实代理请求。

被动失败：

- 代理请求失败或返回可重试状态时，调用 `MarkFailure`。
- backend 连续失败达到阈值后进入冷却期。
- 连续失败越多，冷却时间越长，当前上限为 5 倍基础冷却时间。

恢复：

- 代理请求成功时，清空失败计数和冷却状态。

故障切换：

- 如果 model policy 开启 `failover_enabled`，请求会按候选顺序尝试。
- 如果上游返回可重试状态，当前响应体会被丢弃，再尝试下一个 backend。
- 一旦某个 backend 响应被写给客户端，后续不再切换。

## 数据库设计

数据库使用 SQLite，开启 WAL 模式。

适用假设：

- 单机部署。
- 配置和审计数据规模较小。
- 单表记录不超过 5 万。

### client_keys

存储客户端访问 Token Gate 的 key。

主要字段：

- `name`: 客户端名称。
- `token_hash`: 客户端 token 的 SHA-256 hash。
- `token`: 客户端 token 明文，用于管理台编辑和展示；鉴权仍使用 `token_hash`。
- `token_prefix`: 展示用 token 前缀。
- `enabled`: 是否启用。
- `route_mode_override`: 可选，覆盖模型默认 placement policy。
- `route_group`: `pack` 模式下使用的分组。

### backends

存储后端 LLM 服务配置。

主要字段：

- `name`: backend 名称。
- `pool`: backend 池，用于模型策略限制候选范围。
- `protocol`: 后端协议，`openai` 或 `anthropic`，默认 `openai`。
- `base_url`: 后端 base URL，例如 OpenAI-compatible `/v1` 或 Anthropic `/v1`。
- `api_key`: 后端 API key。
- `proxy_id`: 可选 SOCKS5 代理 ID，`0` 表示直连。
- `enabled`: 是否启用。
- `weight`: 调度权重。
- `model_list`: JSON 数组，支持精确模型和通配模式。
- `endpoint_list`: JSON 数组，声明支持的 endpoint。

### socks_proxies

存储可复用的 SOCKS5 出口代理。

主要字段：

- `name`: 代理名称。
- `address`: SOCKS5 地址，格式为 `host:port`。
- `username`: 可选用户名。
- `password`: 可选密码。
- `enabled`: 是否启用；Backend 绑定禁用代理时，请求会失败并触发 failover，不会静默直连。

### model_policies

存储模型调度策略。

主要字段：

- `pattern`: 模型匹配模式。
- `endpoint`: endpoint 匹配。
- `placement_policy`: `sticky`、`pack` 或 `spread`。
- `backend_pool`: 可选，限制 backend 池。
- `failover_enabled`: 是否启用故障切换。
- `priority`: 优先级，数值越小越优先。

### audit_events

记录低频事件。

记录范围：

- backend 创建或更新。
- client key 创建。
- 请求触发 failover。
- backend 请求失败。

不记录：

- 完整请求 body。
- 完整响应 body。
- 每一次正常请求明细。

## 管理接口

管理 API 使用 `TG_ADMIN_TOKEN` 认证。

认证方式：

- `Authorization: Bearer <TG_ADMIN_TOKEN>`
- 或 `X-Admin-Token: <TG_ADMIN_TOKEN>`

当前管理 API：

- `GET /admin/api/overview`
- `GET /admin/api/socks-proxies`
- `POST /admin/api/socks-proxies`
- `PUT /admin/api/socks-proxies/{id}`
- `DELETE /admin/api/socks-proxies/{id}`
- `GET /admin/api/backends`
- `POST /admin/api/backends`
- `PUT /admin/api/backends/{id}`
- `DELETE /admin/api/backends/{id}`
- `GET /admin/api/client-keys`
- `POST /admin/api/client-keys`
- `PUT /admin/api/client-keys/{id}`
- `DELETE /admin/api/client-keys/{id}`
- `GET /admin/api/model-policies`
- `POST /admin/api/model-policies`
- `PUT /admin/api/model-policies/{id}`
- `DELETE /admin/api/model-policies/{id}`
- `GET /admin/api/events`

## 管理台

管理台是静态 Web 页面，嵌入 Go 二进制中，通过 `/admin/` 访问。

当前能力：

- 配置 backend。
- 配置 SOCKS5 proxy，并为 backend 指定代理或直连。
- 配置 client key。
- 配置 model policy。
- 查看 backend 运行态。
- 查看最近事件。

后续增强：

- 编辑表单回填。
- 手动连通性检查。
- 模型视图。
- backend 状态筛选。
- 登录会话和 RBAC。

## 运行日志

Token Gate 使用 Go `slog` 输出结构化文本日志，默认写到 stdout。每个 HTTP 请求都会带 `request_id`，如果客户端传入 `X-Request-ID` 或 `X-Request-Id` 会沿用，否则自动生成。

主要日志事件：

- `client_tcp_connection`: 客户端 TCP 连接创建、关闭或 hijack。
- `client_request_started` / `client_request_finished`: 客户端 HTTP 请求开始和结束，包含 method、path、client_ip、status、duration、response_bytes。
- `client_auth_succeeded` / `client_auth_failed`: 客户端 API key 鉴权结果，只记录 token prefix，不记录完整 token。
- `admin_auth_succeeded` / `admin_auth_failed`: 管理 API 鉴权结果，不记录 admin token。
- `proxy_request_received`: 已解析 endpoint/model/body_bytes 的代理请求。
- `backend_selection_completed`: 调度结果，包含 policy、placement、候选 backend。
- `backend_request_started`: 单次 backend 尝试开始。
- `backend_dns_start` / `backend_dns_done`: backend DNS 解析过程。
- `backend_connect_start` / `backend_connect_done`: backend TCP 连接过程。
- `backend_connection_acquired`: backend HTTP 连接获取结果，包含是否复用连接和本地/远端地址。
- `backend_request_written`: 请求写入 backend 的结果。
- `backend_first_response_byte`: 收到 backend 首字节。
- `backend_response_retryable`: backend 返回可重试状态并触发 failover。
- `backend_response_selected`: 最终选中的 backend 响应。
- `backend_request_failed` / `proxy_request_failed`: backend 或整体代理失败。
- `client_response_write_failed`: 向客户端写响应失败。

日志不记录完整请求体、响应体、完整 client key、backend API key 或 admin token。

## 安全设计

当前安全策略：

- 客户端 token 明文存储在 SQLite 中，便于管理台展示和编辑；鉴权仍使用 SHA-256 hash。
- 后端 API key 明文存储在 SQLite 中，便于转发使用。
- 管理 API 使用单一 admin token。
- 不保存完整请求/响应内容。

生产环境建议：

- 使用 HTTPS 终止。
- 设置强 `TG_ADMIN_TOKEN`。
- 限制管理台来源 IP。
- 给 SQLite 文件设置严格权限。
- 后端 API key 后续可接入 KMS 或本机密钥加密。
- 增加 admin 用户、会话和 RBAC。

## 配置

环境变量：

- `TG_LISTEN_ADDR`: 监听地址，默认 `:8080`，启动脚本默认 `:4000`。
- `TG_DB_PATH`: SQLite 数据库路径。
- `TG_ADMIN_TOKEN`: 管理 API token。
- `TG_LOG_LEVEL`: 日志级别，支持 `debug`、`info`、`warn`、`error`，默认 `info`。
- `TG_BACKEND_COOLDOWN`: backend 达到失败阈值后的基础冷却时间。
- `TG_BACKEND_FAILS`: backend 连续失败多少次后进入冷却，默认 `3`。
- `TG_REQUEST_TIMEOUT`: 上游响应头超时时间。
- `TG_SHUTDOWN_TIMEOUT`: 优雅关闭超时。

启动脚本：

```bash
./start.sh
```

默认：

- `TG_LISTEN_ADDR=:4000`
- `TG_DB_PATH=/root/workspace/token-gate/token-gate.db`
- `TG_ADMIN_TOKEN=dev-admin-token`
- `TG_LOG_LEVEL=info`

## 测试策略

当前测试覆盖：

- 调度器模型通配、endpoint、pool 和 placement policy。
- `pack` 模式 route group 行为。
- backend 连续失败阈值、冷却和全候选 cooling 直接失败。
- 代理层请求 body/path/query/header 透明转发。
- backend 按协议替换鉴权头，`openai` 使用 `Authorization`，`anthropic` 使用 `X-Api-Key`。
- backend SOCKS5 代理转发。
- app 层 SOCKS5 proxy CRUD 和 backend 绑定。
- hop-by-hop header 清理。
- SSE 响应透传和 flush。
- app 层 500 failover 到第二个 backend。

测试命令：

```bash
go test ./...
go build ./...
```

## 已知限制

- 当前没有请求级指标持久化。
- 当前没有 Prometheus exporter。
- 当前没有 per-client rate limit。
- 当前没有 per-backend max concurrency。
- 当前 `/v1/models` 使用本地 backend 配置汇总，不实时合并上游返回。
- 当前只处理 JSON body 中的 `model` 字段，不支持 multipart/form-data 类接口。
- 当前管理台是轻量 CRUD，不是完整运维平台。

## 后续路线

优先级较高：

- 增加 backend 并发上限。
- 增加 client 级限流。
- 增加 Prometheus metrics。
- 增加模型维度视图。
- 增加 backend 手动连通性检查。
- 增加配置导入导出。

中期：

- 支持加密存储 backend API key。
- 管理台登录会话和 RBAC。
- 更细粒度的 `/v1/models` 可见性控制。
- 请求 ID 和结构化日志。

长期：

- 多实例部署时，把运行态失败和冷却状态迁移到共享存储或协调层。
- 更复杂的成本、配额和计费模型。
- 对非透明协议适配做独立模块，但不影响透明代理核心路径。
