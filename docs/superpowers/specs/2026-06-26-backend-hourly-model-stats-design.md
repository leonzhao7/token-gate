# Backend Hourly Model Stats Design

## Goal

为 admin 后端提供一组新的小时级请求统计能力，按 `backend + model + hour` 持久化聚合请求结果，不修改现有前端 UI，只新增后端存储与查询接口。

统计维度和约束如下：

- 维度：`backend`、`model`、`hour`
- 小时分桶：按 UTC 时区分桶
- 统计对象：每一次 backend attempt
- 查询过滤：`backend`、`model`、`start_hour`、`end_hour` 全部可选
- 查询范围：`backend` 为空时查询全部 backend，`model` 为空时查询全部 model，时间为空时查询全部时间
- 响应除统计结果外，还必须返回本次结果涉及的 backend 列表、model 列表、时间范围

## Non-Goals

- 不修改前端页面或现有前端调用
- 不做历史 `usage_logs` 回填
- 不让调度逻辑、告警逻辑或 backend 状态逻辑依赖该聚合表
- 不新增定时任务或离线聚合任务

## Existing Context

当前请求明细已经持久化在 `usage_logs` 表，写入路径集中在：

- `internal/app/app.go`
  - `handleProxy`
  - `appendAttemptUsageLog`
- `internal/store/store.go`
  - `AppendUsageLog`

现有系统已经在列表页和 dashboard 中使用 `usage_logs` 做部分统计，但这些统计不是按 `backend + model + hour` 单独持久化的，也不提供本次需求要求的聚合查询返回结构。

## Design Options

### Option A: 查询时直接聚合 `usage_logs`

优点：

- 不改写入路径
- 实现最直接

缺点：

- 不满足“后端保存每个 backend 的每小时每 model 统计”的要求
- 数据量增大后查询性能不可控
- 每次查询都重复扫描明细日志

### Option B: 写入 `usage_logs` 时同步维护聚合表

优点：

- 满足持久化聚合要求
- 查询快，接口实现简单
- 统计口径和 usage log 写入时刻完全一致

缺点：

- 需要扩展写入路径
- 新表上线前的历史数据不会自动可查

### Decision

采用 Option B。

理由：

- 用户明确不需要历史回填
- 当前系统所有 backend attempt 已统一通过 `AppendUsageLog` 落库，适合作为唯一聚合入口
- 管理端查询比离线分析更适合使用预聚合表

## Data Model

新增表：`backend_hourly_model_stats`

```sql
CREATE TABLE IF NOT EXISTS backend_hourly_model_stats (
  backend_id INTEGER NOT NULL,
  backend_name TEXT NOT NULL DEFAULT '',
  model TEXT NOT NULL,
  hour_start_utc TEXT NOT NULL,
  success_count INTEGER NOT NULL DEFAULT 0,
  failure_count INTEGER NOT NULL DEFAULT 0,
  success_duration_ms_sum INTEGER NOT NULL DEFAULT 0,
  success_request_bytes_sum INTEGER NOT NULL DEFAULT 0,
  success_response_bytes_sum INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (backend_id, model, hour_start_utc)
);

CREATE INDEX IF NOT EXISTS idx_backend_hourly_model_stats_hour
  ON backend_hourly_model_stats(hour_start_utc DESC);

CREATE INDEX IF NOT EXISTS idx_backend_hourly_model_stats_model_hour
  ON backend_hourly_model_stats(model, hour_start_utc DESC);
```

字段说明：

- `backend_id`
  - backend 主键，作为聚合主维度之一
- `backend_name`
  - backend 名称快照，方便结果直接返回，也避免 backend 后续改名或删除时丢失展示信息
- `model`
  - 使用请求侧 model，即当前 `usage_logs.model`
- `hour_start_utc`
  - UTC 整点小时，作为唯一小时桶 key
- `success_count`
  - 成功请求数
- `failure_count`
  - 失败请求数
- `success_duration_ms_sum`
  - 成功请求耗时总和，查询时再计算平均值
- `success_request_bytes_sum`
  - 成功请求 body 总字节数
- `success_response_bytes_sum`
  - 成功响应 body 总字节数
- `created_at` / `updated_at`
  - 记录聚合桶首次创建和最近更新时刻

## Aggregation Semantics

### Counting Unit

统计单位是每一次 backend attempt，不是外部 client request。

例子：

- 一个外部请求先打到 backend A 失败，再 failover 到 backend B 成功
- 结果：
  - A 所在小时桶 `failure_count +1`
  - B 所在小时桶 `success_count +1`

### Success and Failure Rules

- 成功：`status_code` 为 `2xx`
- 失败：不是 `2xx`

这里不沿用 `domain.IsBackendFailureStatus` 的“可重试失败”语义，因为本需求要的是请求成功/失败区分，而不是调度失败判定。

### Model Rule

聚合使用客户端请求中的 model，即 `usage_logs.model`。

即使 backend 在发往上游前做了 model rewrite，聚合仍按客户端请求 model 记账，原因是：

