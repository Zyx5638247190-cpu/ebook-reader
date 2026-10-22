# AGENTS.md · 奶龙电子书阅读器开发指令

> 本文件面向在本仓库中工作的 AI 代理与开发者，是**执行约束**，不是需求文档。
> 产品行为以 `PRD.md` 为准，实现细节以 `TECH_DESIGN.md` 为准；两者与本文件冲突时，先指出冲突再动手，不要自行改需求。

---

## 1. 项目概述

一款**桌面端电子书阅读器**，以「黄色奶龙」为吉祥物与视觉主体，主打暖黄、柔和、护眼的沉浸式阅读体验。纯本地运行，无账号、无网络请求、无广告。

**MVP 功能（必须全部可用）**

1. 导入书籍：TXT 与 EPUB，支持多选
2. 书架：封面、书名、作者、阅读进度，按最近阅读排序
3. 阅读：分页渲染、翻页（点击 / 键盘 / 滑动 / 按钮）、目录侧边栏跳转
4. 进度记忆：退出后自动保存，下次打开回到原位置
5. 阅读设置：字号三档（小 / 中 / 大）、背景三主题（白 / 米黄 / 夜间）

**明确不做**：在线书城、账号体系、云同步、PDF/MOBI/AZW3、划线批注、全文搜索、朗读翻译、移动端。

**当前仓库状态**：只有 `PRD.md` 与 `TECH_DESIGN.md` 两份文档，尚未初始化代码工程。开始编码前先按 `TECH_DESIGN.md` 第 4 节搭建 electron-vite 脚手架，不要假设任何文件已存在。

---

## 2. 技术栈

| 层 | 选型 | 备注 |
| --- | --- | --- |
| 桌面容器 | Electron（最新稳定版） | 主进程负责窗口、菜单、文件对话框与读取 |
| 构建 | electron-vite（Vite） | 一套配置构建 main / preload / renderer |
| UI | React 19 + TypeScript（`strict: true`） | 函数组件 + Hooks，不用 class 组件 |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`）+ CSS Variables | 布局用工具类，主题色走语义变量 |
| 状态 | Zustand | 3 个 store：library / reader / settings |
| 本地存储 | IndexedDB（`idb`）+ localStorage | 分层策略见第 6 节，不可混用 |
| EPUB | `epubjs`（0.3.x，锁定版本） | 解析、渲染、分页、CFI 定位 |
| TXT 编码 | `chardet` + `iconv-lite`（仅主进程） | 解决 GBK / UTF-16 乱码 |
| 图标 | `lucide-react` | 线性风格，线宽 1.75–2 |
| 打包 | electron-builder | Windows NSIS `.exe`、macOS `.dmg` |

**不要引入**：React Router（两页面用 store 切换）、Redux、MUI/Ant Design 等组件库、任何 CDN 资源、任何在线字体、任何埋点或远程请求。所有依赖必须打进安装包，离线可用。

**命令约定**（脚手架建立后写入 `package.json`）

```bash
npm run dev          # 开发模式，主进程 + 渲染进程 HMR
npm run build        # 类型检查 + 构建
npm run build:win    # 打包 Windows 安装包
npm run build:mac    # 打包 macOS dmg
npm run test         # Vitest（解析、分页纯函数）
npm run lint         # ESLint + tsc --noEmit
```

---

## 3. 项目结构

```
src/
├─ main/                 # 主进程：窗口、菜单、文件读取与解码
│  ├─ index.ts
│  ├─ menu.ts
│  └─ ipc/files.ts
├─ preload/index.ts      # 仅通过 contextBridge 暴露白名单 API
└─ renderer/src/
   ├─ pages/             # 页面级组件，只做编排
   │  ├─ Bookshelf/
   │  └─ Reader/
   ├─ components/        # 可复用展示组件
   ├─ stores/            # Zustand，一个领域一个文件
   ├─ db/                # IndexedDB 封装，禁止在组件里直接 openDB
   ├─ parsers/           # txt.ts / epub.ts，输出统一 ParsedBook
   ├─ pagination/        # paginateTxt.ts / cache.ts，纯函数优先
   ├─ hooks/             # usePagination / usePageTurn / useAutoSave
   ├─ lib/               # cfi.ts / debounce.ts 等无 UI 工具
   ├─ styles/            # index.css（Tailwind 入口）、themes.css
   ├─ types/             # 共享类型：BookRecord / ProgressRecord / Chapter
   └─ assets/dragon/     # 奶龙 SVG
