# My-Dashboard

硬核工业风个人起始页仪表盘。由最初的单文件 `sharp_cyberpunk_industrial_startpage.html`
拆分为可扩展的 Vue 工程，并接入了三路真实数据。

- **Codeforces 进度** —— 直连 CF 官方 API，读取真实 rating / 通过题数 / 提交活动
- **Command Code 用量** —— 扫描本机会话文件生成用量快照，按模型与时间聚合
- **BRZ 购车基金** —— 与 BRZ-Fund 同源时直读它的 IndexedDB，实现真正的数据共享

技术栈与工程约定与同目录下的 `BRZ-Fund` 保持一致：
Vue 3 + Vite + TypeScript + Pinia，原生 CSS + CSS Variables，纯静态部署。

## 快速开始

```bash
npm install
npm run sync:usage     # 从本机 Command Code 会话生成用量数据（可选，但用量磁贴需要它）
npm run dev            # http://localhost:5174
```

其它命令：

```bash
npm run type-check     # vue-tsc --build
npm run test           # vitest run
npm run build          # type-check + 构建到 dist/
npm run preview        # 预览构建产物
npm run format         # prettier
```

## 目录结构

```
My-Dashboard/
├── scripts/
│   └── sync-commandcode-usage.mjs   # 用量采集器（独立 Node 脚本，无依赖）
├── public/data/
│   └── command-code-usage.json      # 采集产物，提交进仓库供线上使用
├── legacy/
│   └── sharp_cyberpunk_industrial_startpage.html   # 原始单文件版本（留档）
├── src/
│   ├── config/app.config.ts    # 全部可调参数集中在这里
│   ├── types/                  # 类型定义（含 BRZ-Fund 的只读镜像）
│   ├── utils/                  # 格式化与时间工具
│   ├── domain/                 # 纯函数：余额、CF 指标、用量派生（有单测）
│   ├── services/               # 外部边界：CF API、用量文件、BRZ IndexedDB/备份、localStorage
│   ├── stores/                 # Pinia：运行时状态编排
│   ├── components/             # ui/ 通用组件 + layout/ 外壳
│   ├── tiles/                  # 各磁贴 + registry.ts（扩展点）
│   └── styles/                 # tokens.css + base.css
└── tests/                      # vitest：domain 与 services
```

**分层铁律**：组件只管展示；store 管状态与编排；service 管一切外部边界；
`domain/` 是纯函数、零依赖、必须有单测。磁贴不得直接 `fetch`、不得直接开 IndexedDB。

## 扩展：新增一个磁贴

1. 在 `src/tiles/` 新建组件，用 `TileFrame` 包壳：

   ```vue
   <script setup lang="ts">
   import TileFrame from '@/components/ui/TileFrame.vue';
   </script>

   <template>
     <TileFrame tile-id="mytile" title="MY_NEW_TILE" accent="var(--accent-cyan)">
       内容
       <template #footer>底部状态区</template>
     </TileFrame>
   </template>
   ```

2. 在 `src/tiles/registry.ts` 的 `TILES` 数组里加一条，给它一个**全新的 id**：

   ```ts
   { id: 'mytile', span: 'single', label: '我的磁贴', component: MyTile },
   ```

无需改动其它文件：布局顺序、拖拽、持久化、重置、页脚统计都由注册表驱动。
删除某条后，用户既有的布局会自动跳过它（见 `useLayoutStore` 的 `reconcile`）。

> id 是布局持久化的键，**发布后不要改名**，否则用户的拖拽顺序会重置。

## 三路数据接入的真实机制

### 1. Codeforces —— 直连官方 API

`user.info` + `user.status`，浏览器直接请求（CF 的 `/api/*` 返回
`Access-Control-Allow-Origin: *`，已实测）。

- handle 在磁贴的 `[CONFIG]` 面板里填写，**只存本机 localStorage**，不写进仓库。
- 成功后缓存 10 分钟，失败退避 60 秒；两次请求之间留 400ms 间隔。
- ⚠️ **口径**：Codeforces 官方 API 不提供「全站累计通过题数」，并且
  `user.status` 的实际返回条数有上限（实测请求 `count=10000` 只返回 5499 条）。
  因此磁贴上的 `SOLVED` 是「最近一次抓取窗口内通过的不同题目数」，
  UI 已如实标注窗口大小，**不要当成历史总数**。

### 2. Command Code 用量 —— 本机会话文件采集

```bash
npm run sync:usage
# 等价于 node scripts/sync-commandcode-usage.mjs [--root <dir>] [--out <file>]
```

扫描 `~/.commandcode/projects/<project>/<session>.jsonl`（排除
`<uuid>.checkpoints.jsonl`），取出每行里 `type=message` 且
`message.role=assistant` 的 `usage` 对象，聚合出总量、按模型、按天、按小时（48h）四组数据。

