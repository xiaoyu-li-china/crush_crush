# 《粉碎消消乐》微信小游戏技术架构设计

> 版本：v1.0  
> 定位：消消乐闯关 + 通关后「粉碎奖励」环节 · 纯 IAA（广告变现）  
> 运行环境：微信小游戏（基础库 ≥ 2.19.0，目标覆盖主流机型）

---

## 1. 技术选型

### 1.1 核心语言：TypeScript（强烈推荐）

| 维度 | JavaScript | TypeScript |
|------|------------|------------|
| 棋盘坐标 / 方块类型 | 易出现 `undefined`、越界静默错误 | 枚举 + 泛型约束，编译期拦截 |
| 状态机迁移 | `string` 随意赋值 | 联合类型 + 穷尽检查 |
| 微信 API 适配层 | 回调类型模糊 | 可对 `wx.*` 做薄封装类型声明 |
| 团队协作 / 重构 | 成本高 | 目录分层后改动面可控 |
| 包体影响 | 无编译产物额外体积 | 编译后仍是 JS，**不增加运行时包体** |

**结论：采用 TypeScript。** 微信小游戏构建链路（原生工具 / webpack / vite-plugin-minigame）均支持 TS → ES5/ES6 输出；类型在编译期擦除，不影响 4MB 主包限制。

### 1.2 引擎 / 框架对比（微信环境）

| 方案 | 包体占用（空工程约） | 微信适配成熟度 | 消消乐适配度 | 特效能力 | 推荐度 |
|------|---------------------|----------------|--------------|----------|--------|
| **Cocos Creator 3.x** | 中（引擎可裁剪） | 官方微信导出完善 | 高（2D UI + 粒子） | 粒子 / Spine / 动画曲线完备 | ★★★★★ |
| **LayaAir 3.x** | 相对可控 | 微信适配成熟 | 高 | 粒子与滤镜够用 | ★★★★ |
| **Egret** | 较小 | 老项目多，新文档少 | 中 | 一般 | ★★ |
| **原生 Canvas + 自研** | 最小 | 需自封装全部 API | 需自写渲染管线 | 爆炸需自研粒子 | ★★★（极致控包时） |
| **Phaser / Pixi** | 需二次适配 | 非官方，适配成本高 | 高 | 强 | ★★（不推荐首发） |

#### 优劣要点（微信特殊约束）

1. **Cocos Creator**
   - 优势：编辑器可视化关卡与特效；微信小游戏构建一键导出；资源分包、远程包有官方方案；粒子系统适合「粉碎爆炸」。
   - 劣势：默认引擎体积偏大，**必须开启模块裁剪**（关闭 3D、物理、部分 UI）；热更新需遵守微信审核与域名白名单。
2. **LayaAir**
   - 优势：偏代码驱动，包体相对好控；微信适配稳定。
   - 劣势：编辑器与生态略弱于 Cocos；特效迭代效率依赖程序。
3. **原生 Canvas**
   - 优势：主包最易压进 4MB；零引擎税。
   - 劣势：棋盘动画、连锁反馈、爆炸粒子、适配刘海屏全部自研；广告 SDK 与音频生命周期也要手写，**工期风险高**。

### 1.3 推荐栈（本项目默认）

```
语言：TypeScript
引擎：Cocos Creator 3.x（2D 模式 + 严格模块裁剪）
构建：Cocos 微信小游戏构建面板 + 自定义资源分包配置
广告：wx.createRewardedVideoAd / wx.createInterstitialAd / wx.createBannerAd
存储：wx.setStorage / wx.getStorage（进度与设置）；云开发可选（非必须）
音频：引擎 AudioSource 或 wx.createInnerAudioContext（经 Core 层适配）
```

> 若团队极度重视包体且美术特效简单，可降级为「TypeScript + 轻量自研 Canvas 渲染」，但架构分层保持不变，仅替换表现层实现。

---

## 2. 项目分层与模块划分

### 2.1 分层原则

采用严格三层 + 薄业务组装，**依赖方向单向向下**：

