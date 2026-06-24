# Token Gate 调度说明

本文说明当前版本的 Token Gate 如何为一次请求选择 backend，以及 backend 运行态是如何影响候选集的。

这份说明只描述当前代码真实实现，不描述已经移除的 policy / pool / placement 架构。

## 一句话概括

一次请求的 backend 选择顺序是：

```text
请求进入
-> 提取 endpoint 和 model
-> 恢复已过期的 abnormal backends
-> 从 SQLite 读取全部 backends
-> 按 status / model 过滤候选
-> 按 weight desc、id asc 排序
-> 依次尝试候选 backend
-> 失败时自动 failover 到下一个候选
```

当前系统没有单独的策略对象；规则都在 backend 自身配置和运行态里。

## 1. 请求进入后先做什么

公开 API 请求进入后，Token Gate 会先完成这些步骤：

1. 校验客户端 `api_key`
2. 根据请求路径识别 endpoint
3. 从请求 body 里读取 `model`
4. 把 `endpoint + model` 交给调度器

当前支持的 endpoint 分类：

- `chat`
- `responses`
- `embeddings`
- `images`
- `messages`
- `models`

路径映射：

- `/v1/chat/completions` -> `chat`
- `/v1/responses` -> `responses`
- `/v1/embeddings` -> `embeddings`
- `/v1/images/generations` -> `images`
- `/v1/messages` -> `messages`
- `/v1/messages/count_tokens` -> `messages`
- `/v1/models` -> `models`

注意：

- `/v1/models` 走的是单独的模型汇总逻辑，不进入普通 proxy failover 流程。
- 其他公开代理路径如果 body 不是合法 JSON，或缺失 `model` 字段，会直接失败。

## 2. 候选 backend 是怎么选出来的

调度入口是：

```go
scheduler.SelectBackend(ctx, endpoint, model)
```

内部流程分四步。

### 第一步：恢复过期的 abnormal backend

在真正选候选之前，调度器会调用：

- `store.RecoverExpiredBackends(now)`

规则：

- 只处理 `status = abnormal` 的 backend
- 要求 `recover_at <= now`
- 满足条件后恢复为：
  - `status = normal`
  - `consecutive_failures = 0`
  - `recover_at = ''`

这意味着 abnormal backend 不是永久踢出，而是“每次调度前尝试恢复”。

### 第二步：读取全部 backend

调度器从 SQLite 读取所有 backend。当前没有按 model、endpoint 或状态做预查询优化。

### 第三步：按条件过滤

backend 必须同时满足下面条件，才会进入候选集：

1. `backend.status == normal`
2. backend 支持当前 model，或者 `model_mapping` 中存在该客户端 model 的映射

如果任一条件不满足，这个 backend 就不会参与本次请求。

### 第四步：排序

候选集按以下规则排序：

1. `weight` 更大的优先
2. 如果 `weight` 相同，`id` 更小的优先

当前没有：

- sticky
- pack
- spread
- rendezvous hashing
- active request bias

排序是稳定而直接的。

## 3. status 在调度里到底起什么作用

当前 backend 有三个状态：

- `normal`
- `abnormal`
- `disabled`

它们对调度的影响非常直接。

### `normal`

- 会参与调度。

### `abnormal`

- 不参与调度。
- 只有在 `recover_at` 到期后，才会在下一次调度前被恢复回 `normal`。

### `disabled`

- 永远不参与调度。
- 不会被自动恢复。
- 只能由管理员在后台手动改回 `normal`。

所以可以把状态理解成：

```text
normal   = 可选
abnormal = 因运行态故障临时下线
disabled = 因人工配置永久下线，直到再次启用
```

## 4. endpoint 在当前实现里起什么作用

请求路径仍然会被识别成 endpoint，例如：

- `/v1/chat/completions` -> `chat`
- `/v1/responses` -> `responses`
- `/v1/messages` -> `messages`

但当前调度器已经不再用 backend 的 `endpoints` 字段过滤候选。