口径与 Command Code 自身一致，**本地不重算价格**：

- `inputTokens` 是**含缓存命中**的总输入，`cacheReadTokens` 是它的子集
- 因此 `totalTokens = inputTokens + outputTokens`，缓存读不再加一次
- `costUsd` 采用会话里记录的权威计价（本地价目表与它不一致，不能用来推算）

> **为什么不用 HTTP API**：Command Code 没有公开的用量接口。官方文档明确说明
> `/usage` 是交互式斜杠命令（headless 模式不支持），用量追踪指向
> commandcode.ai/studio 网页，且「不应通过本地文件、auth token 或 API 探测获取」。
> 采集本机会话文件是当前唯一既真实又可核对的方式。
>
> 采集结果的正确性已用独立实现交叉核对：3765 个 usage 行、`costUsd` 合计
> $21.75658，两条口径完全一致。

线上部署时，GitHub Actions 跑不了这个脚本（CI 上没有本机数据），
所以使用仓库里已提交的 `public/data/command-code-usage.json` 快照。
**想让线上数字更新，就在本机跑一次 `npm run sync:usage` 并提交该文件。**

> ⚠️ **公开仓库的隐私提示**：写进 JSON 的 `source` 已脱敏为 `~/.commandcode`
> （不会带出本机用户名），但快照本身仍包含模型名、调用量、费用与按天/按小时
> 的活动分布。**这些内容会随公开仓库一起发布。**
> 不想公开就把 `public/data/command-code-usage.json` 从仓库移除
> （磁贴会显示「未同步」），或把仓库设为私有。

### 3. BRZ 购车基金 —— 同源直读 IndexedDB

BRZ-Fund 的数据存在 IndexedDB（库名 `brz-fund`），而 IndexedDB 是**按源隔离**的。
两个仓库都在 `CCE-Li` 下，部署后同属 `https://cce-li.github.io` 这个源，
因此部署到 GitHub Pages 后可以真正共享同一份数据 —— 仪表盘只读，绝不回写。

- 直读路径：探测 → 打开（**不带版本号**）→ 读取 `goals/current`、
  `transactions`、`settings/app` → 用与 BRZ-Fund 完全相同的桶聚合规则算余额。
- 退化为导入：不同源（例如本地 `localhost:5174`）时，把 BRZ-Fund 设置页导出的
  JSON 备份拖进 `[CONFIG]` 面板即可，快照缓存在 localStorage。
- 余额、进度、缺口、应急储备、本月净流入全部由
  `src/domain/brz.ts` 计算，该文件是 `BRZ-Fund/src/domain/balances.ts`
  的只读移植 —— **两边必须保持同口径**，改一边要同步另一边。

> ⚠️ **为什么不直接试着打开数据库**：无版本号打开一个**不存在**的库会创建它
> （version=1、无任何 objectStore）。之后 BRZ-Fund 打开时因版本相同不会触发
> upgrade，就会读不到任何 store —— 等于把 BRZ-Fund 弄坏。
> 所以代码里先用 `indexedDB.databases()` 确认存在，确认不了（浏览器不支持该 API）
> 就老实退化为导入备份，绝不冒险。

## 部署

推送到 `main` 即触发 `.github/workflows/deploy.yml`：type-check → test → build → 发布
到 GitHub Pages（`base: './'` 适配子路径）。

> ⚠️ **必须先把这个仓库的 Pages Source 设为 "GitHub Actions"**
> （Settings → Pages → Build and deployment → Source）。
> 如果设成 "Deploy from a branch"，GitHub 会直接服务**仓库根目录**：浏览器会去请求
> 源码入口 `/src/main.ts`（404），页面**全白且没有任何报错**。
> 判断方法：访问 `…/My-Dashboard/src/main.ts`，返回 200 就说明配置错了。
> 改完 Source 后到 Actions 页重跑一次 workflow（`workflow_dispatch` 已开启，可直接
> 点 "Run workflow"，不需要新提交）。

站点地址形如 `https://cce-li.github.io/My-Dashboard/`。若要与 BRZ-Fund 共享
IndexedDB，两者必须部署在**同一 GitHub 账号的 Pages 下**（同一 origin）。

## 已知边界

- `SOLVED` 是抓取窗口内的通过题数，不是历史总数（CF API 限制）。
- Command Code 用量是**快照**，不是实时值；页面上标注了生成时间。
- 导入的 BRZ 备份是静态快照，不会随后续记账自动更新；同源直读才是实时的。
- 布局顺序、CF handle、导入的备份都存在本机 localStorage，换机器需重设。
