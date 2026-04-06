# Task Sentinel

轻量级任务心跳监控工具。用于追踪定时任务（备份、同步、数据库导出等）是否按时执行，当任务离线或失败时通过 Telegram 发送告警。

## 功能特性

- **心跳监控** — 任务通过简单的 HTTP ping 上报状态；若在配置的超时时间内未收到 ping，任务将被标记为离线。
- **Telegram 告警** — 任务超时或失败时发送通知，支持配置重复告警间隔。
- **仪表盘 UI** — 基于 React + shadcn/ui 构建的简洁 Web 前端，一目了然查看所有任务状态。
- **Ping 历史** — 查看每个任务的完整上报日志。
- **配置驱动** — 在 `config.yml` 中定义任务，启动时自动创建和更新。
- **一键部署** — 前端构建产物内嵌于 Docker 镜像，由后端统一提供服务。

## 架构

```
定时任务  ──(HTTP POST /api/v1/ping)──►  后端 (FastAPI)
                                              │
                                         调度器每隔 N 秒
                                         检查超时状态
                                              │
                                         Telegram 告警 ◄──┘

浏览器  ──(HTTP GET /api/v1/dashboard)──►  后端 ──► React SPA
```

- **后端**：FastAPI + SQLAlchemy (async) + SQLite + APScheduler
- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui

## 快速开始

### Docker Compose（推荐）

1. 复制并编辑环境变量文件：

```bash
cp .env.example .env
# 编辑 .env —— 设置 API_TOKEN、TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID 等
```

2. 编辑 `config.yml` 定义你的任务：

```yaml
tasks:
  - id: restic_nas_backup
    name: "Restic NAS 备份"
    timeout_hours: 24
    alert_interval_hours: 4

  - id: db_dump
    name: "数据库导出"
    timeout_hours: 6
    alert_interval_hours: 1
```

3. 启动服务：

```bash
docker compose up -d
```

4. 打开 `http://localhost:8000` 查看仪表盘。

### 手动启动

**后端：**

```bash
cd backend
pip install -r requirements.txt
cd ..
uvicorn backend.app.main:app --host 0.0.0.0 --port 8000
```

**前端（开发模式）：**

```bash
cd frontend
npm install
npm run dev
```

## API

### Ping（上报心跳）

```bash
curl -X POST http://localhost:8000/api/v1/ping \
  -H "Authorization: Bearer YOUR_API_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"task_id": "db_dump", "status": "success", "message": "导出完成"}'
```

- `status`：`success`（成功）或 `failed`（失败）
- `message`：可选的文本备注

### 仪表盘

```
GET /api/v1/dashboard
```

返回所有任务及状态统计（无需认证）。

### 任务列表 / 详情 / 日志

```
GET /api/v1/tasks
GET /api/v1/tasks/{task_id}
GET /api/v1/tasks/{task_id}/logs?limit=50
```

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `API_TOKEN` | `change-me-in-production` | 用于认证 ping 请求的令牌 |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/task_sentinel.db` | SQLAlchemy 异步数据库连接地址 |
| `CONFIG_PATH` | `./config.yml` | 任务配置文件路径 |
| `TELEGRAM_BOT_TOKEN` | _（空）_ | Telegram 机器人 Token |
| `TELEGRAM_CHAT_ID` | _（空）_ | Telegram 聊天 ID |
| `TELEGRAM_PROXY` | _（空）_ | Telegram API 的 HTTP 代理地址 |
| `CHECK_INTERVAL_SECONDS` | `60` | 调度器检查超时的间隔（秒） |
| `FRONTEND_DIST` | _（空）_ | 自定义前端构建产物的路径 |

## 使用示例

在定时任务脚本的末尾添加一个 ping 调用：

```bash
#!/bin/bash
# restic-backup.sh
restic backup /data ...

curl -s -X POST http://sentinel:8000/api/v1/ping \
  -H "Authorization: Bearer my-secret-token" \
  -H "Content-Type: application/json" \
  -d "{\"task_id\": \"restic_nas_backup\", \"status\": \"success\", \"message\": \"$(date)\"}"
```

如果该脚本未在 `timeout_hours` 时间内执行（或未调用 ping 接口），Task Sentinel 会将其标记为离线并通过 Telegram 发送告警。

## 许可证

MIT