也就是说：

- endpoint 仍然参与日志、usage log、审计事件和代理路径决策
- endpoint 不再参与 scheduler 的候选过滤
- 候选 backend 是否最终能接住请求，由代理层根据 path 和 backend `protocol` 决定是否：
  - 原样转发
  - 仅对 `/v1/messages` 与 `/v1/responses` 做跨协议转换

`endpoints` 字段目前仍保留在 backend 资源里，主要用于：

- 管理台展示
- 兼容已有数据结构
- 作为能力说明元数据

它不再主导调度。

### 当前唯一的跨协议转换

当前只支持这两条受控转换：

- 客户端 `/v1/messages` + OpenAI backend
  - 上游转到 `/v1/responses`
- 客户端 `/v1/responses` + Anthropic backend
  - 上游转到 `/v1/messages`

转换范围包括：

- 普通 JSON 请求/响应
- `text/event-stream` 流式响应
- tools / tool choice
- tool call / tool result 内容块

除此之外，其他 endpoint 不做转换。

## 5. model 是怎么匹配的

backend 的模型能力由两部分共同决定：

- `models []string`
- `model_mapping map[string]string`

### 5.1 `models` 直接匹配

`models` 支持：

- 精确匹配，例如 `gpt-4o`
- glob 匹配，例如 `claude-*`
- `*`

示例：

- backend A: `models = ["gpt-4o", "gpt-4.1"]`
- backend B: `models = ["gpt-image-*"]`
- backend C: `models = ["*"]`

请求：

- `model = gpt-image-2`

结果：

- A 不匹配
- B 匹配
- C 匹配

### 5.2 `model_mapping` 精确映射

如果 `models` 不匹配，调度器还会检查：

- `backend.model_mapping[client_model]`

规则：

- key 必须精确等于客户端请求的 model 名
- value 必须非空
- 只要命中，就认为 backend 支持这个客户端 model

示例：

- `models = ["claude-sonnet-prod"]`
- `model_mapping = { "claude-sonnet-4": "claude-sonnet-prod" }`

请求：

- `model = claude-sonnet-4`

结果：

- 即使 `models` 里没有 `claude-sonnet-4`
- backend 仍然会进入候选集
- 转发给上游时，body 中的 `model` 会被改写成 `claude-sonnet-prod`

### 5.3 `model_mapping` 不支持通配 key

当前 `model_mapping` 的 key 不参与 glob 匹配，只做精确字符串匹配。

所以：

- `"gpt-4o"` 可以
- `"gpt-*"` 不会在映射层生效

## 6. 当前没有哪些旧概念

以下概念已经不属于当前调度实现：

- model policy
- priority
- backend pool
- placement policy
- sticky / pack / spread
- route mode override
- route group
- failover_enabled

如果你在旧文档、旧测试或旧记忆里看到这些词，应该以当前代码为准：现在它们都不参与请求调度。

## 7. failover 是怎么发生的

调度器只负责给出有序候选列表。真正的 failover 发生在 app 层的代理循环里。

流程是：

1. 取第一个候选 backend
2. 发起上游请求
3. 如果失败且还有下一个候选，就切到下一个
4. 直到成功或候选耗尽

### 会触发 failover 的情况

当前实现里，下列情况都会尝试下一个候选：

- 建连失败
- 使用 SOCKS5 proxy 失败
- 请求写入失败
- 读取 response header 失败
- 上游返回任意非 `2xx` 状态

注意这里是“任意非 `2xx`”，不是只看 `429` 或 `5xx`。

也就是说：

- `301`
- `400`
- `401`
- `429`
- `500`

都会在代理层触发 failover，只要还有下一候选。

### 不会继续 failover 的情况

- 当前 backend 已经成功返回 `2xx`
- 没有更多候选 backend
- 响应已经写给客户端之后发生中途流错误

SSE 流开始输出后，不可能再无损切换到另一个 backend。

## 8. failure 统计口径和 failover 口径不是一回事

