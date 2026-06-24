# Token Gate 前端 UI 重新设计方案

**日期**: 2026-06-24  
**状态**: 设计中  
**负责人**: AI Agent

---

## 1. 项目概述

### 1.1 目标

完全替换现有的 `internal/app/web/` 管理界面，创建一个现代化、简约专业的后台管理系统，支持 Dark/Light 主题切换。

### 1.2 核心要求

- 技术栈：Vue 3 + TypeScript + Vite
- 设计风格：简约专业（Vercel/Linear/Stripe Dashboard 风格）
- 部署方式：构建产物嵌入 Go 服务，统一启动，无需单独前端服务
- API 集成：复用现有 `/admin/api/*` 接口，无需修改后端

### 1.3 非目标

- 不改变后端 API 结构（除新增 Settings 配置管理接口外）
- 不引入复杂的微前端架构
- 不使用服务端渲染（SSR）

---

## 2. 整体架构

### 2.1 项目结构

```
token-gate/
├── frontend/                    # Vue 3 前端项目（新增）
│   ├── src/
│   │   ├── api/                # API 客户端层
│   │   ├── components/         # 可复用组件
│   │   │   ├── ui/            # 基础 UI 组件
│   │   │   └── features/      # 业务组件
│   │   ├── composables/       # Vue 组合式函数
│   │   ├── layouts/           # 布局组件
│   │   ├── pages/             # 页面视图
│   │   ├── router/            # Vue Router 配置
│   │   ├── stores/            # Pinia 状态管理
│   │   ├── styles/            # 全局样式
│   │   ├── types/             # TypeScript 类型
│   │   ├── utils/             # 工具函数
│   │   ├── App.vue
│   │   └── main.ts
│   ├── public/
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
│
├── web/                        # 构建产物（Go embed 目标）
├── internal/app/web/           # 旧前端（可保留作参考）
└── cmd/token-gate/
```

### 2.2 技术栈

**核心框架：**
- Vue 3.4+（Composition API）
- TypeScript 5+
- Vite 5+

**路由与状态：**
- Vue Router 4
- Pinia

**HTTP 客户端：**
- Axios（带拦截器）

**UI 组件库：**
- Radix Vue（无样式组件库，灵活定制）

**样式方案：**
- CSS Variables（主题系统）
- 可选 Tailwind CSS（快速布局）

**图表库：**
- Chart.js 或 ECharts（Dashboard 使用）

**图标库：**
- Lucide Icons（SVG icons）

### 2.3 构建与部署流程

**开发环境：**
```bash
cd frontend
npm run dev  # Vite 开发服务器（localhost:5173）
             # API 请求代理到 http://localhost:4000/admin/api/*
```

**生产构建：**
```bash
cd frontend
npm run build  # 产物输出到 ../web/
```

**Go 服务启动：**
```bash
./start.sh  # 或 go run ./cmd/token-gate
            # Go 通过 //go:embed web/* 嵌入静态文件
            # 前后端统一通过 :4000 提供服务
```

### 2.4 Go 代码调整

**调整 `internal/app/app.go`：**
```go
// 旧代码
//go:embed web/*
var webFS embed.FS

// 调整为从新的构建产物目录读取
// （如果 frontend/dist 输出到 web/，则无需修改）
```

---

## 3. 页面设计

### 3.1 路由结构

```
/                          # Dashboard（概览页）
/backends                  # Backends 列表与管理
/backends/:id              # Backend 详情
/proxies                   # SOCKS Proxies 列表与管理
/proxies/:id               # Proxy 详情
/client-keys               # Client Keys 列表与管理
/client-keys/:id           # Client Key 详情
/usage-logs                # Usage Logs（使用日志）
/events                    # Audit Events（审计事件）
/settings                  # 系统设置
```

### 3.2 页面功能详细设计

#### 3.2.1 Dashboard（首页）

**顶部关键指标卡片（4个）：**
- **Backends 健康度**：总数 / 健康数（normal 状态）/ 异常数（abnormal）
- **Client Keys 活跃度**：总数 / 最近 24 小时活跃数
- **24 小时请求数**：总请求数 / 增长率（与前一天对比）
- **错误率**：失败请求比例 / 最近错误数