```
┌─────────────────────────────────────────────┐
│  Presentation（表现层）                      │
│  UI / 棋盘视图 / 粒子特效 / 音频反馈          │
└──────────────────▲──────────────────────────┘
                   │ 订阅状态 / 调用 Command
┌──────────────────┴──────────────────────────┐
│  Domain / Logic（逻辑层）                    │
│  三消规则 / 关卡目标 / 粉碎奖励 / 状态机       │
│  ★ 禁止直接调用 wx.*                         │
└──────────────────▲──────────────────────────┘
                   │ 通过接口注入
┌──────────────────┴──────────────────────────┐
│  Core（核心适配层）                           │
│  微信 API 适配 / 广告 / 存储 / 网络 / 设备    │
│  ★ 零业务依赖、零引擎依赖（或仅类型依赖）     │
└─────────────────────────────────────────────┘
```

**降低微信 API 变更影响的方式：**

| 变更场景 | 无分层时 | 有分层时 |
|----------|----------|----------|
| `wx.createRewardedVideoAd` 参数调整 | 关卡结算、复活、商店多处改 | 只改 `core/ad/RewardedAdAdapter` |
| Storage 限流 / 同步改异步 | 进度读写散落各处 | 只改 `core/storage/StoragePort` 实现 |
| 基础库音频行为变化 | 表现层到处 `wx.createInnerAudioContext` | 逻辑层只依赖 `AudioPort.play(id)` |
| 新广告位类型 | 业务 if-else 膨胀 | Core 新增适配器，Logic 通过 `IAdService.show(placement)` |

逻辑层只依赖 **Port（接口）**，Core 提供 **Adapter（实现）**，在启动时注入（Composition Root）。微信 API 变更被隔离在 Adapter 内。

### 2.2 推荐目录结构

```
crush-crush/
├── game.json                 # 微信小游戏配置（分包、插件等）
├── project.config.json
├── package.json
├── tsconfig.json
├── docs/
│   └── ARCHITECTURE.md
├── assets/                   # Cocos 资源（图集、音效、预制体）— 构建时按分包切
│   ├── main/                 # 主包必要资源（启动、大厅壳）
│   ├── bundle-game/          # 玩法资源包
│   ├── bundle-fx/            # 粉碎特效 / 粒子
│   └── remote/               # 标记为远程的大图、过场（CDN）
├── src/
│   ├── main.ts               # 入口：注入依赖、启动状态机
│   ├── core/                 # ★ 核心层：微信适配，零业务依赖
│   │   ├── index.ts
│   │   ├── ports/            # 接口定义（供逻辑层依赖）
│   │   │   ├── IStorage.ts
│   │   │   ├── IAdService.ts
│   │   │   ├── IAudio.ts
│   │   │   ├── INetwork.ts
│   │   │   ├── IAnalytics.ts
│   │   │   └── IPlatform.ts
│   │   ├── adapters/         # 微信实现
│   │   │   ├── WxStorageAdapter.ts
│   │   │   ├── WxAdAdapter.ts
│   │   │   ├── WxAudioAdapter.ts
│   │   │   ├── WxNetworkAdapter.ts
│   │   │   ├── WxAnalyticsAdapter.ts
│   │   │   └── WxPlatformAdapter.ts
│   │   ├── pool/             # 通用对象池（与引擎无关的纯池）
│   │   └── utils/            # 纯函数工具（clamp、seededRandom 等）
│   ├── logic/                # ★ 逻辑层：游戏规则，禁止 wx.*
│   │   ├── board/
│   │   │   ├── BoardModel.ts
│   │   │   ├── TileType.ts
│   │   │   ├── MatchFinder.ts      # 三消检测
│   │   │   ├── MatchResolver.ts    # 消除、下落、填充
│   │   │   └── MoveValidator.ts    # 交换合法性
│   │   ├── crush/
│   │   │   ├── CrushRewardModel.ts # 粉碎奖励关数据
│   │   │   └── CrushResolver.ts    # 爆炸连锁结算
│   │   ├── level/
│   │   │   ├── LevelConfig.ts
│   │   │   ├── LevelGoals.ts
│   │   │   └── LevelProgress.ts
│   │   ├── fsm/
│   │   │   ├── GameState.ts
│   │   │   └── GameStateMachine.ts
│   │   ├── economy/                # IAA 触发策略（非广告 SDK）
│   │   │   ├── AdPlacementPolicy.ts
│   │   │   └── RevivePolicy.ts
│   │   └── events/
│   │       └── GameEvents.ts       # 领域事件（MatchCleared、LevelWon…）
│   ├── presentation/         # ★ 表现层：UI / 渲染 / 特效
│   │   ├── views/
│   │   │   ├── BoardView.ts
│   │   │   ├── TileView.ts
│   │   │   ├── HudView.ts
│   │   │   └── ResultView.ts
│   │   ├── fx/
│   │   │   ├── MatchClearFx.ts
│   │   │   ├── CrushExplosionFx.ts
│   │   │   └── FxPool.ts
│   │   ├── ui/
│   │   │   ├── LobbyScene.ts
│   │   │   ├── LevelScene.ts
│   │   │   └── CrushScene.ts
│   │   └── binders/
│   │       └── BoardPresenter.ts   # 订阅逻辑事件 → 驱动视图
│   ├── services/             # 组装层（Composition）
│   │   ├── GameSession.ts
│   │   ├── Bootstrap.ts
│   │   └── ResourceLoader.ts
│   └── config/
│       ├── levels.json             # 关卡表（可远程）
│       ├── ad-placements.json
│       └── balance.json
└── tests/
    ├── logic/                      # 纯逻辑单测（Node 可跑，不依赖微信）
    └── fixtures/
```