```

**放置规则**

- 只有一个页面用的组件，放进该页面的 `components/` 子目录，不放全局 `components/`。
- 所有 IndexedDB 访问集中在 `db/`，组件与 store 不得直接写 SQL 式调用。
- 所有 epub.js 调用集中在 `parsers/epub.ts` 与 `Reader` 的 rendition 封装中，其他文件不得 import `epubjs`。
- 纯逻辑（章节切分、分页、href 规范化、百分比换算）必须与 React 解耦，可直接被 Vitest 调用。

---

## 4. 开发规范

### 4.1 组件拆分

| 类型 | 职责 | 例子 |
| --- | --- | --- |
| 页面（pages） | 组合、数据获取、事件分发 | `Bookshelf`、`Reader` |
| 容器（containers） | 连接 store、处理副作用 | `TocSidebar`、`SettingsPanel` |
| 展示（components） | 只接收 props，无 store 依赖 | `BookCard`、`DragonMascot`、`EmptyState` |
| 纯函数（lib / pagination） | 无 DOM 副作用（测量除外）、可测试 | `paginateChapter`、`normalizeHref` |

- **单文件 ≤ 200 行**，超过就拆；单个组件 props ≤ 7 个，超出改为传对象或拆组件。
- 一个组件只做一件事：`Reader` 不负责解析文件，`BookCard` 不负责跳转。
- 列表项必须 `key` 稳定（用 `book.id`，禁止用数组下标）。
- 副作用集中在 hooks 或 store action，组件内不写 `setTimeout` 业务逻辑。
- 翻页、定位、进度写入必须收敛到单一入口（`turnPage` / `restoreProgress` / `flushProgress`），禁止多处各写一套。

### 4.2 命名规范

| 对象 | 规则 | 示例 |
| --- | --- | --- |
| 组件文件 | PascalCase，与组件同名 | `BookCard.tsx`、`TocSidebar.tsx` |
| 组件名 | PascalCase，名词 | `SettingsPanel`、`PageTurner` |
| 非组件文件 | camelCase / kebab-case 统一用 camelCase | `paginateTxt.ts`、`usePageTurn.ts` |
| Hook | `use` 前缀 + 动词 | `usePagination`、`useAutoSave` |
| Store | `useXxxStore`，文件 `xxxStore.ts` | `useLibraryStore` |
| 事件处理 | `handleXxx` / props 用 `onXxx` | `handleTurnPage` / `onImport` |
| 布尔量 | `is / has / can / should` 前缀 | `isRestoring`、`hasCover` |
| 类型 / 接口 | PascalCase，不加大写 `I` 前缀 | `BookRecord`、`ProgressRecord` |
| 常量 | UPPER_SNAKE_CASE | `CHAPTER_RE`、`FONT_SIZE_MAP` |
| CSS 变量 | 语义化，禁止以颜色命名 | `--reader-bg`、`--chrome-bg`，不用 `--yellow-1` |
| IndexedDB | store 用小写复数 | `books`、`progress`、`locations` |
| 测试文件 | 同名 + `.test.ts` | `paginateTxt.test.ts` |

### 4.3 TypeScript 与状态

- `strict: true`，禁止 `any`（确需时用 `unknown` + 收窄）；公共函数必须写返回类型。
- 类型定义放 `types/`，禁止在组件里重复声明同一结构。
- Zustand 只存**轻量状态**：书籍元数据、当前页号、设置、UI 开关。**禁止**把书籍全文、EPUB ArrayBuffer 放进 store（会拖垮 devtools 与内存）。
- 全局状态只用 3 个 store；页面局部状态（面板开合动画等）用 `useState`。
- 异步失败必须被处理：解析失败、存储配额不足、CFI 失效都要有用户可见提示或降级，不允许静默 `catch {}`（降级链中的试探性 catch 需注释说明）。

### 4.4 样式规范

- 布局、间距、圆角用 Tailwind 工具类；**颜色只用语义变量**（`bg-[var(--reader-bg)]` 或映射后的 token），禁止在组件里写死 `#FFD54F`、`#fff`。
- 新增颜色先加到 `styles/index.css` 的 `@theme` 与 `themes.css`，再使用。
- 不使用内联 `style` 设置颜色（阅读区动态主题除外，那里必须用 CSS 变量）。
- 交互态齐全：hover / active / focus-visible / disabled；`focus-visible` 必须有可见轮廓，键盘可达。
- 动效克制：时长 150–250ms，缓动 `ease-out`；奶龙呼吸动效 2s 循环、缩放不超过 1.03；禁止大面积视差、禁止翻页 3D 翻转。