**图表区域：**
- 折线图：24 小时请求趋势（成功 vs 失败）
- 数据来源：`GET /admin/api/dashboard/usage`

**表格：最近使用的 Backends**
- 显示最近 10 个活跃 Backend
- 列：名称、状态、请求数、平均延迟、最后使用时间
- 点击行跳转到详情页

**事件时间线：**
- 显示最近 20 条审计事件
- 数据来源：`GET /admin/api/dashboard/activity`

#### 3.2.2 Backends 管理页

**顶部工具栏：**
- 左侧：搜索框（支持名称、Console URL、Tags 搜索）
- 右侧：「新建 Backend」按钮

**数据表格：**
- **列定义**：
  - 名称 + 状态标签（normal/abnormal/disabled，不同颜色）
  - 支持的模型（Tags 展示，最多显示 3 个 + 「+N more」）
  - 权重 / 连续失败次数
  - 24 小时请求数 / 平均延迟（ms）
  - 最后使用时间
  - 操作按钮：编辑 / 删除 / 详情
- **行展开功能**：
  - Console URL（带跳转链接）
  - API Key（masked，点击复制）
  - 最近 5 条使用日志快照
  - Tags 完整列表

**侧边抽屉：创建/编辑 Backend**
- 表单字段：
  - 名称、URL、API Key
  - 协议（OpenAI / Anthropic）
  - 权重、状态（normal/disabled，abnormal 不可手动设置）
  - 模型映射（JSON 输入）
  - SOCKS Proxy（下拉选择）
  - Console 元数据：Console URL、Username、Password、Tags、Notes

**交互：**
- 删除前二次确认
- 创建成功后自动刷新列表
- 表单验证：URL 格式、权重范围、必填项

#### 3.2.3 Proxies 管理页

**表格列：**
- 名称
- 地址、端口
- 绑定的 Backend 数量
- 流量统计（请求数、平均延迟）
- 最后使用时间
- 操作：编辑 / 删除 / 详情

**侧边抽屉：创建/编辑 Proxy**
- 字段：名称、地址、端口、用户名、密码

#### 3.2.4 Client Keys 管理页

**表格列：**
- 名称
- Token（masked，仅显示前 8 位 + 后 4 位）
- 使用次数
- 最后使用时间
- 操作：编辑 / 删除 / 详情

**创建 Client Key 流程：**
- 提交后后端生成 Token
- 前端显示完整 Token（一次性，带复制按钮）
- 提示：「Token 仅显示一次，请妥善保存」
- 后续查看时仅显示 masked 版本

#### 3.2.5 Usage Logs 页面

**顶部筛选器：**
- 时间范围选择器（快捷选项：最近 1 小时 / 24 小时 / 7 天 / 自定义）
- 状态码筛选（下拉多选）
- Backend 筛选（下拉多选）
- Client Key 筛选（下拉多选）

**表格列：**
- 时间戳
- Client（显示 Client Key 名称）
- Endpoint
- Model
- Backend（显示名称 + 状态标签）
- 状态码（颜色标记：200 绿色 / 4xx 橙色 / 5xx 红色）
- 延迟（ms）
- Token 消耗（Input / Output / Total）

**行展开：**
- 请求详情：Headers（脱敏）、Body（JSON 格式化）
- 响应详情：Status、Body（JSON 格式化）
- 错误信息（如果失败）

**分页：**
- 默认每页 50 条
- 支持跳转到指定页

#### 3.2.6 Events 页面

**时间线视图：**
- 每个事件显示：
  - 图标（根据操作类型：创建 / 更新 / 删除）
  - 时间戳（相对时间 + 绝对时间 tooltip）
  - 操作类型 + 资源类型
  - 操作者（预留字段，当前为 "admin"）
  - 详情（可展开查看完整 JSON）

**筛选：**
- 时间范围
- 操作类型（创建 / 更新 / 删除）
- 资源类型（Backend / Proxy / Client Key）

#### 3.2.7 Settings 页面

**布局：**
- 左侧：导航（主题、服务器配置、后端配置、日志配置）
- 右侧：配置表单

**主题设置：**
- 选项：Light / Dark / System（跟随系统）
- 实时预览

**服务器配置：**
- `listen_addr`：监听地址和端口 ⚠️ 需重启生效
- `db_path`：数据库文件路径 ⚠️ 需重启生效

