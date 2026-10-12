# 云函数（微信云开发）

环境 ID 见 `src/config/cloud.json` → `envId`。

## 萌宠麻将馆运营配置

| 云函数 | 用途 |
|--------|------|
| `initMahjongOps` | 首次创建 `mahjong_ops/config` 文档 |
| `getMahjongOps` | 客户端拉运营配置（CDN 未命中时） |
| `setMahjongOps` | 写入运营配置（需 `MAHJONG_OPS_ADMIN_TOKEN`） |

### 一键本地准备

```bash
npm run mahjong:ops-setup
```

会生成 Token、`tools/mahjong-ops-admin/.env.local` 与 `generated/DEPLOY-CHECKLIST.txt`。

### 部署（开发者工具）

1. 云开发 → 云函数 → 对以上三个函数 **上传并部署：云端安装依赖**
2. `setMahjongOps` → 配置 → 环境变量：`MAHJONG_OPS_ADMIN_TOKEN`（与 `.env.local` 一致）
3. `setMahjongOps` → **HTTP 访问 / 云接入** → 开启，复制 URL 到 `.env.local` 的 `MAHJONG_OPS_HTTP_URL`
4. 测试 `initMahjongOps`（参数见 `generated/initMahjongOps-callFunction.json`）

可视化发布：`npm run mahjong:ops-admin` → 发布 → **一键发布到云（HTTP）**。
