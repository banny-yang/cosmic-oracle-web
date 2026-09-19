# 对脉名鉴 Web · 部署说明

与小程序同一套后端（Cosmic-Oracle-Java），前端为 TanStack Start（React 19）SSR 应用。

## 本地开发

```bash
npm install
npm run dev        # http://localhost:8082，默认 API 指向 http://127.0.0.1:8080
```

后端 CORS 默认放行 `http://localhost:*`，本地无需额外配置。

## 生产构建与运行

```bash
# 构建时写入后端地址（也可不改代码，见运行时注入）
VITE_API_BASE_URL=https://oracle.duimai.net npm run build

PORT=3001 npm run start   # node .output/server/index.mjs（nitro node-server）
```

API 地址解析优先级：`window.__RUNTIME_CONFIG__.API_BASE_URL`（运行时注入，可在 nginx 反代时替换 HTML 占位）→ 构建期 `VITE_API_BASE_URL` → `http://127.0.0.1:8080`。

## 后端配合（唯一部署项）

给 Java 后端的环境变量加上 Web 域名（现有 CorsConfig 已覆盖 `/api/**` 含 SSE）：

```
CORS_ALLOWED_ORIGIN_PATTERNS=http://name.duimai.net,http://localhost:*
```

## nginx 反代建议

- `name.duimai.net` → `127.0.0.1:3001`（本应用）
- `oracle.duimai.net` 维持指向 Java 后端（8080）
- SSE（起名/报告流式）经本应用域名直连后端，无需代理 websocket 配置

## 功能边界

- 登录：手机验证码 / 微信扫码（复用后端票务）
- 起名、解析记录、姓名/契合/婚姻报告（点数直扣）、亲友投票：全功能
- 充值与微信支付：引导去「对脉名鉴」小程序完成（同账号互通）

---

## 实际部署拓扑（2026-09 已上线，与上文规划端口的差异以此为准）

- **应用**：docker 容器 `cosmic-web`（镜像 `cosmic-oracle/web:1.0.0`，由仓库 Dockerfile 构建），
  监听 `127.0.0.1:3003 → 容器 3001`；compose 定义在 Cosmic-Oracle-Java `deploy/docker-compose.server.yml` 的 `web` 服务。
- **统计**：GoatCounter 以 systemd 二进制运行（`/opt/goatcounter`，service `goatcounter`），
  监听 `127.0.0.1:3002`，sqlite 数据在 `/data/goatcounter/`。
- **nginx**：宝塔 vhost `/www/server/panel/vhost/nginx/name.duimai.net.conf`
  —— `/count.js`、`/count` → 3002（同域埋点），其余 → 3003。当前仅 80；
  **DNS 解析生效后在宝塔为该站点申请 SSL 并强制 https**。
- **后端 CORS**：服务器 `.env` 的 `CORS_ALLOWED_ORIGIN_PATTERNS` 已追加 `http(s)://name.duimai.net`。
- **构建命令**：`VITE_API_BASE_URL=https://server.oracle.duimai.net VITE_TRACKING=1 npm run build`
  （漏掉 env 会回落 127.0.0.1；`VITE_TRACKING=1` 启用统计脚本注入）。
- **发布流程**：`docker build -t cosmic-oracle/web:1.0.0 . && docker save | gzip` → scp → 服务器 `docker load`
  → `docker compose up -d web`。
- **待办**：`www` 子域名 A 记录 → 8.140.52.138（域名商）；宝塔签 SSL；
  ~~页脚备案号占位~~（已改为 蜀ICP备16031368号-7 / 成都米哈哈科技·www.mihaha.com）。