### 2.3 层间交互方式

```
用户点击方块
    → Presentation(BoardView) 捕获输入
    → 调用 Logic(MoveValidator + MatchResolver) 的纯函数/命令
    → Logic 产出领域事件：BoardChanged / MatchesFound / CascadeDone / LevelWon
    → Presentation(BoardPresenter) 订阅事件，播放动画与粒子
    → 若 LevelWon：FSM 切入 CrushReward
    → Crush 结束后 FSM → Settle；Settle 经 IAdService 请求插屏/激励（Core）
    → Core 回调结果；Logic 的 RevivePolicy / 进度写入只认 Port 返回值
```

**交互约束：**

1. Presentation **不得**直接改 `BoardModel` 内部数组；只能发「意图」（SwapIntent）。
2. Logic **不得**引用 Cocos 节点、`cc.*`、`wx.*`。
3. Core **不得** import `logic/` 或 `presentation/`。
4. 所有跨层通信优先用：**命令入、事件出**（Command + Domain Event）。

### 2.4 IAA 与分层的关系

广告 SDK 属于 Core；「第几关弹插屏、失败是否给激励复活」属于 Logic 的 `AdPlacementPolicy`。这样审核素材与频控策略可改配置，而不碰微信 API。

---

## 3. 核心数据结构

### 3.1 棋盘数据模型

```ts
/** 方块种类：普通色块 + 特殊块（可由连锁生成） */
enum TileKind {
  Empty = 0,
  Red, Blue, Green, Yellow, Purple,
  Bomb,        // 粉碎相关：范围爆炸
  ColorBomb,   // 同色全消
}

interface Tile {
  id: number;          // 对象池复用时保持稳定 id，便于视图映射
  kind: TileKind;
  // 可选：特殊标记（待消除、下落中）由运行时 bitset 表达，避免污染持久模型
}

interface BoardSize {
  rows: number;        // 建议 8
  cols: number;        // 建议 8
}

/** 棋盘：行优先一维数组，降低二维对象开销 */
interface BoardModel {
  size: BoardSize;
  cells: Int8Array;    // 存 TileKind；Empty=0。比 Tile[][] 更省内存
  // id 映射可用平行数组：tileIds: Int32Array
  tileIds: Int32Array;
  version: number;     // 每次变更 +1，供视图脏检查
}
```

**设计要点：**

- 用 `Int8Array` / `Int32Array` 存盘面，避免每格一个 JS 对象造成 GC 压力（微信 iOS 低端机尤其敏感）。
- 视图层维护 `Map<tileId, Node>`，逻辑层只发「id + 新行列」的位移指令。
- 关卡配置与运行时盘面分离：`LevelConfig` 只描述种子、目标、可用步数。

### 3.2 关卡与目标

```ts
interface LevelConfig {
  id: number;
  seed: number;
  moves: number;
  board: BoardSize;
  goals: LevelGoal[];
  crushEnabled: boolean;     // 通关后是否进入粉碎奖励
  crushDurationMs: number;   // 奖励时长
}

type LevelGoal =
  | { type: 'collect'; kind: TileKind; count: number }
  | { type: 'score'; score: number }
  | { type: 'clear_blocks'; count: number };
```

### 3.3 游戏状态机

