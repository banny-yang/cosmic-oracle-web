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
CORS_ALLOWED_ORIGIN_PATTERNS=https://www.oracle.duimai.net,http://localhost:*
```

## nginx 反代建议

- `www.oracle.duimai.net` → `127.0.0.1:3001`（本应用）
- `oracle.duimai.net` 维持指向 Java 后端（8080）
- SSE（起名/报告流式）经本应用域名直连后端，无需代理 websocket 配置

## 功能边界

- 登录：手机验证码 / 微信扫码（复用后端票务）
- 起名、解析记录、姓名/契合/婚姻报告（点数直扣）、亲友投票：全功能
- 充值与微信支付：引导去「对脉名鉴」小程序完成（同账号互通）
