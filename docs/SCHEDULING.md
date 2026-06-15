# Token Gate 调度说明

本文专门解释 Token Gate 是如何为一次请求选择 backend 的。重点覆盖：

- 请求进入后调度器到底按什么顺序判断
- `policy`、`pool`、`endpoint`、`weight` 分别起什么作用
- 多条 policy 同时命中时，最后哪条生效
- failover 在什么情况下发生

## 一句话概括

一次请求的 backend 选择顺序是：

```text
请求进入
-> 提取 endpoint 和 model
-> 选出唯一生效的 policy
-> 根据 policy 和 backend 能力筛候选 backend
-> 按 placement + weight + 活跃请求数排序
-> 依次尝试候选 backend
-> 失败时按策略决定是否 failover
```

`policy` 先决定规则，`backend` 再在规则内参与竞争。

## 1. 请求进入后先做什么

公开 API 请求进入后，Token Gate 会先完成这些步骤：

1. 校验客户端 `api_key`
2. 根据请求路径识别 endpoint
3. 从请求体中读取 `model`
4. 把 `client + endpoint + model` 交给调度器

当前支持的 endpoint 分类：

- `chat`
- `responses`
- `embeddings`
- `images`
- `models`

例如：

- `/v1/chat/completions` -> `chat`
- `/v1/responses` -> `responses`
- `/v1/embeddings` -> `embeddings`
- `/v1/images/generations` -> `images`

## 2. 先选出哪条 policy 生效

调度器不会把多条 policy 叠加执行，而是先从所有命中规则中选出唯一一条生效 policy。

命中条件：

- `policy.endpoint` 匹配当前请求 endpoint
- `policy.pattern` 匹配当前请求 model

如果有多条 policy 同时命中，选择顺序是：

1. `priority` 更小的优先
2. 如果 `priority` 相同，`pattern` 更具体的优先

### 示例 1：更具体的 pattern 生效

有两条 policy：

- A: `pattern = gpt-*`, `endpoint = chat`, `priority = 100`
- B: `pattern = gpt-4o`, `endpoint = chat`, `priority = 100`

请求：

- `model = gpt-4o`
- `endpoint = chat`

结果：

- A 命中
- B 也命中
- 因为 B 的 `pattern` 更具体，所以最终 B 生效

### 示例 2：priority 覆盖具体度

有两条 policy：

- A: `pattern = gpt-4o`, `endpoint = chat`, `priority = 300`
- B: `pattern = gpt-*`, `endpoint = chat`, `priority = 100`

请求：

- `model = gpt-4o`
- `endpoint = chat`

结果：

- 两条都命中
- B 的 `priority` 更高，因为数字更小
- 最终 B 生效

### 结论

当前系统允许配置重叠 policy，不会在创建时禁止。  
真正生效的是“命中后排序的第一条”。

## 3. policy 生效后，怎么筛 backend

当唯一 policy 选出来以后，调度器开始筛 backend。

backend 必须同时满足下面条件，才会进入候选集：

1. backend 已启用
2. backend 支持当前 endpoint
3. backend 支持当前 model
4. 如果 policy 指定了 `backend_pool`，backend 必须属于这个 pool

这一步非常关键：  
只有通过筛选的 backend，后面才会参与排序。没通过筛选的 backend，哪怕 `weight` 很高，也完全不会被选中。

## 4. backend.pool 和 policy.backend_pool 是什么关系

这两个字段是一套“后端分组限制”机制。

- `backend.pool`：backend 自己属于哪个组
- `policy.backend_pool`：这条 policy 允许从哪个组里选 backend

### 示例 3：用 pool 限制候选 backend

有三个 backend：

- A: `pool = default`, 支持 `gpt-4o`
- B: `pool = image`, 支持 `gpt-image-2`
- C: `pool = image`, 支持 `gpt-image-2`

有一条 policy：

- `pattern = gpt-image-*`
- `endpoint = images`
- `backend_pool = image`

请求：

- `model = gpt-image-2`
- `endpoint = images`

结果：

- A 不会参与，因为 pool 不匹配
- B、C 进入候选集

如果 `backend_pool` 留空：

- 就不会按 pool 限制
- 所有满足 model / endpoint 的 backend 都可以参与

## 5. endpoint 在 policy 里到底有什么用