这里很容易混淆，必须分开看。

### 代理层 failover 口径

用于“要不要继续尝试下一个 backend”：

- 任何非 `2xx`
- 或网络/连接类错误

### usage/dashboard failure 统计口径

用于 usage log stats、dashboard、backend hourly failure 计数：

- 所有 `5xx`
- 所有 `4xx`，但排除 `400`

这意味着：

- `400` 会触发 failover，但不记入 failure 统计
- `301` 会触发 failover，也不记入 failure 统计
- `429` 会触发 failover，并记入 failure 统计
- `502` 会触发 failover，并记入 failure 统计

## 9. 连续失败和 abnormal 是怎么配合的

backend 不是失败一次就立刻 abnormal。

相关配置：

- `TG_BACKEND_FAILS`
- `TG_BACKEND_COOLDOWN`

规则：

1. 某次 backend 尝试失败
2. `consecutive_failures += 1`
3. 如果当前 backend 不是 `disabled`，并且连续失败数达到阈值：
  - `status = abnormal`
  - `recover_at = now + cooldown`

默认直觉是：

- 前几次失败只累计计数
- 达阈值后才临时下线

成功一次后：

- 失败计数清零
- abnormal 标记清掉

### 示例

假设：

- `TG_BACKEND_FAILS = 3`
- `TG_BACKEND_COOLDOWN = 30s`

backend A 连续失败：

1. 第 1 次失败：`consecutive_failures = 1`，仍然可能保持 `normal`
2. 第 2 次失败：`consecutive_failures = 2`
3. 第 3 次失败：进入 `abnormal`，`recover_at = now + 30s`

30 秒之后：

- 下次有请求进入调度器时
- `RecoverExpiredBackends` 会把它恢复成 `normal`

## 10. 手工状态修改有什么特殊语义

管理员更新 backend 时，当前 API 只允许手工设置：

- `normal`
- `disabled`

不允许直接把 backend 改成 `abnormal`。

这是刻意的边界：

- `abnormal` 是调度器管理的运行态
- `disabled` 是人工配置态

如果管理员把一个 backend 改为 `normal`：

- 会清空 `consecutive_failures`
- 会清空 `recover_at`

这等价于“人工恢复上线”。

## 11. 一个完整示例

假设有三个 backend：

- `edge-a`
  - `status = normal`
  - `weight = 5`
  - `models = ["gpt-4o"]`
  - `endpoints = ["chat", "responses"]`

- `edge-b`
  - `status = normal`
  - `weight = 2`
  - `models = ["gpt-4o"]`
  - `endpoints = ["chat", "responses"]`

- `edge-c`
  - `status = disabled`
  - `weight = 100`
  - `models = ["gpt-4o"]`
  - `endpoints = ["chat", "responses"]`

请求：

- `POST /v1/chat/completions`
- `model = gpt-4o`

调度过程：

1. endpoint 识别为 `chat`
2. model 识别为 `gpt-4o`
3. `edge-c` 因 `disabled` 被排除
4. `edge-a`、`edge-b` 都满足 model/status
5. 排序结果：
  - `edge-a`
  - `edge-b`
6. 先尝试 `edge-a`
7. 如果 `edge-a` 请求失败或返回非 `2xx`，就切到 `edge-b`

## 12. `/v1/models` 为什么可能和实际候选集不完全一样

`GET /v1/models` 会汇总所有 `status = normal` backend 暴露出的客户端可见模型，但它只是“可见模型集合”，不是完整调度结果。

它不会表达：

- 某模型对应多少 backend
- backend 的 weight 排序
- 某 backend 是否刚好会在当前请求里首先命中

所以：

- `/v1/models` 更像是目录视图
- 实际选路仍然由调度器按实时 backend 状态完成

## 13. 最终记忆版

记住下面这句就够了：

```text
当前 Token Gate 没有 policy 层。
请求只会在 status=normal、支持该 model 的 backends 之间，
按 weight 从高到低排序，然后失败就自动切到下一个。
```