**后端配置：**
- `backend_cooldown`：Backend 异常恢复时间（如 "5m"）✓ 热更新
- `backend_fails`：导致 Backend 异常的失败次数 ✓ 热更新
- `request_timeout`：请求超时时间（如 "30s"）✓ 热更新
- `shutdown_timeout`：优雅关闭超时时间（如 "10s"）✓ 热更新

**日志配置：**
- `log_level`：日志级别（debug / info / warn / error）✓ 热更新

**交互：**
- 修改后点击「保存」按钮
- 热更新配置：保存后立即生效，显示 ✓ "已应用"
- 需重启配置：保存后显示 ⚠️ "已保存，需重启服务后生效"
- 可选功能：「重启服务」按钮（通过系统命令或提示用户手动重启）

**校验规则：**
- `listen_addr`：端口范围 1-65535
- 时间格式：支持 "5m", "30s", "1h" 等
- `backend_fails`：正整数
- `log_level`：枚举值

---

## 4. 组件设计

### 4.1 基础 UI 组件（`components/ui/`）

**按钮组件（Button）：**
- 变体：primary、secondary、ghost、danger、outline
- 尺寸：sm、md、lg
- 状态：default、hover、active、disabled、loading

**输入组件（Input / Textarea）：**
- 支持前缀图标、后缀图标
- 验证状态：default、error、success
- 尺寸：sm、md、lg

**选择组件（Select / Combobox）：**
- 单选、多选模式
- 搜索过滤
- 自定义选项渲染

**对话框组件（Dialog / Drawer）：**
- Dialog：居中模态框
- Drawer：侧边抽屉（右侧滑入）
- 支持嵌套、拖拽调整大小（可选）

**表格组件（Table）：**
- 排序（点击列头）
- 分页（前端分页 / 后端分页）
- 行展开（详情展示）
- 行选择（多选框）
- 固定列（左侧固定）

**状态组件：**
- Badge：状态标签（支持颜色、尺寸、圆点）
- Tooltip：悬浮提示
- Toast：通知提示（成功、错误、警告、信息）
- LoadingSpinner：加载动画
- Skeleton：骨架屏

**其他组件：**
- Card：内容卡片
- Switch：开关
- Tabs：标签页
- EmptyState：空状态占位

### 4.2 业务组件（`components/features/`）

**BackendStatusBadge：**
- 根据状态显示不同颜色：
  - normal：绿色
  - abnormal：橙色
  - disabled：灰色

**BackendForm：**
- 创建/编辑 Backend 的完整表单
- 集成表单验证
- 模型映射 JSON 编辑器（带语法高亮）

**ProxyForm：**
- 创建/编辑 Proxy 的表单

**ClientKeyForm：**
- 创建/编辑 Client Key 的表单
- 创建后显示完整 Token（一次性）

**UsageLogRow：**
- 日志表格行组件
- 支持展开显示请求/响应详情
- JSON 格式化显示

**EventTimeline：**
- 事件时间线组件
- 图标 + 时间戳 + 描述

**StatsCard：**
- Dashboard 统计卡片
- 显示数值、增长趋势、图标

**ChartWidget：**
- 图表容器组件
- 集成 Chart.js/ECharts

### 4.3 布局组件（`layouts/`）

**DefaultLayout：**
- 侧边栏 + 顶栏 + 主内容区
- 响应式布局（移动端侧边栏折叠）

**EmptyLayout：**
- 纯内容区（用于登录页等，预留）

---

## 5. 状态管理

### 5.1 Store 设计（Pinia）

**useAppStore（全局应用状态）：**
```typescript
{
  theme: 'light' | 'dark' | 'system',
  sidebarCollapsed: boolean,
  isLoading: boolean,
  toasts: Toast[],
  
  setTheme(theme),
  toggleSidebar(),
  addToast(toast),
  removeToast(id)
}
```

**useBackendsStore（Backends 管理）：**
```typescript
{
  backends: Backend[],
  selectedBackend: Backend | null,
  pagination: { page, limit, total },
  
  fetchBackends(params),
  fetchBackendDetail(id),
  createBackend(data),
  updateBackend(id, data),
  deleteBackend(id),
  searchBackends(query)
}
```

