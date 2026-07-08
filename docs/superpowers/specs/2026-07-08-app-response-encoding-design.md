# Token Gate App 压缩响应处理设计

**日期**: 2026-07-08  
**状态**: 已确认  
**负责人**: AI Agent

## 1. 目标

为网关增加对上游压缩响应的处理能力，支持以下 `Content-Encoding`：

- `gzip`
- `deflate`
- `br`
- `zstd`

当客户端请求携带 `Accept-Encoding` 且上游返回压缩响应时，网关需要：

- 保留并转发客户端的 `Accept-Encoding` 给上游
- 在网关内部解压响应体，供 usage 提取、错误预览、SSE 解析和跨协议响应转换使用
- 向客户端返回解压后的明文响应，不再返回压缩后的响应体

## 2. 非目标

- 不修改前端
- 不修改 usage 归一化规则
- 不修改 model mapping 语义
- 不支持除 `gzip`、`deflate`、`br`、`zstd` 以外的其他编码
- 不在 `proxy` 层新增业务相关响应改写

## 3. 现状问题

当前实现为了保证 usage 提取和响应改写可读，会在发往上游前删除 `Accept-Encoding`。这会带来两个问题：

- 上游即使支持压缩，也无法按客户端协商返回压缩内容
- 某些供应商在压缩响应场景下的真实返回路径与生产环境不一致，usage 日志无法覆盖这类情况

## 4. 方案

### 4.1 模块落点

核心逻辑放在 `internal/app`，新增一个仅负责响应编解码的辅助文件，例如 `response_encoding.go`。

`internal/proxy` 只做一处配合性修改：

- 不再删除请求头中的 `Accept-Encoding`
- 继续保留 `http.Transport.DisableCompression = true`

这样可以保证上游返回的压缩字节流原样进入 `app`，由 `app` 统一处理。

### 4.2 App 层处理流程

在 `app` 中新增响应标准化步骤，位于以下场景之前：

- 非 2xx 响应的 usage / 预览记录
- 2xx 响应的 `exchange.AdaptResponse`
- 最终写回客户端

处理步骤如下：

1. 读取上游响应体原始字节
2. 根据 `Content-Encoding` 判断是否需要解压
3. 如果是支持的编码，则解压为明文字节
4. 基于明文字节构造一个新的 `http.Response` 副本：
   - 删除 `Content-Encoding`
   - 删除或重算 `Content-Length`
   - 保留其他响应头
5. 后续所有日志、usage 提取、协议转换、下游回写都使用该解压后的响应副本

### 4.3 支持的编码

- `gzip`: 使用标准库 `compress/gzip`
- `deflate`: 使用标准库 `compress/zlib`
- `br`: 使用 `github.com/andybalholm/brotli`
- `zstd`: 使用 `github.com/klauspost/compress/zstd`

编码匹配采用不区分大小写的精确值匹配；如果 `Content-Encoding` 为空，则按未压缩响应处理。

### 4.4 错误处理

如果上游响应声明了受支持的编码，但解压失败：

- 当前 backend 视为本次响应失败
- 记录错误日志和 usage log 错误信息
- 走现有 backend failover / 失败处理逻辑
- 不把损坏的压缩流继续回给客户端

如果 `Content-Encoding` 不是本次支持的四种之一，则不做新支持，沿用当前未支持行为。

### 4.5 对现有逻辑的影响

- `handler.CloneResponseForLogging` 和 usage 归一化逻辑不需要理解压缩格式；它们继续处理普通明文响应
- `proxy.translate` 中的 JSON / SSE 转换逻辑不需要改协议语义，只消费解压后的 body
- 客户端将收到明文响应，因此返回头中不应再保留 `Content-Encoding`

## 5. 测试设计

测试放在现有后端测试中，优先覆盖 `internal/app/app_test.go`。

### 5.1 回归测试调整

替换当前“上游不接收 `Accept-Encoding`”测试为以下断言：

- 上游能收到客户端传入的 `Accept-Encoding`
- 上游返回压缩响应时，客户端收到的是解压后的明文
- usage token 仍然正确落库

### 5.2 新增覆盖

至少覆盖以下场景：

- `gzip` JSON 响应
- `deflate` JSON 响应
- `br` JSON 响应
- `zstd` JSON 响应
- 至少一种压缩 SSE 响应，确认流式 usage 提取仍然正确

测试夹具需要能够根据指定编码压缩上游假响应体。

## 6. 验证

实现完成后按以下顺序验证：

1. 目标测试先跑红绿循环
2. 针对 `internal/app` 的压缩相关测试通过
3. `GOCACHE=/root/workspace/token-gate/.gocache go test ./...`

## 7. 风险与约束

- `br` / `zstd` 需要新增依赖，需保持依赖范围最小
- 响应标准化会在 `app` 层完整读取上游 body；这与当前 usage 记录和响应转换流程一致，不额外引入新的缓冲模式
- 该方案不解决“响应中的 `model` 是否映射回客户端模型名”问题，该行为保持不变