---

## 5. 视觉规范（黄色奶龙主题）

### 5.1 色板

| 用途 | 色值 |
| --- | --- |
| 主色渐变 | `#FFD54F → #FFCA28` |
| 主色深（按下态 / 强调） | `#F9A825` |
| 界面背景 | `#FFFDF7` |
| 文字主色 | `#3A3226` |
| 文字次色 | `#8C8478` |
| 分割线 | `#F0E6CE` |
| 阅读底 · 白色 | `#FFFFFF`，正文 `#2B2B2B` |
| 阅读底 · 米黄（默认） | `#FBF3E0`，正文 `#4A3F35` |
| 阅读底 · 夜间 | `#1E1B18`，正文 `#C9C2B6` |

**硬性约束**：同一屏内高饱和暖黄面积 ≤ 20%；暖黄只用于强调（主按钮、进度条、选中态、吉祥物），阅读区保持低对比、无大面积色块；正文与背景对比度不低于 WCAG AA。

### 5.2 奶龙使用

- 造型：圆头、短爪、豆豆眼、腮红，纯色填充 + 单层描边，扁平风。
- 出现位置：书架空状态（120–180px）、导入 loading、读完提示、设置面板底部装饰（48px）、引导气泡。
- **禁止**常驻正文阅读区、禁止遮挡文字、禁止在夜间模式下保持高亮（需 `brightness(0.75)` 降亮）。
- 资源用 SVG，禁止位图放大导致模糊；新增奶龙插画放 `assets/dragon/`，命名 `dragon-idle.svg`、`dragon-sleep.svg`。

### 5.3 排版

- 界面字体：系统无衬线（Windows 微软雅黑 / macOS 苹方）。
- 正文字号三档：**小 16px / 中 19px / 大 23px**；行高 1.8；段间距 0.8em。
- 页边距：左右各 8%，上下各 6%。
- 正文对齐：左对齐，**禁止两端对齐与自动断词**（会让分页测量失准）。
- 最小窗口 900×600，小于此尺寸不保证分页正确。

---

## 6. 关键实现约定（不可随意更改）

这些是 `TECH_DESIGN.md` 已定的架构决策，改动前必须先说明理由。