`policy.endpoint` 不是模型能力，而是“这条策略作用于哪类 API 请求”。

同一个模型名，在不同 endpoint 上可以走不同调度策略。

### 示例 4：同模型，不同 endpoint 用不同策略

有两条 policy：

- A: `pattern = gpt-4o`, `endpoint = chat`, `placement = sticky`
- B: `pattern = gpt-4o`, `endpoint = responses`, `placement = spread`

请求 1：

- `model = gpt-4o`
- `endpoint = chat`

结果：

- 命中 A，使用 `sticky`

请求 2：

- `model = gpt-4o`
- `endpoint = responses`

结果：

- 命中 B，使用 `spread`

所以：

- `pattern` 决定匹配哪个模型
- `endpoint` 决定匹配哪类接口
- 两者一起决定命中哪条 policy

## 6. policy 决定 placement，client 还可以覆盖

选出 policy 后，系统会得到一个最终的 placement policy。

来源顺序：

1. 如果 client key 设置了 `route_mode_override`，优先用 client 自己的覆盖值
2. 否则用 model policy 的 `placement_policy`
3. 如果都不合法，回退到 `sticky`

也就是说，client key 可以覆盖 policy 的调度方式，但不能绕过 backend 候选筛选逻辑。

## 7. weight 在调度里到底什么时候生效

`backend.weight` 是在 policy 生效并且 backend 已进入候选集之后，才开始影响排序。

这意味着：

- `policy` 先决定“哪些 backend 有资格参与”
- `weight` 再决定“这些合格 backend 里谁更容易排在前面”

### 示例 5：weight 不能突破 policy 的限制

有三个 backend：

- A: `pool = image`, `weight = 10`
- B: `pool = image`, `weight = 1`
- C: `pool = default`, `weight = 100`

policy：

- `backend_pool = image`

结果：

- A 和 B 参与排序
- C 完全不会参与
- 即使 C 的 `weight = 100`，也不会被选

### 示例 6：同一 pool 里 weight 影响优先级

有两个 backend：

- A: `pool = image`, `weight = 10`
- B: `pool = image`, `weight = 1`

在其它条件相同的情况下：

- A 更容易排在 B 前面
- 但不是“永远固定选 A”
- 因为当前实现使用的是 rendezvous hashing，不是简单按权重轮询

## 8. placement policy 怎么影响排序

候选 backend 选出来后，会按 `placement policy` 计算排序分数。

当前支持三种：

- `sticky`
- `pack`
- `spread`

### sticky

```text
route_key = client_api_key_hash + "|" + model
```

特点：

- 同一 client key 请求同一 model，倾向稳定落到同一 backend
- backend 数量变化时，只会部分迁移

适合：

- 希望命中缓存
- 希望同一个客户端体验稳定

### pack

```text
route_key = route_group + "|" + model
```

特点：

- 同一 `route_group` 下，不同 client 请求同一 model，倾向落到同一 backend
- 没设置 `route_group` 时，默认用 `shared`

适合：

- 希望把相同模型请求尽量集中
- 希望减少冷启动或缓存碎片

### spread

```text
route_key = client_api_key_hash + "|" + model
score = rendezvous_score / (active_requests + 1)
```

特点：

- 保留一定稳定性
- 同时考虑活跃请求数
- 更倾向把请求分配到当前更空闲的 backend

适合：

- 想把并发打散
- 想减少热点节点

## 9. 冷却期和 failover 是怎么配合的

Token Gate 不做主动健康检查，只根据真实请求结果维护 backend 运行态。

### 请求前的冷却筛选

如果某个 backend 正在冷却期：

- 它不会进入可用候选集

如果存在至少一个非冷却 backend：

- 只使用非冷却候选

如果所有候选都在冷却：

- 直接返回失败
- 不会再把 cooling backend 当作兜底候选

### 什么时候会触发 failover

一个 backend 在首包前失败时，可以切到下一个候选。常见情况：

- 建连失败
- 请求发送失败
- 上游返回可重试状态

当前可重试状态主要包括：

- `429`
- `5xx`

是否真的切下一个候选，还取决于命中的 policy 是否开启了 `failover_enabled`。

### 连续失败多少次才进入 cooling

当前不是失败一次就立刻进入 cooling。  
backend 只有在“连续失败次数达到阈值”后，才会被标记为 cooling。

这个阈值由环境变量控制：