- admin 查询更关心“请求的业务 model”
- 与现有 usage log 展示口径一致
- 避免同一业务 model 因上游映射分裂成多条统计

### Hour Bucket Rule

小时分桶按 UTC 时区计算：

1. 取 usage log 的 `CreatedAt`
2. 转到 UTC
3. 截断到整点小时
4. 存入 `hour_start_utc`

例如请求发生在：

- `2026-06-26T15:23:41+08:00`

则聚合桶为：

- UTC 小时 `2026-06-26T07:00:00Z`

### Body Size Rule

仅统计成功请求的 body 大小：

- `success_request_bytes_sum`
  - 时间范围内所有成功请求 `request_bytes` 的总和
- `success_response_bytes_sum`
  - 时间范围内所有成功请求 `response_bytes` 的总和

失败请求的 body 大小不进入这两个累计字段。

## Write Path

### Entry Point

聚合写入统一挂在 `store.AppendUsageLog`。

原因：

- `handleProxy` 最终请求和 failover attempt 都会调用该方法
- 可以保证所有 usage log 写入都自动触发聚合
- 避免在多个 handler 调用点重复维护聚合逻辑

### Transaction Behavior

`AppendUsageLog` 改为单事务：

1. 向 `usage_logs` 插入一条明细
2. 如果这条日志具备可聚合条件，则更新 `backend_hourly_model_stats`
3. 提交事务

可聚合条件：

- `backend_id > 0`
- `backend_name` 非空
- `model` 非空
- `created_at` 可用

即使记录不满足这些条件，也仍然保留 usage log 明细写入，只跳过聚合更新。

### Upsert Strategy

使用 SQLite 原生 upsert：

```sql
INSERT INTO backend_hourly_model_stats (
  backend_id,
  backend_name,
  model,
  hour_start_utc,
  success_count,
  failure_count,
  success_duration_ms_sum,
  success_request_bytes_sum,
  success_response_bytes_sum,
  created_at,
  updated_at
)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
ON CONFLICT (backend_id, model, hour_start_utc) DO UPDATE SET
  backend_name = excluded.backend_name,
  success_count = backend_hourly_model_stats.success_count + excluded.success_count,
  failure_count = backend_hourly_model_stats.failure_count + excluded.failure_count,
  success_duration_ms_sum = backend_hourly_model_stats.success_duration_ms_sum + excluded.success_duration_ms_sum,
  success_request_bytes_sum = backend_hourly_model_stats.success_request_bytes_sum + excluded.success_request_bytes_sum,
  success_response_bytes_sum = backend_hourly_model_stats.success_response_bytes_sum + excluded.success_response_bytes_sum,
  updated_at = excluded.updated_at;
```

累加规则：

- 成功日志：
  - `success_count += 1`
  - `success_duration_ms_sum += duration_ms`
  - `success_request_bytes_sum += request_bytes`
  - `success_response_bytes_sum += response_bytes`
- 失败日志：
  - `failure_count += 1`
  - 其他 success 相关累计不变

## API Design

新增接口：

- `GET /admin/api/backend-hourly-model-stats`

### Query Parameters

- `backend`
  - 可选
  - backend 名称，精确匹配
- `model`
  - 可选
  - model 名称，精确匹配
- `start_hour`
  - 可选
  - RFC3339 时间
- `end_hour`
  - 可选
  - RFC3339 时间

### Time Parsing and Validation

时间参数处理规则：

- 允许为空
- 非空时必须能按 RFC3339 解析
- 解析后转到 UTC
- 分钟、秒、纳秒必须都是 0，否则返回 `400`
- 若 `start_hour > end_hour`，返回 `400`

查询过滤规则：

- `start_hour` 非空：筛选 `hour_start_utc >= normalized_start_hour_utc`
- `end_hour` 非空：筛选 `hour_start_utc <= normalized_end_hour_utc`

### Response Shape

```json
{
  "query": {
    "backend": "alpha",
    "model": "gpt-4.1",
    "start_hour": "2026-06-26T00:00:00Z",
    "end_hour": "2026-06-26T23:00:00Z"
  },
  "scope": {
    "backends": [
      { "id": 1, "name": "alpha" }
    ],
    "models": ["gpt-4.1"],
    "time_range": {
      "start_hour": "2026-06-26T00:00:00Z",
      "end_hour": "2026-06-26T23:00:00Z",
      "timezone": "UTC"
    }
  },
  "items": [
    {
      "backend_id": 1,
      "backend": "alpha",
      "model": "gpt-4.1",
      "hour": "2026-06-26T15:00:00Z",
      "requests": 12,
      "successes": 10,
      "failures": 2,
      "success_avg_duration_ms": 842.3,
      "success_request_bytes": 34567,
      "success_response_bytes": 890123
    }
  ]
}
```

字段说明：

- `query`
  - 回显本次调用使用的过滤条件
- `scope.backends`
  - 本次结果集实际涉及到的 backend 去重列表，不是系统全量 backend 列表
- `scope.models`
  - 本次结果集实际涉及到的 model 去重列表
