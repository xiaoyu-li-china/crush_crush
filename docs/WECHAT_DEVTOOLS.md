# 微信开发者工具调试指南

本仓库现已支持用 **微信开发者工具** 直接预览（Canvas 壳 + 现有逻辑层）。  
后续接入 Cocos Creator 后，可改为「Creator 构建产物」目录，调试方式相同。

## 1. 本机构建入口

在项目根目录执行：

```bash
npm install
npm run build:wechat
```

成功后根目录生成 `game.js`（及 `game.js.map`）。

开发时可监听重建：

```bash
npm run dev:wechat
```

## 2. 用微信开发者工具打开

1. 打开 **微信开发者工具**
2. 选择 **小游戏** → **导入项目**
3. 目录选：`/Users/mac/Documents/workspaces/crush_crush`（本仓库根目录）
4. AppID 可选 **测试号 / 游客**（`project.config.json` 已写 `touristappid`）
5. 点击编译 / 预览

应能看到大厅文案「粉碎消消乐」和「开始第 1 关」。

## 3. 操作说明（调试版）

- **开始第 1 关**：进入 8×8 棋盘
- **点选两格** 或 **滑动相邻格**：尝试交换消除
- **失败**：可点「看广告复活」（广告位未配置时会提示不可用，属正常）
- **胜利**：可进下一关 / 回大厅

控制台可过滤日志前缀：`[crush-crush]`

## 4. 常见问题

| 现象 | 处理 |
|------|------|
| 白屏 / 无入口 | 先执行 `npm run build:wechat`，确认根目录有 `game.js` |
| 改了 TS 没变化 | 重新 build，或开着 `npm run dev:wechat` 再点编译 |
| 广告失败 | `src/config/ad-placements.json` 换成真实 adUnitId；游客号能力有限 |
| `updateTextView:fail xxx not found` | **微信基础库已知问题**（常见于激励/插屏广告创建），与业务逻辑无关。本地占位 `TODO_*` 广告位已跳过创建，一般不再刷屏；若已配置真实广告位，该日志可忽略，通常不影响玩法。也可在开发者工具把基础库切到 2.19.0 / 3.9.1 对比 |
| 想接 Cocos | 用 Creator 3.x 建工程，构建「微信小游戏」后，用开发者工具打开 **构建输出目录** |

## 5. 当前可调试范围

已可调：三消逻辑、关卡 FSM、目标、复活流程、Canvas 触摸。  
尚未接入：Cocos 场景/粒子、真实粉碎特效分包（第五阶段）。