**useProxiesStore（Proxies 管理）：**
```typescript
{
  proxies: SocksProxy[],
  
  fetchProxies(params),
  createProxy(data),
  updateProxy(id, data),
  deleteProxy(id)
}
```

**useClientKeysStore（Client Keys 管理）：**
```typescript
{
  clientKeys: ClientKey[],
  
  fetchClientKeys(params),
  createClientKey(data),
  updateClientKey(id, data),
  deleteClientKey(id)
}
```

**useDashboardStore（Dashboard 数据）：**
```typescript
{
  summary: DashboardSummary,
  usageData: UsageData[],
  activityEvents: AuditEvent[],
  
  fetchSummary(),
  fetchUsage(range),
  fetchActivity()
}
```

**useConfigStore（配置管理）：**
```typescript
{
  config: Config,
  
  fetchConfig(),
  updateConfig(data),
  reloadConfig() // 热更新配置
}
```

### 5.2 Composables（可复用逻辑）

**useApi()：**
- 封装 Axios 实例
- 统一错误处理
- 加载状态管理

**useTable()：**
- 表格分页逻辑
- 排序逻辑
- 筛选逻辑

**useForm()：**
- 表单验证
- 提交状态管理
- 错误处理

**useTheme()：**
- 主题切换逻辑
- 本地存储持久化
- 监听系统主题变化

**useDebounce()：**
- 防抖（搜索输入等）

**usePolling()：**
- 轮询逻辑（实时状态更新）

---

## 6. 视觉设计系统

### 6.1 设计原则

**简约专业（Vercel/Linear/Stripe 风格）：**
- 大量留白，视觉呼吸感
- 微妙阴影，避免过重边框
- 优雅过渡动画（200-300ms）
- 克制的色彩使用

### 6.2 排版系统

**字体：**
- 英文：Inter
- 中文：PingFang SC / Microsoft YaHei
- 等宽：JetBrains Mono（代码、日志）

**字号层级：**
- `xs: 12px` - 辅助文字、标签
- `sm: 14px` - 正文、表格内容
- `base: 16px` - 默认正文
- `lg: 20px` - 小标题
- `xl: 24px` - 页面标题
- `2xl: 32px` - 大标题

**行高：**
- 正文：1.5
- 标题：1.2

**字重：**
- 常规：400
- 中等：500
- 加粗：600

### 6.3 色彩系统

**Light Mode：**
```css
--bg-base: #ffffff
--bg-subtle: #fafafa
--bg-muted: #f5f5f5
--border: #e5e5e5
--border-hover: #d4d4d4
--text-primary: #171717
--text-secondary: #737373
--text-tertiary: #a3a3a3
--accent-primary: #0070f3
--accent-hover: #0761d1
--success: #16a34a
--warning: #f59e0b
--danger: #ef4444
```

**Dark Mode：**
```css
--bg-base: #000000
--bg-subtle: #0a0a0a
--bg-muted: #171717
--border: #262626
--border-hover: #404040
--text-primary: #ededed
--text-secondary: #a3a3a3
--text-tertiary: #737373
--accent-primary: #3291ff
--accent-hover: #0070f3
--success: #22c55e
--warning: #fbbf24
--danger: #f87171
```

### 6.4 间距系统（8px 基准）

```
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
3xl: 64px
```

### 6.5 圆角

```
sm: 6px
md: 8px
lg: 12px
xl: 16px
```

### 6.6 阴影

```
sm: 0 1px 2px rgba(0,0,0,0.04)
md: 0 4px 16px rgba(0,0,0,0.08)
lg: 0 12px 32px rgba(0,0,0,0.12)
```

### 6.7 关键界面元素

**侧边栏：**
- 宽度：240px（展开）/ 64px（折叠）
- 半透明背景 + backdrop-blur
- 导航项：悬浮时背景微变
- 折叠时仅显示图标

**顶栏：**
- 高度：64px
- 毛玻璃效果（backdrop-filter: blur(12px)）
- 左侧：面包屑导航
- 右侧：搜索 + 主题切换

**数据表格：**
- 行高：48px
- 悬浮时行背景微变
- 状态标签：圆角 badge
- 操作按钮：ghost 风格

**表单：**
- 输入框高度：40px
- Focus 状态：蓝色边框 + 外发光
- 错误状态：红色边框 + 错误文案
- 布局：标签（120px）+ 输入框

