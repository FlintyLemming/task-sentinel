# Task Sentinel

轻量级任务心跳监控工具。用于追踪定时任务（备份、同步、数据库导出等）是否按时执行，当任务离线或失败时通过 Telegram 发送告警。

## 功能特性

- **心跳监控** — 任务通过简单的 HTTP ping 上报状态；若在配置的超时时间内未收到 ping，任务将被标记为离线。
- **在线任务管理** — 通过 Web UI 创建、编辑和删除任务，无需维护 `config.yml`。
- **管理员登录** — 默认只读可查看仪表盘；点击 `Admin` 输入管理员密码后启用管理操作。
- **Telegram 告警** — 任务超时或失败时发送通知，支持配置重复告警间隔。
- **仪表盘 UI** — 基于 React + shadcn/ui 构建的简洁 Web 前端，一目了然查看所有任务状态。
- **任务详情页** — 查看任务配置、90 天运行状态时间线和完整 ping 历史。
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
浏览器  ──(Admin 登录 + CRUD API)───────►  后端 ──► SQLite
```

- **后端**：FastAPI + SQLAlchemy (async) + SQLite + APScheduler + JWT
- **前端**：React 19 + TypeScript + Vite + Tailwind CSS + shadcn/ui

## 快速开始

### Docker 部署（推荐）

1. 复制并编辑环境变量文件：

```bash
cp .env.example .env
# 编辑 .env —— 设置 API_TOKEN、ADMIN_PASSWORD、JWT_SECRET、TELEGRAM_BOT_TOKEN、TELEGRAM_CHAT_ID 等
```

2. 创建数据目录：

```bash
mkdir -p data
```

3. 使用以下任一 Docker Compose 配置启动服务（本仓库不保留 `docker-compose.yml` 文件；如需使用，请在部署环境自行创建）：

**使用预编译镜像（推荐）：**

```yaml
services:
  app:
    image: git.mitsea.com/flintylemming/task-sentinel:latest
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    restart: unless-stopped
```

**从本地源码构建：**

```yaml
services:
  app:
    build: .
    ports:
      - "8000:8000"
    volumes:
      - ./data:/app/data
    env_file:
      - .env
    restart: unless-stopped
```

4. 启动服务：

```bash
docker compose up -d
```

5. 打开 `http://localhost:8000` 查看仪表盘。默认可以只读查看；点击 `Admin` 并输入 `ADMIN_PASSWORD` 后即可在线创建和管理任务。

### 手动启动

**后端：**

```bash
cd backend
pip install -r requirements.txt
python -m uvicorn app.main:app --host 0.0.0.0 --port 8000
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

### 管理员登录

```bash
curl -X POST http://localhost:8000/api/v1/auth/check \
  -H "Content-Type: application/json" \
  -d '{"password": "YOUR_ADMIN_PASSWORD"}'
```

返回 JWT，用于调用任务管理接口。

### 仪表盘

```http
GET /api/v1/dashboard
```

返回所有任务及状态统计（无需认证）。

### 任务列表 / 详情 / 日志 / 运行状态

```http
GET /api/v1/tasks
GET /api/v1/tasks/{task_id}
GET /api/v1/tasks/{task_id}/logs?limit=50&offset=0
GET /api/v1/tasks/{task_id}/uptime?days=90
```

### 任务管理（需要管理员 JWT）

```http
POST /api/v1/tasks
PATCH /api/v1/tasks/{task_id}
DELETE /api/v1/tasks/{task_id}
GET /api/v1/auth/api-token
```

`GET /api/v1/auth/api-token` 返回 `API_TOKEN`，前端登录后据此在接入指南的复制命令中直接填入真实 Token。

## 配置

### 环境变量

| 变量 | 默认值 | 说明 |
|---|---|---|
| `API_TOKEN` | `change-me-in-production` | 用于认证 ping 请求的令牌 |
| `ADMIN_PASSWORD` | `admin` | Web UI 管理员密码 |
| `JWT_SECRET` | `change-me-in-production` | 签发管理员 JWT 的密钥，生产环境必须修改 |
| `DATABASE_URL` | `sqlite+aiosqlite:///./data/task_sentinel.db` | SQLAlchemy 异步数据库连接地址 |
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

如果该脚本未在任务配置的超时时间内执行（或未调用 ping 接口），Task Sentinel 会将其标记为离线并通过 Telegram 发送告警。

## 许可证

MIT
