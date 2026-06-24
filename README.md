# token-gate

`token-gate` 是一个用 Go 实现的 AI 透明代理。它对外提供统一的 `base_url + api_key`，对内按模型把请求路由到多个 OpenAI-compatible 或 Claude/Anthropic 后端 LLM 节点，并在节点不可用时自动切换。

当前 MVP 覆盖：

- `/v1/chat/completions`
- `/v1/responses`
- `/v1/embeddings`
- `/v1/images/generations`
- `/v1/messages`
- `/v1/messages/count_tokens`
- `/v1/models`
- 管理端 `/admin/`

文档：

- 设计总览：`docs/DESIGN.md`
- 调度说明：`docs/SCHEDULING.md`

## 设计约束

- 代理层只做认证、调度、故障切换和 header 必要改写，不改写请求体或响应体。
- 后端可配置为 `openai` 或 `anthropic` 协议；代理不做 OpenAI Chat 和 Claude Messages 的请求体互转。
- 客户端鉴权支持 `Authorization: Bearer <key>` 和 Claude/Anthropic 常用的 `x-api-key: <key>`。
- 管理 API 默认开放，不再使用独立 admin token / session。
- 不自动探测后端 health；只根据真实代理请求的失败/成功维护冷却和恢复状态。
- 流式响应一旦开始输出，若后端中途断流，当前版本不会尝试切到另一个后端。
- “兼容官方 SDK”是支持目标；不做官方客户端身份伪装、专有签名伪造或设备指纹冒充。

## 路由策略

模型策略保存在 `model_policies` 表里，支持：

- `sticky`: `client_api_key + model` 稳定落到同一 backend
- `pack`: 相同 `route_group + model` 尽量集中到同一 backend
- `spread`: `client_api_key + model` 稳定分配，并用活跃连接数做负载偏置

客户端 key 可以通过 `route_mode_override` 覆盖默认模型策略，`route_group` 用于 `pack` 模式分组。

## 数据表

- `client_keys`
- `socks_proxies`
- `backends`
- `model_policies`
- `audit_events`

SQLite 使用 `WAL` 模式，适合当前“小规模、单表不超过 5 万行”的目标。

## 运行

```bash
export TG_DB_PATH='./token-gate.db'
export TG_LOG_LEVEL='info'
export TG_BACKEND_FAILS='3'
go run ./cmd/token-gate
```

默认监听 `:8080`。

日志默认输出到 stdout，`TG_LOG_LEVEL` 支持 `debug`、`info`、`warn`、`error`。日志会记录 client 请求、鉴权、调度、backend 连接、failover 和响应结果，不记录完整请求体、响应体或完整 key。

管理台：

- `http://127.0.0.1:8080/admin/`

公开 API：

- `http://127.0.0.1:8080/v1/...`

## 后续建议

- 给 admin API 增加真正的登录会话或单独 RBAC
- 增加 backend 并发上限和速率上限
- 为 `/v1/models` 增加缓存和更细的模型可见性控制
- 增加 Prometheus 指标和结构化日志