**卡片：**
- 白色背景 + 微妙边框
- 悬浮时轻微上浮（transform: translateY(-2px)）
- Padding：24px

---

## 7. 数据流与错误处理

### 7.1 API 客户端设计

**目录结构（`src/api/`）：**
```
api/
├── client.ts           # Axios 实例 + 拦截器
├── types.ts            # API 请求/响应类型
├── backends.ts         # Backends 相关接口
├── proxies.ts          # Proxies 相关接口
├── clientKeys.ts       # Client Keys 相关接口
├── usageLogs.ts        # Usage Logs 相关接口
├── events.ts           # Events 相关接口
├── dashboard.ts        # Dashboard 相关接口
└── config.ts           # Config 相关接口
```

**Axios 拦截器职责：**

**请求拦截器：**
- 添加 `Content-Type: application/json`
- 显示全局 loading 状态
- 请求去重（防止重复提交）

**响应拦截器：**
- 统一错误处理（401/403/404/500）
- 数据转换（驼峰命名转换，可选）
- Toast 通知（成功/失败提示）
- 关闭 loading 状态

### 7.2 错误处理策略

**1. 网络错误：**
- 显示 Toast："网络连接失败，请检查网络"
- 表格/列表显示空状态 + 重试按钮

**2. 业务错误：**
- 400：表单验证错误，显示字段级错误提示
- 404：资源不存在，跳转到 404 页面
- 500：服务器错误，显示错误页面 + 错误码

**3. 超时处理：**
- 请求超时（30s）：显示 Toast + 重试按钮

**4. 乐观更新：**
- 删除操作：立即从列表移除，失败后回滚 + Toast
- 状态切换：立即更新 UI，失败后回滚

### 7.3 加载状态管理

**全局 Loading：**
- 页面切换、首次数据加载时显示顶部进度条（NProgress 风格）

**局部 Loading：**
- 表格数据加载：Skeleton 占位符
- 按钮提交：按钮显示 Spinner + 禁用
- 抽屉/对话框：内容区域 Skeleton

**空状态：**
- 无数据时显示插画 + 提示文案 + 操作按钮（如"创建第一个 Backend"）

---

## 8. Settings 配置管理实现

### 8.1 后端 API 设计

**新增接口：**

```
GET  /admin/api/config
```
**响应示例：**
```json
{
  "listen_addr": ":4000",
  "db_path": "./token-gate.db",
  "log_level": "info",
  "backend_cooldown": "5m",
  "backend_fails": 3,
  "request_timeout": "30s",
  "shutdown_timeout": "10s"
}
```

```
PUT  /admin/api/config
```
**请求体：**
```json
{
  "listen_addr": ":4000",
  "db_path": "./token-gate.db",
  "log_level": "debug",
  "backend_cooldown": "10m",
  "backend_fails": 5,
  "request_timeout": "60s",
  "shutdown_timeout": "15s"
}
```

**响应：**
- 200：配置已保存
- 400：验证失败（返回错误详情）

```
POST /admin/api/config/reload
```
- 触发热更新配置的重新加载
- 仅对支持热更新的配置生效

### 8.2 配置持久化方案

**SQLite `settings` 表：**
```sql
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
```

**启动时加载逻辑：**
1. 从 SQLite `settings` 表读取配置
2. 如果表中无数据，使用环境变量默认值
3. 将最终配置保存到内存中

**用户修改配置流程：**
1. 前端调用 `PUT /admin/api/config`
2. 后端验证配置值
3. 保存到 SQLite `settings` 表
4. 对于热更新配置，立即应用
5. 对于需重启配置，仅持久化，等待重启

### 8.3 热更新机制

**实现方式：**

**`log_level`：**
```go
// 运行时修改日志级别
slog.SetLogLoggerLevel(newLevel)
```

**`backend_cooldown`、`backend_fails`：**
```go
// 更新 scheduler.Service 的配置字段
app.scheduler.UpdateConfig(cooldown, fails)
```

**`request_timeout`、`shutdown_timeout`：**
```go
// 更新 proxy.Service 和 App 的配置字段
app.proxy.UpdateTimeout(timeout)
app.cfg.ShutdownTimeout = shutdownTimeout
```