```ts
type GameState =
  | 'Boot'
  | 'Lobby'
  | 'LoadingLevel'
  | 'PlayerInput'      // 等待交换
  | 'Resolving'        // 消除 / 下落 / 填充连锁中
  | 'LevelWon'
  | 'CrushReward'      // 粉碎奖励环节
  | 'LevelFailed'
  | 'Settle'           // 结算 UI + 可能弹广告
  | 'Paused';

/** 合法迁移（示意） */
const TRANSITIONS: Record<GameState, GameState[]> = {
  Boot: ['Lobby'],
  Lobby: ['LoadingLevel'],
  LoadingLevel: ['PlayerInput'],
  PlayerInput: ['Resolving', 'Paused', 'LevelFailed'],
  Resolving: ['PlayerInput', 'LevelWon', 'LevelFailed'],
  LevelWon: ['CrushReward', 'Settle'],
  CrushReward: ['Settle'],
  LevelFailed: ['Settle', 'PlayerInput'], // 激励复活可回到 PlayerInput
  Settle: ['Lobby', 'LoadingLevel'],
  Paused: ['PlayerInput'],
};
```

状态机只存「当前态 + 关卡运行时上下文」，不存视图引用。

```ts
interface LevelRuntime {
  levelId: number;
  movesLeft: number;
  score: number;
  goalProgress: number[];
  board: BoardModel;
  cascadeDepth: number;
}
```

### 3.4 粉碎奖励数据

```ts
interface CrushRewardSession {
  remainingMs: number;
  tapPower: number;          // 每次点击爆炸半径/伤害
  charge: number;            // 可被广告加成的充能（策略在 Logic，展示在 Presentation）
  explosionsQueued: CrushBurst[];
}

interface CrushBurst {
  epicenter: { r: number; c: number };
  radius: number;
  kind: 'tap' | 'chain' | 'finale';
}
```

### 3.5 微信环境下的对象管理与防泄漏

| 风险 | 表现 | 架构对策 |
|------|------|----------|
| 频繁 `new Tile()` | GC 卡顿、掉帧 | 逻辑层用 TypedArray；视图层 **对象池** `FxPool` / `TileViewPool` |
| 粒子节点未回收 | 内存持续涨 | 特效播放完毕强制 `pool.put`；切场景前 `pool.clear` |
| 广告实例重复创建 | 监听器叠加、异常回调 | Core 内 **单例 Ad 实例** + 统一 `off`；页面隐藏时暂停加载 |
| 事件监听未卸载 | 幽灵回调改盘面 | Presenter `onDisable`/`dispose` 成对 `off`；FSM 切态时清队列 |
| 闭包引用大图 Atlas | 纹理无法释放 | 分包 `bundle.release()`；远程资源用完 `decRef` |
| 全局缓存无限增长 | Storage / 音频 map 膨胀 | Core 缓存设上限；LRU；关卡卸载时释放非主包 bundle |

**对象池约定：**

```ts
interface Pool<T> {
  acquire(): T;
  release(item: T): void;
  drain(): void;   // 切场景 / 回大厅必调
}
```

- 逻辑帧内禁止在热点路径 `new` 临时数组：MatchFinder 使用预分配 `scratch: number[]`。
- 微信：监听 `wx.onHide` / `wx.onShow`，Hide 时暂停音频与广告预加载，Show 时恢复；避免后台仍创建对象。

---

## 4. 关键算法描述

### 4.1 三消检测与处理（自然语言流程）

**输入：** 玩家选定相邻两格 `(A, B)`，当前 `BoardModel`，剩余步数。

**步骤：**

1. **合法性预检**  
   若当前状态不是 `PlayerInput`，忽略输入。若 `A`、`B` 不相邻（四向），拒绝。若步数为 0，进入失败判定分支。

2. **试交换**  
   在盘面副本或原地交换 `A`、`B` 的 kind（保留 id 映射规则按实现二选一：交换 kind 或交换 id）。  
   调用「全盘匹配扫描」：  
   - 横向：每一行连续相同 `kind`（非 Empty、非障碍）长度 ≥ 3 记入匹配集合。  
   - 纵向：同理。  
   - 合并重叠匹配，得到本次消除格子集合 `MatchSet`。  
   若 `MatchSet` 为空：**换回**，播放非法交换回弹动画（表现层），不扣步数（或按策划扣步，配置化）。

3. **确认交换并扣步**  
   `MatchSet` 非空：扣 1 步，FSM → `Resolving`，广播 `SwapAccepted`。

