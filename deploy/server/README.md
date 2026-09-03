# JobTrace 自托管部署包

这套文件用于将 JobTrace 部署到一台使用 systemd 的 Linux 服务器。应用以 Next.js standalone 模式运行，招聘来源由服务器自己的 systemd timer 每六小时同步，不依赖 GitHub Actions。

## 服务器要求

- Debian 12、Ubuntu 24.04 或其他使用 systemd 的 Linux
- Node.js 24+
- pnpm 10+
- Python 3.12、uv、rsync、curl、jq、util-linux
- 可连接的 PostgreSQL 17
- Nginx、Caddy 或其他 HTTPS 反向代理
- SSH 用户具有 `sudo` 权限

Ubuntu/Debian 上至少需要：

```bash
sudo apt update
sudo apt install -y curl jq rsync util-linux python3
```

Node.js、pnpm 和 uv 请按其官方方式安装，并确保使用 `sudo` 时仍能通过 `PATH` 找到它们。

## 首次准备

在本地仓库根目录创建不会被 Git 跟踪的服务器配置：

```bash
cp deploy/server/app.env.example .env.server
chmod 600 .env.server
```

至少填写：

- `DATABASE_URL`
- `BETTER_AUTH_SECRET`
- `BETTER_AUTH_URL`
- `JOB_MARKET_SYNC_SECRET`
- 邮件投递配置（开放注册和密码恢复时）

随机密钥可以使用 `openssl rand -base64 48` 生成。`BETTER_AUTH_URL` 必须是最终的 HTTPS 访问地址。

## 一键部署

```bash
./deploy/server/push.sh deploy@your-server
```

脚本会：

1. 将源码同步到远程用户的 `~/jobtrace-deploy-source`；
2. 安全上传 `.env.server`，安装后删除远程暂存副本；
3. 创建专用的 `jobtrace` 系统用户；
4. 安装依赖、执行数据库迁移并构建 standalone 产物；
5. 将新版本原子切换到 `/opt/jobtrace/current`；
6. 安装并启动 `jobtrace.service`；
7. 安装并启用每六小时运行的 `jobtrace-sync.timer`；
8. 执行就绪检查，失败时回滚到上一版本。

自定义本地环境文件或远程暂存目录：

```bash
JOBTRACE_ENV_FILE=/secure/path/jobtrace.env \
JOBTRACE_REMOTE_SOURCE_DIR=jobtrace-release \
./deploy/server/push.sh deploy@your-server
```

也可以把仓库直接放在服务器上，然后执行：

```bash
sudo JOBTRACE_ENV_SOURCE=/secure/path/jobtrace.env \
  bash deploy/server/install.sh
```

## HTTPS 反向代理

应用默认只监听 `127.0.0.1:3000`，不会直接暴露到公网。`nginx.conf.example` 提供了 Nginx 模板；替换域名和证书路径后放入 Nginx 配置目录。

反向代理必须覆盖客户端传入的 `X-Forwarded-For` 和 `X-Real-IP`，并允许至少 6 MB 请求体。不要把 3000 端口直接开放到公网。

## 首次招聘目录初始化

首次部署并创建管理员后，访问 `/admin/job-market`，点击“一键初始化并首次同步”。初始化会创建默认公司和活动来源；之后服务器定时器会持续认领到期来源。

检查定时器和手动触发：

```bash
sudo systemctl list-timers jobtrace-sync.timer
sudo systemctl start jobtrace-sync.service
sudo journalctl -u jobtrace-sync.service -n 100 --no-pager
```

同步服务每批处理最多 10 个来源，最多循环 30 批。数据库租约会阻止多个任务重复处理同一来源。

## 日常运维

```bash
sudo systemctl status jobtrace
sudo journalctl -u jobtrace -f
curl --fail http://127.0.0.1:3000/api/health/live
curl --fail http://127.0.0.1:3000/api/health/ready
```

每次更新仍执行同一个本地命令：

```bash
./deploy/server/push.sh deploy@your-server
```

旧版本保存在 `/opt/jobtrace/releases`，安装失败或新版本未通过就绪检查时会自动切回部署前的版本。