### 8.4 前端交互

**配置表单：**
- 每个配置项显示：
  - 标签（如"日志级别"）
  - 描述（如"控制日志输出的详细程度"）
  - 输入框 / 选择框
  - 标记：✓ "热更新" 或 ⚠️ "需重启生效"

**保存流程：**
1. 用户修改配置，点击"保存"
2. 前端验证输入
3. 调用 `PUT /admin/api/config`
4. 成功后：
   - 热更新配置：显示 ✓ "已应用"
   - 需重启配置：显示 ⚠️ "已保存，需重启服务后生效"
5. 失败后：显示错误 Toast

---

## 9. 测试策略

### 9.1 前端测试

**单元测试（Vitest）：**
- 工具函数测试（`utils/` 下的纯函数）
- Composables 测试（`useTable`、`useForm` 等）
- 组件逻辑测试（基础 UI 组件）

**测试覆盖目标：**
- 工具函数：80%+
- Composables：70%+
- 关键组件：60%+

**组件测试（Vitest + Testing Library）：**
- 关键业务组件：`BackendForm`、`ProxyForm`、`ClientKeyForm`
- 表格交互：排序、分页、行展开
- 表单验证：输入校验、错误提示

**E2E 测试（可选，Playwright）：**
- 关键流程：创建 Backend → 查看详情 → 编辑 → 删除
- 主题切换
- 配置保存

### 9.2 开发工具链

**代码质量：**
- ESLint + Prettier：代码风格统一
- TypeScript strict mode：类型安全
- Husky + lint-staged：提交前检查

**开发体验：**
- Vite HMR：热模块替换
- Vue DevTools：组件调试
- API Mock（可选）：MSW 模拟后端

### 9.3 构建优化

**性能优化：**
- 路由懒加载：`const Dashboard = () => import('./pages/Dashboard.vue')`
- 组件懒加载：大型组件按需加载
- Tree-shaking：未使用代码自动剔除
- 资源压缩：Gzip / Brotli

**产物优化：**
- 目标目录：`dist/` → `../web/`
- Hash 文件名：缓存优化
- Vendor chunk：第三方库单独打包
- CSS 提取：单独的 CSS 文件

---

## 10. 实施计划

### 10.1 阶段划分

**阶段 1：基础架构搭建（2-3 天）**
- 创建 Vue 3 + Vite 项目
- 配置 TypeScript、ESLint、Prettier
- 搭建基础目录结构
- 配置 Vue Router、Pinia
- 实现主题系统（Light/Dark）
- 搭建布局组件（侧边栏 + 顶栏）

**阶段 2：基础 UI 组件库（3-4 天）**
- 实现 Button、Input、Select、Dialog、Drawer
- 实现 Table、Badge、Tooltip、Toast
- 实现 Card、Switch、Tabs
- 实现 LoadingSpinner、Skeleton、EmptyState
- 组件文档和 Storybook（可选）

**阶段 3：API 集成与状态管理（2-3 天）**
- 配置 Axios 客户端
- 实现请求/响应拦截器
- 实现所有 API 模块（backends、proxies 等）
- 实现所有 Pinia stores
- 实现 Composables

**阶段 4：核心页面实现（5-6 天）**
- Dashboard 页面
- Backends 管理页面
- Proxies 管理页面
- Client Keys 管理页面
- Usage Logs 页面
- Events 页面

**阶段 5：Settings 配置管理（2-3 天）**
- 后端新增配置管理 API
- 前端 Settings 页面实现
- 热更新机制实现
- 配置验证与错误处理

**阶段 6：测试与优化（2-3 天）**
- 单元测试编写
- 组件测试编写
- E2E 测试（可选）
- 性能优化
- 构建产物优化

**阶段 7：部署与文档（1-2 天）**
- 调整 Go embed 配置
- 验证生产构建流程
- 编写部署文档
- 编写开发文档

### 10.2 风险与对策

**风险 1：UI 组件库选型（Radix Vue 学习曲线）**
- 对策：可先用现成的组件库（如 Element Plus、Ant Design Vue）快速验证，后续再迁移

**风险 2：与现有后端 API 兼容性问题**
- 对策：先实现一个页面（如 Backends）验证 API 集成，确认无问题后再扩展

