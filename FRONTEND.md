# Token Gate - Frontend Development Guide

## Quick Start

### Development Mode (Hot Reload)

启动前后端开发服务器：

```bash
./dev.sh
```

这会启动：
- **Go 后端**: http://localhost:5000 (API)
- **Vue 前端**: http://localhost:5173 (带热重载)

前端开发服务器会自动代理 `/admin/api/*` 请求到后端。

### Production Mode

构建前端并启动生产服务：

```bash
./start-prod.sh
```

这会：
1. 构建前端（输出到 `web/` 目录）
2. 启动 Go 服务器，嵌入前端静态文件
3. 访问 http://localhost:5000/admin/ 可看到完整应用

## 项目结构

```
token-gate/
├── frontend/              # Vue 3 前端项目
│   ├── src/
│   │   ├── api/          # API 客户端
│   │   │   ├── client.ts     # Axios 实例
│   │   │   ├── types.ts      # API 类型定义
│   │   │   ├── backends.ts   # Backends API
│   │   │   ├── proxies.ts    # Proxies API
│   │   │   ├── clientKeys.ts # Client Keys API
│   │   │   ├── usageLogs.ts  # Usage Logs API
│   │   │   ├── events.ts     # Events API
│   │   │   ├── dashboard.ts  # Dashboard API
│   │   │   └── config.ts     # Config API
│   │   ├── components/   # UI 组件
│   │   │   ├── ui/           # 通用 UI 组件
│   │   │   ├── backends/     # Backends 组件
│   │   │   ├── proxies/      # Proxies 组件
│   │   │   ├── clientKeys/   # Client Keys 组件
│   │   │   ├── usageLogs/    # Usage Logs 组件
│   │   │   └── events/       # Events 组件
│   │   ├── composables/  # Vue 组合式函数
│   │   │   └── useTheme.ts   # 主题切换
│   │   ├── layouts/      # 布局组件
│   │   │   └── DefaultLayout.vue
│   │   ├── pages/        # 页面视图（6个完整页面）
│   │   │   ├── Dashboard.vue     # 仪表盘
│   │   │   ├── Backends.vue      # 后端管理
│   │   │   ├── Proxies.vue       # 代理管理
│   │   │   ├── ClientKeys.vue    # 客户端密钥
│   │   │   ├── UsageLogs.vue     # 使用日志
│   │   │   ├── Events.vue        # 审计事件
│   │   │   ├── Settings.vue      # 系统设置
│   │   │   └── BackendDetail.vue # 后端详情
│   │   ├── router/       # 路由配置
│   │   │   └── index.ts
│   │   ├── stores/       # Pinia 状态管理
│   │   │   ├── app.ts            # 应用状态
│   │   │   ├── dashboard.ts      # 仪表盘状态
│   │   │   ├── backends.ts       # Backends 状态
│   │   │   ├── proxies.ts        # Proxies 状态
│   │   │   ├── clientKeys.ts     # Client Keys 状态
│   │   │   ├── usageLogs.ts      # Usage Logs 状态
│   │   │   ├── events.ts         # Events 状态
│   │   │   └── settings.ts       # Settings 状态
│   │   ├── styles/       # 全局样式
│   │   │   ├── variables.css     # CSS 变量（主题）
│   │   │   └── global.css        # 全局样式
│   │   └── main.ts       # 应用入口
│   ├── vite.config.ts    # Vite 配置
│   └── package.json
│
├── web/                  # 前端构建产物（Git 跟踪）
│   ├── index.html        # 入口 HTML
│   └── assets/           # 静态资源（28个文件，340KB）
├── internal/             # Go 后端代码
│   └── app/
│       └── app.go        # 包含 //go:embed web/*
├── dev.sh               # 开发环境启动脚本
└── start-prod.sh        # 生产环境启动脚本
└── start-prod.sh        # 生产环境启动脚本
```

## 技术栈

**前端:**
- Vue 3.4+ (Composition API)
- TypeScript 5+
- Vite 5+ (构建工具)
- Vue Router 4 (路由)
- Pinia (状态管理)
- Axios (HTTP 客户端)

**后端:**
- Go
- SQLite

## 开发工作流

### 仅开发前端

```bash
cd frontend
npm run dev
```

### 仅开发后端

```bash
go run ./cmd/token-gate
```

### 构建前端

```bash
cd frontend
npm run build
```

构建产物会输出到 `../web/` 目录。

### 类型检查

```bash
cd frontend
npm run build:check  # TypeScript 类型检查 + 构建
```

## 主题切换

前端支持 Light/Dark 主题切换，主题设置保存在 localStorage。

## API 端点

前端通过以下端点与后端通信：

- `GET /admin/api/dashboard/*` - Dashboard 数据
- `GET/POST/PUT/DELETE /admin/api/backends` - Backends 管理
- `GET/POST/PUT/DELETE /admin/api/socks-proxies` - Proxies 管理
- `GET/POST/PUT/DELETE /admin/api/client-keys` - Client Keys 管理
- `GET /admin/api/usage-logs` - 使用日志
- `GET /admin/api/events` - 审计事件
- `GET/PUT /admin/api/config` - 配置管理

## 故障排查

### 前端无法连接后端

确保后端运行在 `:4000` 端口。检查 `frontend/vite.config.ts` 中的 proxy 配置。

### 构建失败

删除 `node_modules` 和 `package-lock.json`，重新安装：

```bash
cd frontend
rm -rf node_modules package-lock.json
npm install
```

### Go 无法找到前端文件

确保 `web/` 目录包含构建产物：

```bash
cd frontend
npm run build
ls ../web/  # 应该看到 index.html 和 assets/
```