- `scope.time_range`
  - 本次结果集中的最小和最大小时，不是简单回显请求参数
  - 结果为空时，`start_hour` 和 `end_hour` 返回 `null`
- `items`
  - 每一项对应一条 `backend + model + hour` 聚合结果

### Ordering

返回顺序固定为：

1. `hour` 升序
2. `backend` 升序
3. `model` 升序

这个顺序更适合直接做时间序列消费，也能保证测试稳定。

## Store Query Design

新增 store 层查询类型：

- 聚合行结构
- 查询过滤结构
- 查询结果结构

建议结构：

- `BackendHourlyModelStatsFilter`
  - `BackendName string`
  - `Model string`
  - `StartHour time.Time`
  - `EndHour time.Time`
- `BackendHourlyModelStatsRow`
  - `BackendID int64`
  - `BackendName string`
  - `Model string`
  - `HourStart time.Time`
  - `Successes int`
  - `Failures int`
  - `SuccessDurationMSSum int64`
  - `SuccessRequestBytes int64`
  - `SuccessResponseBytes int64`
- `BackendRef`
  - `ID int64`
  - `Name string`
- `BackendHourlyModelStatsResult`
  - `Rows []BackendHourlyModelStatsRow`
  - `Backends []BackendRef`
  - `Models []string`
  - `RangeStart *time.Time`
  - `RangeEnd *time.Time`

store 查询职责：

- 根据过滤条件查聚合表
- 扫描全部结果行
- 在 Go 侧构造：
  - 去重 backend 列表
  - 去重 model 列表
  - 实际时间范围

不再额外跑第二条 SQL 单独查 scope，避免重复维护筛选条件和返回不一致。

## App Layer Design

新增 handler：

- `handleBackendHourlyModelStats`

职责：

1. 解析 `backend`、`model`、`start_hour`、`end_hour`
2. 做时间整点校验与范围校验
3. 调用 store 查询
4. 组装 JSON 响应

新增辅助函数：

- 解析并校验“整点小时”参数
- 格式化 UTC hour 供响应输出

输出时所有 hour 字段都使用 UTC RFC3339，与存储口径保持一致。

## Error Handling

以下情况返回 `400 Bad Request`：

- `start_hour` 不是合法 RFC3339
- `end_hour` 不是合法 RFC3339
- 任一时间不是整点小时
- `start_hour > end_hour`

以下情况返回 `500 Internal Server Error`：

- 建表失败
- usage log 聚合更新失败
- 聚合查询失败

写路径失败策略：

- `AppendUsageLog` 中 `usage_logs` 插入和聚合更新共享一个事务
- 任一步失败都视为整个 append 失败
- 这样可以避免“明细有了但聚合漏记”的长期静默数据漂移

## Testing Strategy

### Store Tests

在 `internal/store/store_test.go` 增加测试，覆盖：

- 成功日志会创建并累计成功计数、平均耗时分子、请求和响应字节总和
- 失败日志只累计失败计数
- 同一 `backend + model + hour` 会被合并
- 不同小时会拆到不同 bucket
- 不同 backend 或 model 不会混桶
- 带过滤条件的查询结果正确
- 结果中的 backend/model/time_range 聚合正确
- 空结果时 scope 正确返回空列表和空时间范围

### App Tests

在 `internal/app/app_test.go` 增加接口测试，覆盖：

- 无过滤条件查询成功
- `backend` 过滤正确
- `model` 过滤正确
- `start_hour` / `end_hour` 过滤正确
- 非整点 hour 返回 `400`
- 非法时间格式返回 `400`
- `start_hour > end_hour` 返回 `400`
- 返回 JSON 中 `query`、`scope`、`items` 结构和字段名正确

## Implementation Impact

需要修改或新增的文件：

- `internal/store/store.go`
  - schema
  - 聚合 upsert
  - 聚合查询接口
- `internal/app/app.go`
  - 新路由
  - 新 handler
  - 小时参数解析校验
- `internal/store/store_test.go`
  - store 聚合测试
- `internal/app/app_test.go`
  - HTTP 接口测试

## Risks and Tradeoffs

### UTC Bucket Consistency

小时桶按 UTC 分桶，避免了同一份数据库在不同时区进程中运行时出现不同分桶结果的问题。

代价是：

- 管理端如果要以本地时间理解小时区间，需要自行做时区换算

### Renamed Backends

聚合表保存 `backend_name` 快照。如果 backend 改名：

- 历史桶仍保留旧名称
- 新写入的桶会使用新名称

这是可接受的，因为聚合数据本质是历史快照。若后续需要统一展示现名，再单独设计 join 或回写策略。

### Shared Transaction Cost

每条 usage log 现在多一次 upsert，会增加少量写放大。考虑到当前使用 SQLite 且写入链路已经是同步持久化，这个代价是可接受的，换来的是查询效率和统计一致性。

## Rollout

该设计不需要数据迁移工具：

1. 应用启动时 `store.Open` 自动建表和索引
2. 新请求开始持续写入聚合表
3. 管理端新接口可以立即查询新产生的数据

由于不做历史回填，接口上线后对旧时间范围返回空结果是预期行为。