**风险 3：主题系统复杂度**
- 对策：使用 CSS Variables，保持主题切换逻辑简单

**风险 4：构建产物路径配置错误**
- 对策：早期验证构建流程，确保 Go embed 能正确读取

---

## 11. 验收标准

### 11.1 功能验收

- [ ] 所有页面功能完整实现
- [ ] Dark/Light 主题切换正常
- [ ] 所有表单验证正常
- [ ] 所有 API 调用正常
- [ ] 错误处理正常（网络错误、业务错误）
- [ ] Settings 配置管理正常（热更新/需重启分类正确）
- [ ] 响应式布局正常（桌面端 + 移动端）

### 11.2 性能验收

- [ ] 首屏加载时间 < 2s
- [ ] 页面切换流畅（无明显卡顿）
- [ ] 表格分页、排序响应快速
- [ ] 构建产物体积合理（< 2MB gzipped）

### 11.3 代码质量验收

- [ ] TypeScript 类型覆盖率 > 90%
- [ ] ESLint 无错误
- [ ] 单元测试覆盖率 > 60%
- [ ] 组件测试覆盖关键流程

### 11.4 兼容性验收

- [ ] Chrome、Firefox、Safari、Edge 最新版本正常
- [ ] 桌面端分辨率：1920x1080、1440x900、1366x768 正常
- [ ] 移动端分辨率：375x667（iPhone SE）、414x896（iPhone 11）正常

---

## 12. 附录

### 12.1 后端 API 清单（现有）

**Dashboard：**
- `GET /admin/api/overview`
- `GET /admin/api/dashboard/summary`
- `GET /admin/api/dashboard/usage`
- `GET /admin/api/dashboard/activity`

**Backends：**
- `GET /admin/api/backends`
- `GET /admin/api/backends/{id}/detail`
- `POST /admin/api/backends`
- `PUT /admin/api/backends/{id}`
- `DELETE /admin/api/backends/{id}`

**Proxies：**
- `GET /admin/api/socks-proxies`
- `GET /admin/api/socks-proxies/{id}/detail`
- `POST /admin/api/socks-proxies`
- `PUT /admin/api/socks-proxies/{id}`
- `DELETE /admin/api/socks-proxies/{id}`

**Client Keys：**
- `GET /admin/api/client-keys`
- `GET /admin/api/client-keys/{id}/detail`
- `POST /admin/api/client-keys`
- `PUT /admin/api/client-keys/{id}`
- `DELETE /admin/api/client-keys/{id}`

**Usage Logs：**
- `GET /admin/api/usage-logs`
- `GET /admin/api/usage-logs/stats`
- `GET /admin/api/usage-logs/{id}`
- `GET /admin/api/usage-log-options`
- `DELETE /admin/api/usage-logs`

**Events：**
- `GET /admin/api/events`
- `GET /admin/api/events/summary`
- `GET /admin/api/events/{id}`

**Search：**
- `GET /admin/api/search`

### 12.2 后端 API 新增（Settings）

**Config：**
- `GET /admin/api/config` - 获取当前配置
- `PUT /admin/api/config` - 更新配置
- `POST /admin/api/config/reload` - 热重载配置

### 12.3 技术选型理由

**Vue 3：**
- Composition API 更适合复杂状态管理
- 生态成熟，社区活跃
- TypeScript 支持良好

**Vite：**
- 开发服务器启动极快
- HMR 速度快
- 构建产物优化良好

**Pinia：**
- Vue 官方推荐
- TypeScript 支持良好
- API 简洁

**Radix Vue：**
- 无样式组件库，灵活定制
- 可访问性良好（ARIA）
- 适合打造独特设计

---

## 13. 总结

本设计方案提供了一个完整的前端 UI 重新实现路径，核心目标是：

1. **现代化技术栈**：Vue 3 + TypeScript + Vite
2. **简约专业设计**：Vercel/Linear 风格，Dark/Light 主题
3. **无缝集成**：构建产物嵌入 Go，统一启动
4. **功能完整**：覆盖所有现有功能 + Settings 配置管理
5. **可维护性**：清晰的组件设计、状态管理、错误处理

设计方案已充分考虑实施可行性、性能优化、测试策略和风险对策，为后续实施提供了清晰的路线图。