4. **消除结算**  
   - 将 `MatchSet` 中格子记分、更新关卡目标进度。  
   - 若匹配形状满足「四连 / L-T 型 / 五连」规则，在中心位生成特殊块（Bomb / ColorBomb）。  
   - 格子置 `Empty`，广播 `TilesCleared`（带 id 列表供特效）。

5. **下落（Gravity）**  
   每列自底向上压实非空块，记录每块的 `fromRow → toRow`。广播 `TilesFell`。

6. **填充（Fill）**  
   顶部空位生成新 `kind`（由 `seededRandom(level.seed, dropIndex)`，保证可复现与可测）。分配池化 `tileId`。广播 `TilesSpawned`。

7. **连锁检测**  
   再次全盘扫描；若仍有匹配，`cascadeDepth++`，回到步骤 4（可加分倍率）。  
   直到无匹配。

8. **死局检测（可选）**  
   若无任何合法交换能产生匹配，触发洗牌或提示；洗牌仍失败则特殊处理。

9. **胜负判定**  
   - 目标全部完成 → `LevelWon`。  
   - 步数耗尽且目标未完成 → `LevelFailed`（可走激励复活策略）。  
   - 否则 → `PlayerInput`。

**性能注意：** 扫描为 O(rows × cols)；8×8 可每帧多次。禁止在扫描中分配大量短命对象；结果写入预分配 buffer。

### 4.2 粉碎特效触发流程

**触发条件：** FSM 进入 `LevelWon` 且本关 `crushEnabled === true`。

**流程：**

1. **过场**  
   表现层切换至 `CrushScene`（可复用同一棋盘视图，换皮肤/滤镜）。逻辑层创建 `CrushRewardSession`，倒计时启动。

2. **输入模式切换**  
   不再做相邻交换；玩家点击任意格子（或屏幕任意点映射到最近格）产生一次 `CrushBurst`。

3. **单次爆炸结算（CrushResolver）**  
   - 以点击格为圆心，按 `tapPower` 半径收集格子。  
   - 清除这些格子，累加奖励分 / 虚拟货币（若有）/ 结算展示用分数。  
   - 若清到 Bomb，则入队额外 `chain` 爆发（广度限制，防止单帧清全屏卡死）。  
   - 广播 `CrushBurstFired`，表现层播放爆炸粒子、屏幕轻震、音效（资源来自 `bundle-fx`）。

4. **时间与充能**  
   - 每帧或每 tick 减少 `remainingMs`。  
   - 可选：观看激励视频（经 `IAdService`）增加 `remainingMs` 或 `tapPower`——策略在 `AdPlacementPolicy`，SDK 在 Core。

5. **结束**  
   - 时间到，或玩家主动跳过：播放 `finale` 大爆炸（队列一次性结算剩余可炸点，有上限）。  
   - 回收全部 Fx 节点到池，释放 `bundle-fx` 中非常驻资源。  
   - FSM → `Settle`。

6. **结算与 IAA**  
   - 展示本关得分、粉碎加成。  
   - 按 `AdPlacementPolicy` 决定插屏；失败重试入口决定是否展示激励视频。  
   - 进度经 `IStorage` 写入（ thrash 防护：合并写、防抖）。

---

## 5. 性能与包体约束

### 5.1 硬约束

| 项目 | 限制 | 架构应对 |
|------|------|----------|
| 微信小游戏主包 | **≤ 4MB** | 主包只留启动壳 + 大厅 + 核心代码 |
| 整包 / 分包总和 | 遵守微信当时文档上限 | 玩法、特效、关卡资源分包 |
| 首包下载体验 | 越小越好 | 远程加载非首关资源 |
| 运行时内存 | 低端 Android / iOS 紧张 | TypedArray 盘面 + 对象池 + 及时 release bundle |

### 5.2 分包策略

**`game.json` 示意：**

```json
{
  "deviceOrientation": "portrait",
  "subpackages": [
    { "name": "game", "root": "subpackages/game/" },
    { "name": "fx", "root": "subpackages/fx/" },
    { "name": "levels-extra", "root": "subpackages/levels-extra/" }
  ]
}
```

