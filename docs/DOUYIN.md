# 抖音小游戏适配与上传

本项目为 **TypeScript + Canvas 自研渲染**（非 Cocos/Laya）。在抖音开放平台创建小游戏时，「预计使用开发引擎」请选择 **普通小游戏引擎 → 其他**。

## 1. 开放平台创建小游戏

1. 登录 [抖音开放平台](https://developer.open-douyin.com/) → **创建小游戏**。
2. 填写名称、联系人；引擎选 **其他**。
3. 创建后记下 **AppID**，用于本地工程配置。

## 2. 本地构建抖音包

```bash
npm run build:douyin
```

产物目录：`dist/douyin/`，包含：

- `game.js`（轻量 shell，立即打日志）+ `crush-bundle.js`（主逻辑）
- `game.json`、`project.config.json`
- `assets/`（与微信主包一致，已跳过 brand / remote 等大目录）

可选：构建时注入 AppID：

```bash
DOUYIN_APPID=你的AppID npm run build:douyin
```

## 3. 开发者工具预览

1. 安装 [字节跳动开发者工具](https://developer.open-douyin.com/docs/resource/zh-CN/mini-game/develop/developer-tool/download)（名称以官网为准）。
2. **导入项目** → 选择仓库内 `dist/douyin` 目录。
3. 将 `project.config.json` 里的 `appid` 改为开放平台 AppID（若构建时未注入）。
4. 编译预览 → 真机调试。

## 4. 广告位（IAA）

编辑 `src/config/ad-placements.douyin.json`，把 `TODO_DOUYIN_*` 换成抖音流量主后台创建的 **广告位 ID**，然后重新 `npm run build:douyin`。

| 配置键 | 用途 |
|--------|------|
| `rewarded_revive` | 激励 · 复活 |
| `rewarded_crush_extend` | 激励 · 粉碎加时 |
| `interstitial_settle` | 插屏 · 结算 |
| `banner_lobby` | 大厅横幅（抖音走 `createBannerAd`，由 shim 映射） |

占位 ID 期间广告不会创建，**不影响单机闯关**。

## 5. 与微信版的差异

| 能力 | 微信 | 抖音包 |
|------|------|--------|
| 云开发存档 | `cloud.json` | 默认关闭 `cloud.douyin.json` |
| 排行榜云函数 | `challenge.json` provider=cloud | `challenge.douyin.json` provider=http（未接 API 时排行榜不可用） |
| 游戏圈按钮 | `createGameClubButton` | 无 API 时自动跳过 |
| 分享朋友圈 | `shareTimeline` | 无则仅保留好友分享能力 |

核心玩法、本地进度、Canvas UI 与微信共用同一套代码；运行时通过 `src/minigame/ttWxShim.ts` 将 `tt` 映射为 `wx`。

## 6. 提审上传

在开发者工具中 **上传** → 开放平台 **版本管理** 提交审核。名称需与玩法一致，遵守平台命名规范（见创建页右侧说明）。

**软著（计算机软件著作权登记）**：软件名称统一为「萌宠粉碎消游戏软件 V1.0」，材料与抖音资质上传说明见 [`docs/douyin-softcopyright/README.md`](./douyin-softcopyright/README.md)。生成源程序 PDF：`node scripts/generate-softcopyright-source.mjs`。

## 7. 表现与宿主优化（已接入）

- **结算背景**：主线 / 麻将胜利弹窗使用径向粉/青暖色衬底，压暗后方棋盘格，突出居中卡片（`ResultSceneBackdrop.ts`）。
- **版本环境**：抖音 `getEnvInfoSync` 已映射为与微信一致的 develop / trial / release，体验版可预览全部关卡。
- **图片加载**：无 `createImage` 时 shim 回退；`getAccountInfoSync` 便于读取当前版本类型。

## 8. 常见问题

- **白屏 / 只有 `[TMG] use engine: helium`**：先看 Console 是否出现 `[crush-crush] douyin game.js shell` → `douyin entry loaded`。若只有 helium、没有 shell，说明 **未重新编译** 或打开的不是 `dist/douyin`。Helium 占用 WebGL 时用离屏 2D + WebGL 上屏；存储走 sync。请 **清缓存 → 编译**。
- **黑屏**：确认打开的是 `dist/douyin` 而非仓库根目录（根目录的 `game.js` 是微信入口）。
- **广告不展示**：检查 adUnitId、真机环境、流量主是否开通。
- **包体过大**：与微信相同，可在 `scripts/build-douyin.mjs` 的 `skipAssets` 中增加需排除的资源目录。