- `TG_BACKEND_FAILS`

默认值：

- `3`

也就是说，默认行为是：

- 第 1 次失败：只累计失败次数，不 cooling
- 第 2 次失败：继续累计，不 cooling
- 第 3 次失败：进入 cooling

### 连续失败阈值示例

假设：

- `TG_BACKEND_FAILS = 3`
- `TG_BACKEND_COOLDOWN = 20s`

backend A 连续失败：

1. 第 1 次失败：`consecutive_failures = 1`，不进入 cooling
2. 第 2 次失败：`consecutive_failures = 2`，不进入 cooling
3. 第 3 次失败：`consecutive_failures = 3`，进入 cooling，冷却 `20s * 3`

如果之后又继续连续失败，冷却时间会继续按失败次数增长，但当前上限仍是 5 倍基础冷却时间。

### 示例 7：failover 开启

候选顺序：

1. A
2. B
3. C

policy：

- `failover_enabled = true`

结果：

- 如果 A 连接失败，会尝试 B
- 如果 B 返回 `429`，会尝试 C
- 直到候选用尽

### 示例 8：failover 关闭

候选顺序：

1. A
2. B

policy：

- `failover_enabled = false`

结果：

- A 一旦失败，请求直接失败
- 不会尝试 B

## 10. 一次完整示例

下面给一个完整的调度例子。

### backend 配置

- `bj-chat-1`
  - `pool = default`
  - `models = [gpt-4o, gpt-4.1]`
  - `endpoints = [chat, responses]`
  - `weight = 5`

- `bj-chat-2`
  - `pool = default`
  - `models = [gpt-4o, gpt-4.1]`
  - `endpoints = [chat, responses]`
  - `weight = 1`

- `img-1`
  - `pool = image`
  - `models = [gpt-image-*]`
  - `endpoints = [images]`
  - `weight = 3`

### policy 配置

- Policy A
  - `pattern = gpt-4o`
  - `endpoint = chat`
  - `placement_policy = sticky`
  - `backend_pool = default`
  - `priority = 100`

- Policy B
  - `pattern = gpt-image-*`
  - `endpoint = images`
  - `placement_policy = spread`
  - `backend_pool = image`
  - `priority = 100`

### 请求 1：聊天

请求：

- client key = `client-a`
- endpoint = `chat`
- model = `gpt-4o`

调度过程：

1. 命中 Policy A
2. 只允许 `pool = default`
3. `img-1` 被排除
4. `bj-chat-1` 和 `bj-chat-2` 进入候选
5. 使用 `sticky`
6. 再结合 weight 排序
7. 大概率优先 `bj-chat-1`

### 请求 2：图片

请求：

- client key = `client-a`
- endpoint = `images`
- model = `gpt-image-2`

调度过程：

1. 命中 Policy B
2. 只允许 `pool = image`
3. 只有 `img-1` 满足条件
4. 最终只能发给 `img-1`

## 11. 最容易混淆的几点

### `backend.pool` 不是模型名

它是后端分组名，只用于限制候选范围。

### `policy.endpoint` 不是 backend 能力列表

它只是“这条 policy 匹配哪类请求”。

真正的 backend 能力还是看 backend 自己的：

- `models`
- `endpoints`

### `weight` 不是 policy 级别配置

它是 backend 自己的属性。  
同一条 policy 命中的多个 backend，才会按各自 `weight` 比较。

### `route_group` 不是 pool

- `pool` 用来限制候选 backend 范围
- `route_group` 只在 `pack` 模式下参与 route key 计算

## 12. 推荐配置建议

如果你当前场景比较简单，推荐这样理解和使用：

### 简单场景

条件：

- 每个模型只对应一组 backend
- 不区分供应商池、成本池、出口池

建议：

- `backend.pool` 可以不填
- `policy.backend_pool` 可以留空
- 主要靠 `pattern + endpoint + placement_policy`

### 复杂场景

条件：

- 同一个模型在多组 backend 都存在
- 需要区分高成本/低成本、不同出口、不同账号池

建议：

- backend 按业务含义打 `pool`
- policy 明确指定 `backend_pool`
- 再用 `weight` 调整组内优先级

## 13. 最终记忆版

记住下面这句就够了：

```text
policy 先决定规则和候选范围，
backend 再在这个范围里按 placement、weight 和运行态竞争。
```