| 包 | 内容 | 加载时机 |
|----|------|----------|
| **主包** | 引擎裁剪后运行时、Core、Bootstrap、大厅 UI、首关最小图集、广告适配 | 冷启动 |
| **game 分包** | 棋盘皮肤、普通消除特效、关卡 1–N 本地配置 | 点击「开始」时 `loadSubpackage('game')` |
| **fx 分包** | 粉碎爆炸粒子、Spine/帧动画、重音效 | 进入 `CrushReward` 前加载；大厅可预下载 |
| **levels-extra** | 高关卡配置、活动皮肤 | 空闲 / Wi-Fi / 推进到阈值关前 |

Cocos 侧对应 Asset Bundle：`main` / `bundle-game` / `bundle-fx`，与微信 subpackages 对齐，避免重复打包。

### 5.3 远程资源加载

```
CDN（HTTPS，加入微信 downloadFile 合法域名）
  ├── remote/levels/level_xxx.json
  ├── remote/textures/season_skin/
  └── remote/audio/bgm_*.mp3
```

**策略：**

1. **主包零 BGM 大文件**：BGM 走远程或分包。  
2. **关卡表**：前 30 关打进 `game` 分包；之后 CDN 拉取并本地缓存（`IStorage` 或文件系统）。  
3. **粉碎特效高清图**：仅放 `fx` 分包或远程；失败时降级为简单缩放圆+闪白，保证可玩。  
4. **ResourceLoader** 统一封装：进度条、失败重试、超时降级；Logic 不关心资源来源。  
5. **版本号**：远程 manifest（`config_version`）控制强更配置，避免改主包。

### 5.4 引擎裁剪与代码体积

- Cocos：关闭 3D、物理、地形、部分 UI 模块；纹理压缩使用 ASTC/ETC（按微信平台双端配置）。  
- 图集化：消除零散小图；严格控制 Smooth 大图。  
- TS 编译 `target` 与 tree-shaking：业务代码按目录懒加载（与分包一致）。  
- 禁止在主包引入测试代码、关卡编辑器、未用 SDK。

### 5.5 运行时性能预算（建议）

| 指标 | 目标 |
|------|------|
| 棋盘交互帧率 | ≥ 55 FPS（中端机） |
| 单次三消结算（逻辑） | < 2ms（8×8） |
| 粉碎单次爆炸粒子 | 同屏粒子峰值可控，池化，超限截断 |
| 进关加载 | 分包已缓存时 < 1s 可交互 |

---

## 6. IAA 架构要点（与玩法耦合处）

```
AdPlacementPolicy（Logic）
  - onLevelStart → 是否预加载激励
  - onLevelFail → 复活入口（看视频 +N 步）
  - onSettle → 插屏频控（每 N 关、冷却秒数）
  - onCrushExtend → 加时激励

IAdService（Core Port）
  - load(placement)
  - show(placement) → Promise<'completed'|'skipped'|'error'>
  - isReady(placement)
```

展示层只负责按钮显隐；**不得**在按钮回调里直接 `wx.createRewardedVideoAd`。

---

## 7. 测试与可维护性

- **逻辑层单测**：MatchFinder / MatchResolver / CrushResolver / FSM 在 Node 环境跑，不依赖微信与引擎。  
- **Core 用 Fake Adapter**：`MemoryStorage`、`FakeAdService` 供集成测试。  
- **金样例盘面**：固定 seed 的「交换后三消 / 连锁 / 死局」fixtures。  
- **微信真机**：低端机内存、弱网分包、广告回调异常路径必测。

---

## 8. 落地实施顺序（建议）

1. 搭建 Cocos 微信工程 + TS + 目录骨架（core/logic/presentation）。  
2. 实现 BoardModel + MatchFinder/Resolver + 单测。  
3. 接 BoardView 与基础交换动画。  
4. 接入 FSM、关卡目标、结算。  
5. 实现 CrushReward + fx 分包。  
6. 接入 IAdService 与频控策略。  
7. 主包瘦身、分包与远程、真机性能与包体验收（主包 < 4MB）。

---

## 附录 A：依赖方向一览

```
presentation → logic → core/ports
services →（组装）presentation + logic + core/adapters
tests/logic → logic only
```

任何 `logic → presentation` 或 `logic → wx` 的 import 视为架构违规，可在 CI 用依赖图规则扫描。

## 附录 B：术语

| 术语 | 含义 |
|------|------|
| IAA | In-App Advertising，纯广告变现 |
| Port / Adapter | 六边形架构中的接口与微信实现 |
| Cascade | 下落填充后触发的连续消除 |
| CrushReward | 通关后的粉碎爆炸奖励环节 |
