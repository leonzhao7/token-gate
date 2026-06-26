# Frontend Usage Log Tokens Design

## Goal

在 `frontend/` 的 Usage Logs 页面中展示后端已经返回的 token 统计字段：

- `input_tokens`
- `input_cache_tokens`
- `output_tokens`

展示要求：

- 列表主表新增独立 `Tokens` 列
- 保留现有 `Bytes` 列
- 展开行中再显示 3 个 token 明细项

## Non-Goals

- 不修改旧嵌入式管理台 `internal/app/web`
- 不修改后端 API、数据库或 usage log 写入逻辑
- 不新增筛选、排序、聚合或图表能力
- 不重做 Usage Logs 页面整体布局
- 不为这个小功能引入新的前端测试框架

## Existing Context

当前 `frontend/` Usage Logs 页面主要由以下文件组成：

- `frontend/src/api/types.ts`
  - 定义 `UsageLog` 前端类型
- `frontend/src/stores/usageLogs.ts`
  - 拉取 usage log 列表并保存在 Pinia store
- `frontend/src/pages/UsageLogs.vue`
  - 页面容器、筛选和分页
- `frontend/src/components/usageLogs/UsageLogsTable.vue`
  - 列表表格与展开行渲染

当前表格字段为：

- Time
- Client
- Model
- Backend
- Status
- Latency
- Bytes

展开区当前只展示：

- Request ID
- IP Address
- User Agent
- Error

后端现在已经在 usage log API 返回 token 字段，但 `frontend/src/api/types.ts` 还没有声明，组件也没有渲染。

## Design Options

### Option A: 用 `Tokens` 列替换 `Bytes` 列

优点：

- 列数不增加
- token 信息更突出

缺点：

- 会丢失列表主表对 request/response bytes 的快速观察能力
- bytes 和 tokens 是不同维度，不适合相互替代

### Option B: 保留 `Bytes` 列，新增独立 `Tokens` 列

优点：

- bytes 和 tokens 语义清晰分离
- 不破坏现有流量观察习惯
- 改动集中在表格组件，风险低

缺点：

- 表会更宽一些

### Option C: 把 bytes 和 tokens 都塞进同一列

优点：

- 不增加列数

缺点：

- 信息太挤
- 扫读效率差
- 展示层级不清晰

## Decision

采用 Option B。

理由：

- 用户明确要求“新增 token 列”
- 现有 `Bytes` 列已经有稳定语义，不应被 token 统计挤占
- `frontend/` 当前表格有横向滚动容器，可以接受增加一列

## UI Design

### Table Column

在 `UsageLogsTable.vue` 的表头中新增 `Tokens` 列，位置放在：

- `Latency` 之后
- `Bytes` 之前

最终相关列顺序为：

- Status
- Latency
- Tokens
- Bytes

### Table Cell Content

`Tokens` 列使用两行紧凑展示：

第一行：

- 显示 `input_tokens`

第二行：

- 显示 `Cache {input_cache_tokens} · Out {output_tokens}`

示例：

```text
18.9K
Cache 16.2K · Out 217
```

格式规则：

- 使用缩写数字展示，提升扫读效率
- 统一使用大写后缀，例如 `1.2K`、`3.4M`
- `0` 直接显示 `0`
- 缺失值按 `0` 处理

### Expanded Row Content

展开区新增 3 个 detail item：

- `Input Tokens`
- `Cache Tokens`
- `Output Tokens`

这些字段与现有 `Request ID`、`IP Address`、`User Agent` 并列展示，保持当前 detail grid 结构，不新增新的折叠层级。

## Data Flow

### Frontend Type Alignment

在 `frontend/src/api/types.ts` 的 `UsageLog` 中新增：

- `input_tokens?: number`
- `input_cache_tokens?: number`
- `output_tokens?: number`

不改 API client、store 和页面容器逻辑，因为这些字段已经由后端列表接口直接返回，现有数据流可以自然透传。

### Rendering Responsibility

token 展示逻辑全部收敛在 `UsageLogsTable.vue`：

- 列表 token 摘要格式化
- 展开区 token 明细格式化

这样可以避免把纯展示逻辑散落到 store 或 page 层。

## Formatting Rules

新增一个仅用于 token 的格式化函数，例如：

- `formatTokenCount(value: number | undefined): string`

规则：

- `0` -> `0`
- `< 1000` -> 整数原样显示
- `>= 1000` -> 显示一位小数缩写，例如 `1.2K`
- `>= 1_000_000` -> `M`

不复用 `formatBytes`，因为 bytes 和 tokens 的单位语义不同。

## Layout and Responsiveness

由于主表新增一列：

- 继续依赖现有 `.table-container { overflow-x: auto; }`
- `Tokens` 单元格使用垂直堆叠布局，避免横向占用过宽
- 展开区 detail grid 不改列数规则，只新增内容项

## Testing

这次不新增前端测试文件，也不为该功能引入测试框架。

仅保留轻量验证：

- `frontend/src/api/types.ts` 类型更新后 `build:check` 通过
- `UsageLogsTable.vue` 渲染变更后 `build:check` 通过

## Risks

### API Shape Drift

当前 `frontend/` 的 filters 和 detail 类型本身与后端并非完全一致，但这次变更只读取列表项上的新增字段，不扩大这种不一致范围。

### Table Width Growth

新增 `Tokens` 列会增加横向宽度，但现有容器已经允许横向滚动，风险可接受。

## Acceptance Criteria

满足以下条件即可认为完成：

1. `frontend/` Usage Logs 主表新增 `Tokens` 列
2. 该列显示 `input_tokens` 与 `cache/output` 摘要
3. 展开区能看到 3 个 token 明细项
4. `Bytes` 列保持存在
5. `cd frontend && npm run build:check` 通过