1. **存储分层**：设置进 localStorage（键前缀 `reader:`），书库元数据 / 全文 / 封面 / 进度 / locations 进 IndexedDB（库名 `nailong-reader`）。禁止用 localStorage 存书籍正文（5MB 限制）。禁止把 blob URL 持久化，封面必须转成 Blob 存库。
2. **IPC 白名单**：`contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`；渲染进程只通过 `window.api`（`openBookFile` / `readBookFile` / `showInFolder`）访问文件。禁止 `webSecurity: false`，禁止在渲染进程 `require('fs')`。
3. **TXT 分页**：离屏测量容器 + 二分查找，输出字符区间 `{ start, end }`；按章懒分页并缓存，缓存键含字号、字体、窗口尺寸。不得改用 CSS 多列或整本预分页。
4. **TXT 进度**：以**章内字符偏移**为唯一真值，页码只是派生值。字号或窗口变化后必须按偏移回位，不能按页码恢复。
5. **EPUB 职责**：分页、翻页、CFI 由 epub.js 负责；`flow: 'paginated'`、`spread: 'none'`、`allowScriptedContent: false`。不要自己解析 EPUB 的 XML 来处理目录。
6. **EPUB 进度降级链**：精确 CFI → 章节 href → 全书百分比 → 从头开始。每级都要 try/catch 并继续下一级。
7. **保存时机**：翻页 debounce 800ms；章节切换与阅读页卸载立即写；`beforeunload` 额外写一条 localStorage `reader:pendingProgress` 兜底，启动时合并。
8. **主题穿透**：CSS 变量无法进入 EPUB iframe，必须用 `rendition.themes` 注入；切换主题时外层容器与 iframe 内样式必须同时更新，避免边框与底色不一致。
9. **统一模型**：TXT 与 EPUB 解析后都输出 `ParsedBook` + `Chapter[]`，阅读页不得出现 `if (format === 'epub')` 散落各处的分支，格式差异收敛在解析层与渲染层各一处。

---

## 7. 注意事项：阅读体验优先

任何改动先问一句：**这会让阅读更舒服，还是只是看起来更花哨？** 无法回答时，选择更安静的那个方案。

**必须守住的行为**

- 翻页不出现空白页、不截断半行文字、不出现滚动条；每页文字完整落在视口内。
- 字号切换后停留在原句附近，绝不跳回章首；重排期间冻结翻页，避免位置被覆盖。
- 启动时按上次主题渲染，不出现白屏闪烁（在 React 挂载前写 `data-theme`）。
- 夜间模式不刺眼：正文 `#C9C2B6`、背景 `#1E1B18`，图标与奶龙同步降亮，不出现纯白大块。
- 米黄是默认主题（护眼），不要默认白色。
- 空书架、加载中、解析失败都给出明确文案，失败要写清原因（文件损坏 / 编码不支持 / 配额不足）。
- 阅读页默认干净：工具栏自动隐藏，只有鼠标移到顶部或点击中间区域才出现，正文区无任何常驻装饰。

**性能底线**：翻页 ≤ 100ms；10MB TXT 导入 ≤ 2s；首次进入章节 ≤ 300ms；书架 500 本不卡顿。分页、解析等重活不得放在渲染关键路径上同步执行。

**交互底线**：所有功能键盘可达（← / → / PageUp / PageDown / 空格 / Esc 关闭面板）；点击左 25% 上一页、右 25% 下一页、中间呼出工具栏；点击目录项后关闭侧边栏。

---

## 8. 交付前自检

改完代码，逐条确认后再汇报完成：

- [ ] `npm run lint` 与 `npm run test` 通过，无 `any`、无 `ts-ignore`
- [ ] 颜色无硬编码，三种主题下文字与控件均清晰可读
- [ ] 三种字号、三种主题、900×600 与最大化窗口，共 18 种组合下无截断、无空白页
- [ ] 打开书籍 → 翻页 10 次 → 切字号 → 关闭应用 → 重开，回到原位置（偏差 ≤ 1 页）
- [ ] 导入 GBK 编码 TXT、无章节 TXT、EPUB2、EPUB3、无目录 EPUB 各一本，均能正常阅读
- [ ] 目录跳转准确，当前章节高亮正确
- [ ] 断网状态下全流程可用，DevTools Network 无外部请求
- [ ] 未见 `console.log` 残留、未提交调试用的假数据或临时按钮
- [ ] 新增文件放在正确目录，未把业务逻辑塞进 `pages/` 或组件中

---

## 9. 沟通约定

- 需求有歧义时先按 `PRD.md` 最接近的条款实现，并在回复中说明假设；不要静默扩大范围。
- 发现文档与实现冲突，先指出来，给出两个选项和推荐项，再等确认。
- 汇报结果时说明：改了什么文件、关键决策是什么、验证了什么、还剩什么风险。不要只贴代码。
- 不要为了让功能"看起来完成"而硬编码数据、跳过错误处理或注释掉校验。
