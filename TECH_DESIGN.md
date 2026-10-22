# 奶龙电子书阅读器 · 技术设计文档

> 版本：v0.1（对应 PRD v0.1 MVP）
> 更新日期：2026-10-18
> 适用范围：TXT / EPUB 导入、书架、分页阅读、目录、进度记忆、阅读设置

---

## 1. 设计目标与约束

| 目标 | 技术含义 |
| --- | --- |
| 阅读体验优先 | 翻页响应 ≤ 100ms，滚动/缩放不出现空白页与文字截断 |
| 渲染一致性 | 分页依赖字体度量，必须在不同机器、不同系统上表现一致 |
| 纯本地 | 无网络请求、无账号，书籍内容与进度全部落本地存储 |
| 可离线安装 | 依赖全部打包进安装包，不引用 CDN |
| 渐进增强 | 先跑通 TXT 全链路，再补 EPUB；解析模块独立，可单独替换 |

主要约束：单文件 ≤ 100MB；书架 500 本不卡顿；Windows 10+ 与 macOS 12+ 双平台。

---

## 2. 技术栈选型

### 2.1 桌面框架：Electron（选用）

| 对比项 | Electron | Tauri 2 |
| --- | --- | --- |
| 渲染内核 | 自带 Chromium，**所有平台完全一致** | Windows 用 WebView2、macOS 用 WKWebView，存在差异 |
| epub.js 兼容性 | 好：iframe、blob URL、CFI 行为一致 | 有一定坑：自定义 asset 协议、CSP、blob 生命周期在两个 WebView 上行为不同 |
| 文件与编码处理 | 主进程直接使用 Node 生态（iconv-lite / chardet） | 需写 Rust command 或插件 |
| 安装包体积 | 约 90–150MB | 约 5–15MB |
| 内存占用 | 较高（150–300MB） | 较低 |
| 调试与迭代 | 成熟，DevTools 完整 | 需分别调试两个内核 |

**决策：使用 Electron。** 本项目最核心的体验是"按固定视口精确分页"，分页结果直接受字体度量与排版引擎影响。Electron 在 Windows / macOS 上共用同一 Chromium 版本，能保证分页结果与视觉完全一致；而 Tauri 在两个平台使用不同内核，同一本书的页码可能对不上，反而增加适配成本。体积与内存的劣势，对本产品（本地阅读工具，单实例常驻）影响可接受。

> 若后续对安装包体积有硬性要求，可平移至 Tauri 2，前提是 epub.js 在 WebView2 / WKWebView 上完成分页与 CFI 的双平台验证。解析层与 UI 层不依赖 Electron API（统一走 `window.api`），迁移成本可控。

### 2.2 完整技术栈

| 层 | 选型 | 说明 |
| --- | --- | --- |
| 桌面容器 | Electron（最新稳定版） | 主进程负责窗口、文件对话框、原生菜单 |
| 构建 | electron-vite + Vite | 一套配置同时构建 main / preload / renderer，HMR 可用 |
| UI | React 19 + TypeScript（strict） | 函数组件 + Hooks |
| 样式 | Tailwind CSS v4（`@tailwindcss/vite`）+ CSS Variables | 布局用 Tailwind，主题色用 CSS 变量驱动 |
| 状态管理 | Zustand | 书架、阅读器、设置三个 store，避免 Context 重渲染 |
| 本地存储 | IndexedDB（`idb`）+ localStorage | 见第 4 节分层策略 |
| EPUB 解析 | `epubjs`（0.3.x） | 解析、渲染、分页、CFI 定位一体 |
| TXT 编码识别 | `chardet` + `iconv-lite`（主进程） | 解决 GBK / UTF-16 乱码 |
| 路由 | 不引入路由库 | 两页面用 store 中的 `view` 状态切换，减少依赖 |
| 图标 | `lucide-react` | 线性图标，与圆润风格协调 |
| 打包 | electron-builder | 产出 Windows NSIS `.exe`、macOS `.dmg` |
| 测试 | Vitest（解析/分页纯函数）+ Playwright（Electron 冒烟） | 只覆盖关键路径 |

---

## 3. 架构总览

```
┌─────────────────────────── Main（Node） ───────────────────────────┐
│ 窗口管理 · 原生菜单 · 文件对话框                                      │
│ 文件读取 → 编码探测 → 解码为 UTF-8 文本（TXT）                        │
│ 返回 { path, name, size, text | bytes }                             │
└───────────────────────────────┬─────────────────────────────────────┘
                     IPC（contextBridge，白名单方法）
┌───────────────────────────────▼─────────────────────────────────────┐
│                        Renderer（React）                            │
│  pages/Bookshelf  pages/Reader                                      │
│  stores/  library · reader · settings                               │
│  parsers/ txt.ts · epub.ts          ← 解析为统一 Chapter[] 模型       │
│  pagination/ paginateTxt.ts · cache ← TXT 分页；EPUB 交给 epub.js     │
│  db/ books · contents · progress    ← IndexedDB 读写                 │
└─────────────────────────────────────────────────────────────────────┘
```

**统一书籍模型**：无论 TXT 还是 EPUB，解析后都产出同一结构，阅读页只面对这一层，不关心原始格式。

```ts
export interface Chapter {
  index: number;
  title: string;
  level: number;          // 目录层级，TXT 恒为 0
  href?: string;          // EPUB 章节路径（含 anchor）
  cfi?: string;           // EPUB 章节起始 CFI
  text?: string;          // TXT 章节正文（EPUB 不预加载）
  charStart?: number;     // TXT 在全文中的起始偏移
  charEnd?: number;
}

export interface ParsedBook {
  format: 'txt' | 'epub';
  title: string;
  author: string;
  chapters: Chapter[];
  text?: string;          // TXT 全文
  coverBlob?: Blob;
  wordCount?: number;
  encoding?: string;
}
```

---

## 4. 项目结构

```
ebook-reader/
├─ electron.vite.config.ts
├─ electron-builder.yml
├─ package.json
├─ tsconfig.json / tsconfig.node.json
├─ resources/                     # 应用图标、安装包资源
└─ src/
   ├─ main/
   │  ├─ index.ts                 # app 生命周期、创建 BrowserWindow
   │  ├─ menu.ts                  # 文件 → 导入 / 退出
   │  └─ ipc/files.ts             # 打开对话框、读取、解码、大小校验
   ├─ preload/
   │  └─ index.ts                 # contextBridge 暴露 window.api
   └─ renderer/
      ├─ index.html
      └─ src/
         ├─ main.tsx
         ├─ App.tsx               # 按 view 渲染书架或阅读页
         ├─ styles/
         │  ├─ index.css          # @import "tailwindcss"; @theme 令牌
         │  └─ themes.css         # [data-theme=light|sepia|dark] 变量
         ├─ pages/
         │  ├─ Bookshelf/index.tsx
         │  └─ Reader/index.tsx
         ├─ components/
         │  ├─ BookCard.tsx
         │  ├─ EmptyState.tsx     # 奶龙空状态
         │  ├─ DragonMascot.tsx
         │  ├─ Toolbar.tsx
         │  ├─ TocSidebar.tsx
         │  ├─ SettingsPanel.tsx
         │  ├─ PageTurner.tsx
         │  └─ ReaderContent.tsx  # TXT 文本渲染 / EPUB 挂载点
         ├─ stores/
         │  ├─ libraryStore.ts
         │  ├─ readerStore.ts
         │  └─ settingsStore.ts
         ├─ db/
         │  ├─ index.ts           # openDB、版本迁移
         │  ├─ books.ts
         │  ├─ contents.ts
         │  └─ progress.ts
         ├─ parsers/
         │  ├─ txt.ts             # 编码结果 → 章节切分
         │  └─ epub.ts            # epub.js 封装：元数据/封面/目录
         ├─ pagination/
         │  ├─ paginateTxt.ts     # 测量式分页（纯函数）
         │  └─ cache.ts           # 分页缓存 key 生成
         ├─ hooks/
         │  ├─ usePagination.ts
         │  ├─ usePageTurn.ts     # 键盘 / 点击 / 滑动
         │  └─ useAutoSave.ts
         ├─ lib/
         │  ├─ cfi.ts             # CFI 校验与降级
         │  └─ debounce.ts
         └─ assets/dragon/        # SVG：站立、趴着、睡觉、看书
```

---

## 5. 数据存储设计

### 5.1 分层策略（localStorage + IndexedDB）

| 数据 | 存储位置 | 理由 |
| --- | --- | --- |
| 阅读设置（字号、主题） | **localStorage** | 数据极小（< 1KB），需在首屏渲染前同步读取，避免主题闪烁 |
| 书籍元数据（书名、作者、路径、进度、最近阅读时间） | **IndexedDB** `books` | 500 本约 200KB，便于按字段索引与排序 |
| TXT 全文、EPUB 原始字节、封面 Blob | **IndexedDB** `contents` / `covers` | localStorage 仅约 5MB 且同步阻塞，10MB 的 TXT 会直接超限 |
| 阅读进度（详细定位） | **IndexedDB** `progress` | 需要保存 CFI / 偏移量等结构化字段 |
| EPUB locations（页码换算表） | **IndexedDB** `locations` | `locations.save()` 结果可达数百 KB |

> **与 PRD 的差异**：PRD 3.4 写的是 `userData/library.json` + 每本书独立进度文件。此处改为「IndexedDB + localStorage」：避免手写文件锁与原子写，浏览器层已提供事务与崩溃一致性；同时渲染进程可直接读写，少一层 IPC。若后续需要"用户可见的书库备份"，再从 IndexedDB 导出 JSON 文件即可。

### 5.2 IndexedDB Schema（`idb`）

```ts
// db/index.ts
import { openDB, type DBSchema } from 'idb';

interface ReaderDB extends DBSchema {
  books: {
    key: string;                       // bookId（uuid）
    value: BookRecord;
    indexes: { 'by-lastReadAt': number; 'by-title': string };
  };
  contents: {
    key: string;                       // bookId
    value: {
      bookId: string;
      text?: string;                   // TXT 全文
      epubBytes?: ArrayBuffer;         // EPUB 原始文件
      toc?: TocItem[];                 // 目录快照（离线兜底）
      savedAt: number;
    };
  };
  covers: { key: string; value: { bookId: string; blob: Blob } };
  progress: { key: string; value: ProgressRecord };
  locations: { key: string; value: { bookId: string; json: string; chars: number } };
}

export const dbPromise = openDB<ReaderDB>('nailong-reader', 1, {
  upgrade(db) {
    const books = db.createObjectStore('books', { keyPath: 'id' });
    books.createIndex('by-lastReadAt', 'lastReadAt');
    books.createIndex('by-title', 'title');
    db.createObjectStore('contents', { keyPath: 'bookId' });
    db.createObjectStore('covers', { keyPath: 'bookId' });
    db.createObjectStore('progress', { keyPath: 'bookId' });
    db.createObjectStore('locations', { keyPath: 'bookId' });
  },
});
```

```ts
export interface BookRecord {
  id: string;
  title: string;
  author: string;
  format: 'txt' | 'epub';
  filePath: string;
  fileSize: number;
  coverBlobId?: string;
  totalChapters: number;
  wordCount?: number;
  progress: number;          // 0–1，书架展示用
  lastReadAt: number;
  importedAt: number;
}

export interface ProgressRecord {
  bookId: string;
  chapterIndex: number;
  pageIndex: number;         // TXT：章内页序号；EPUB：displayed.page
  totalPagesInChapter?: number;
  charOffset?: number;       // TXT：章内字符偏移（首选恢复依据）
  cfi?: string;              // EPUB：首选恢复依据
  href?: string;             // EPUB：章节路径（CFI 失效时兜底）
  percent: number;           // 全书百分比
  updatedAt: number;
}
```

### 5.3 localStorage 键

```
reader:settings        → { fontSize: 'small'|'medium'|'large', theme: 'light'|'sepia'|'dark' }
reader:settings:perBook → { [bookId]: { fontSize, theme } }
reader:lastView        → 'bookshelf' | bookId
reader:schemaVersion   → '1'
```

读取时机：`main.tsx` 在 React 挂载前同步读取并写入 `<html data-theme>`，避免夜间模式白屏闪烁。

### 5.4 容量与清理

- 单本 10MB TXT 存为 UTF-8 字符串，IndexedDB 实际占用约 20–30MB；500 本场景按需加载，仅书架元数据常驻内存。
- `contents` 中的 EPUB 原始字节采用"保留原文件引用 + 缓存解析结果"策略：文件仍存在则优先读磁盘，文件被移动/删除时回退到缓存字节。
- 提供「清理缓存」入口：删除 `contents` / `covers` / `locations`，保留 `books` 与 `progress`。

---

## 6. EPUB 解析与渲染（epub.js）

### 6.1 初始化

```ts
import ePub, { type Book as EpubBook, type Rendition } from 'epubjs';

const book: EpubBook = ePub(epubBytes);   // 也支持文件路径 / blob URL
await book.ready;                          // 元数据、spine、manifest 就绪
const metadata = book.packaging.metadata;  // title / creator / language / layout
const coverUrl = await book.coverUrl();    // 可能为 null
```

- 在渲染进程中直接用 `ArrayBuffer` 构造，**不依赖 `file://`**，规避 Electron 安全策略与跨域限制。
- `book.packaging.metadata.layout === 'pre-paginated'` 的固定版式书，降级为「一节一页」，隐藏字号设置，避免强行重排破坏版式。
- 渲染容器固定高度，配置：

```ts
const rendition: Rendition = book.renderTo(el, {
  width: '100%',
  height: '100%',
  flow: 'paginated',
  spread: 'none',          // 单页显示，符合桌面阅读习惯
  allowScriptedContent: false,
});
```

### 6.2 元数据与封面

- 书名：`metadata.title` 为空时回退文件名。
- 作者：`metadata.creator` 可能是数组，统一 `Array.isArray ? join('、') : creator`。
- 封面：`book.coverUrl()` 返回 blob URL，需 `fetch(url) → blob` 存入 `covers`，**不要把 blob URL 存库**（生命周期仅当前会话）。
- 封面兜底：无封面或提取失败时，渲染「主色渐变 + 书名首字」的 SVG 占位图。

### 6.3 目录

```ts
const nav = await book.loaded.navigation;   // 0.3.x 为 Navigation 实例，可直接 forEach
const toc = nav.toc;                        // 顶层 TocItem[]

interface TocItem {
  id?: string;
  href: string;         // 相对路径，可能带 #fragment、可能 URL 编码
  label: string;        // 章节名，可能含空白/换行
  subitems?: TocItem[];
}
```

- 两级递归渲染，超过两级时压平到第二级并加缩进。
- 跳转直接 `rendition.display(item.href)`；epub.js 内部会把 href 解析为 spine section 并计算 CFI。
- 目录可能来自 `nav.xhtml`（EPUB3）或 `toc.ncx`（EPUB2），epub.js 已统一抽象，无需自己判断；若两者都缺失，回退方案见 7.1。

### 6.4 渲染与主题

```ts
rendition.themes.register('light', {
  body: { background: '#FFFFFF', color: '#2B2B2B' },
  'p, li': { 'line-height': '1.8' },
});
rendition.themes.register('sepia', {
  body: { background: '#FBF3E0', color: '#4A3F35' },
});
rendition.themes.register('dark', {
  body: { background: '#1E1B18', color: '#C9C2B6' },
  'img': { filter: 'brightness(0.82)' },
});

rendition.themes.default({
  body: { 'font-family': 'system-ui, "Microsoft YaHei", sans-serif', padding: '6% 8%' },
  'img': { 'max-width': '100%', height: 'auto' },
});

rendition.themes.select(theme);
rendition.themes.fontSize(fontSizeMap[level]);  // '16px' | '19px' | '23px'
```

**注意**：EPUB 自带 CSS 可能含 `background: #fff !important`、固定 `font-size`，导致主题失效。处理方式：主题规则用 `!important`（`themes.override` 或规则对象中显式声明），并在 `rendition.hooks.content` 中注入一层重置样式，禁止 `body` 出现固定白底。

### 6.5 locations（页码与百分比）

```ts
const cache = await getLocations(bookId);
if (cache && cache.chars === 1600) {
  book.locations.load(cache.json);
} else {
  await book.locations.generate(1600);      // 首次打开时生成，约 1–5s
  await saveLocations(bookId, { json: book.locations.save(), chars: 1600 });
}
```

- locations 只用于「全书百分比」与「跳到 x%」，不作为翻页依据（翻页由 rendition 控制）。
- 生成耗时随书增大，放在首屏渲染完成后的 `requestIdleCallback` 中执行，期间百分比显示为「--%」，不阻塞阅读。

---

## 7. TXT 解析与分页

### 7.1 解码

在主进程完成，避免渲染进程引入 Node 编码库：

```ts
// main/ipc/files.ts
const buf = await fs.readFile(filePath);
const detected = chardet.detect(buf) ?? 'UTF-8';
let encoding = detected;
if (/^UTF-16/.test(detected)) encoding = 'UTF-16LE';
const text = iconv.decode(buf, encoding);
return { text, encoding, size: buf.byteLength };
```

- BOM 优先：`EF BB BF` → UTF-8；`FF FE` → UTF-16LE；`FE FF` → UTF-16BE。
- 探测置信度低时，按 UTF-8 → GBK → UTF-16 依次试解码，选择「替换字符 U+FFFD 最少」的结果。
- 统一换行：`\r\n` / `\r` → `\n`，压缩 3 个以上连续空行。

### 7.2 章节切分

```ts
const CHAPTER_RE = /^[ \t　]*((?:第[零一二三四五六七八九十百千万0-9]+[章节回卷部篇])|(?:Chapter|CHAPTER)\s+\d+|序章|楔子|前言|后记|尾声)[^\n]{0,40}$/;
```

- 逐行扫描，命中即作为新章节标题；首个标题之前的内容归入「开始」章节。
- 识别失败（命中数 < 3 或平均章节字数 > 2 万字）则回退为**固定字数切块**：按 8000 字、在最近段落边界截断，命名「第 N 节」。
- 记录每章 `charStart` / `charEnd`，全局偏移用于进度恢复与百分比计算，避免重复扫描。

### 7.3 阅读页分页（测量式）

不采用 CSS 多列（`column-width`）：列数、页码与跳转都难以精确控制。采用**离屏容器 + 二分查找**，可得到确定的页边界。

```ts
// pagination/paginateTxt.ts
export interface PageSlice { start: number; end: number }  // 章内字符偏移

export function paginateChapter(
  chapterText: string,
  measureEl: HTMLElement,        // 与正文同宽同高、同字体、同 line-height、visibility:hidden
  limitHeight: number,
): PageSlice[] {
  const pages: PageSlice[] = [];
  let start = 0;

  while (start < chapterText.length) {
    // 以 4000 字符为初始上界，二分找「仍能放下」的最大 end
    let lo = start + 1;
    let hi = Math.min(start + 4000, chapterText.length);
    let best = lo;

    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      measureEl.textContent = chapterText.slice(start, mid);
      if (measureEl.scrollHeight <= limitHeight) {
        best = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }

    // 回退到最近的段落边界，避免把一句话拆到两页
    let end = best;
    const lastBreak = chapterText.lastIndexOf('\n', end);
    if (lastBreak > start + (end - start) * 0.6) end = lastBreak + 1;

    pages.push({ start, end });
    start = end;
  }
  return pages;
}
```

关键细节：

- **测量元素样式必须与正文完全一致**：`width`、`font-family`、`font-size`、`line-height: 1.8`、`padding`、`white-space: pre-wrap`、`text-align: left`（禁用两端对齐与连字符，避免切片重排后行高变化）。
- 容器高度取 `viewportHeight - 顶部工具栏 - 底部页码区`，用 `ResizeObserver` 监听，变化后 debounce 150ms 重新分页。
- **章节内分页，不整本分页**：10MB 书整本分页会卡死主线程；按章懒分页，翻到下一章再算。
- 超长章节（> 3 万字）先按 8000 字在段落处拆成"子节"，渲染层把子节当作虚拟页段处理，避免单章一次二分几十页。
- 分页结果缓存：`Map<bookId, Map<cacheKey, PageSlice[]>>`，`cacheKey = ${fontSize}|${fontFamily}|${width}x${height}`。主题不影响排版（只改颜色），不入 key。

### 7.4 渲染与翻页

- 每页只渲染 `chapterText.slice(page.start, page.end)` 对应的段落，用 `React.memo` 包裹页面内容，翻页时只替换文本。
- 翻页交互统一收敛到一个 `turnPage(delta)`：点击左右热区、`ArrowLeft/Right`、`PageUp/PageDown`、空格、触控板横向滑动全部映射到同一函数。
- 页内滚动一律禁用（`overflow: hidden`），避免"半页"状态；超出部分由分页算法保证不裁切。
- 跨章翻页：当前页为本章最后一页 → 加载下一章第 0 页；反向同理。章节切换时若未分页则先算首页，避免闪烁。

### 7.5 进度定位

TXT 以 **章内字符偏移** 为唯一真值：

```
恢复：chapterIndex → 取 chapterText → 确保已分页 → 二分查找包含 charOffset 的页 → 渲染
保存：charOffset = pages[pageIndex].start
```

这样字号、窗口尺寸变化后页码会变，但字符位置不变，恢复精度天然是"同一句话"，符合 PRD 中"≤1 页误差"的要求。

---

## 8. 关键技术难点与方案

### 8.1 EPUB 目录解析

**难点**

1. **来源不统一**：EPUB3 用 `nav.xhtml`，EPUB2 用 `toc.ncx`，部分书两者都有且内容不一致，个别书两者都缺。
2. **href 不规范**：可能带 `#fragment`、URL 编码（`%20`）、`../` 相对路径、大小写不一致，直接与 spine 的 `href` 字符串比较会匹配失败。
3. **层级与正文不对应**：目录项可能指向同一文件的多个锚点，或包含非正文项（封面、版权页）。
4. **label 脏数据**：含换行、多个空格、HTML 实体（`&amp;`）。

**方案**

```ts
function normalizeHref(href: string): string {
  const [path] = href.split('#');
  return decodeURIComponent(path).replace(/^\.\//, '').replace(/^\.\.\//, '');
}

function toTocTree(items: TocItem[], level = 0): TocNode[] {
  return items.map((item) => ({
    label: decodeEntities(item.label).replace(/\s+/g, ' ').trim() || '未命名章节',
    href: item.href,
    level,
    children: item.subitems ? toTocTree(item.subitems, level + 1) : [],
  }));
}
```

- 优先使用 epub.js 的 `book.loaded.navigation`（已处理 NCX/nav 差异），不自己解压 XML。
- 渲染前用 `normalizeHref` 与 `book.spine.each` 的 href 做一次映射，得到 `spineIndex`；映射失败不丢项，退化为"按 href 直接 display"。
- **目录缺失兜底**：遍历 spine，读取每个 section 的首个 `h1–h3` 作为标题（`section.load(book.load.bind(book))` 后查询），仍为空则用「第 N 节」。此过程异步执行，先展示骨架屏。
- 当前章节高亮：监听 `rendition.on('relocated')`，用 `location.start.href` 反查目录项（比较规范化后的路径，忽略 fragment），得到高亮节点。
- 点击跳转后主动关闭侧边栏，并让被点项滚动到可视区（`scrollIntoView({ block: 'center' })`）。

### 8.2 分页逻辑

**难点**

1. 分页依赖真实排版结果，`canvas.measureText` 只能测单行宽度，无法处理段落换行、图片、标题间距。
2. 字号、窗口尺寸、系统字体变化都会改变分页，必须可重算且不丢位置。
3. 大文件分页是 O(n) 的重排，全量计算会阻塞主线程。
4. EPUB 与 TXT 的分页责任方不同：EPUB 由 epub.js 内部完成，TXT 需自己实现，两者进度模型必须统一到"百分比 + 章内定位"。

**方案**

| 子问题 | 方案 |
| --- | --- |
| 精确分页 | 离屏测量容器 + 二分查找（见 7.3），得到字符区间而非像素位置 |
| 性能 | 按章懒分页 + 结果缓存；单次最多二分 12 次（4000 字符上界） |
| 重排触发 | `ResizeObserver` + 150ms debounce；字号切换时先记录 `charOffset`，重算后按偏移回位 |
| 避免闪烁 | 重算期间保留旧页快照，算完一次性替换；首页加载用骨架行 |
| 不切断英文单词 | 回退边界时同时检查 `\s` 与标点，英文单词整体下移 |
| EPUB 分页 | 固定容器尺寸 + `flow: 'paginated'`，由 epub.js 计算；字号变化调用 `themes.fontSize` 后 `rendition.resize()`，再用 CFI 回位 |
| 进度统一 | TXT 用 `charOffset / chapterLength` 折算章内比例，EPUB 用 `locations.percentageFromCfi`，对外统一为 `percent` |

**边界场景**

- 单段长度超过一页：二分后若 `best === start`，强制 `end = start + 1`，保证前进（防死循环）。
- 章节末尾只剩空行：压缩空白后仍可能产生空白页，分页后过滤 `text.slice(start, end).trim() === ''` 的页。
- 窗口中包含图片的 EPUB 章节：epub.js 自动缩放，容器需设 `overflow: hidden`，避免出现滚动条。

### 8.3 阅读进度保存与恢复

**难点**

1. 保存过于频繁会写库抖动，过于稀疏会丢进度（用户直接关窗口）。
2. 字号/窗口变化后页码失效，不能只存 `pageIndex`。
3. EPUB 的 CFI 在书文件变更、解析实现变化时可能失效，需要降级链。
4. 应用被强杀（任务管理器、断电）时，异步写入可能未完成。

**方案**

保存策略：

```
触发点：翻页后 debounce 800ms；章节切换立即写；阅读页卸载立即写；
        窗口 blur / beforeunload 同步兜底写一次。
内容：  完整 ProgressRecord（含 cfi / charOffset / percent）
写入：  IndexedDB 单条 put，按 bookId 覆盖，天然幂等，无需事务补偿。
书架：  同时更新 books.progress 与 lastReadAt（同一事务内两个 store）。
```

```ts
const flushProgress = useCallback(async (p: ProgressRecord) => {
  const db = await dbPromise;
  const tx = db.transaction(['progress', 'books'], 'readwrite');
  await Promise.all([
    tx.objectStore('progress').put(p),
    tx.objectStore('books').put({ ...book, progress: p.percent, lastReadAt: Date.now() }),
    tx.done,
  ]);
}, [book]);
```

恢复策略（EPUB 降级链）：

```ts
async function restoreEpub(rendition: Rendition, p: ProgressRecord) {
  const attempts = [
    () => p.cfi && rendition.display(p.cfi),                    // 1. 精确 CFI
    () => p.href && rendition.display(p.href),                  // 2. 章节起点
    () => p.percent > 0 && rendition.display(                       // 3. 全书百分比
      book.locations.cfiFromPercentage(p.percent)),
    () => rendition.display(),                                  // 4. 从头开始
  ];
  for (const attempt of attempts) {
    try {
      const r = await attempt();
      if (r) return 'restored';
    } catch { /* 继续下一级 */ }
  }
  return 'fallback';
}
```

- 每次 `relocated` 事件都更新内存态，写入走 debounce；**不要**在 `relocated` 里直接 await 写库。
- `beforeunload` 中 IndexedDB 写入不保证完成，因此额外用 `localStorage.setItem('reader:pendingProgress', JSON.stringify(p))` 做最后一跳；下次启动先读 pending，合并后再清空。
- 恢复完成后才允许翻页（`isRestoring` 标记），避免用户操作与恢复定位互相覆盖。
- 进度只增不倒退：若恢复出的 `percent` 比记录值低 5% 以上且非用户主动回翻，日志告警但仍以记录为准。

---

## 9. IPC 接口约定

```ts
// preload/index.ts
contextBridge.exposeInMainWorld('api', {
  openBookFile: () => ipcRenderer.invoke('file:open'),        // 弹窗 + 读取 + 解码
  readBookFile: (path: string) => ipcRenderer.invoke('file:read', path),
  showInFolder: (path: string) => ipcRenderer.invoke('shell:show', path),
});
```

```ts
// 返回类型
type OpenResult =
  | null
  | {
      path: string;
      name: string;
      ext: 'txt' | 'epub';
      size: number;
      text?: string;        // TXT：已解码的 UTF-8 文本
      encoding?: string;
      bytes?: Uint8Array;   // EPUB：原始字节
    };
```

安全基线：

- `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true`。
- 主进程校验扩展名与大小（≤ 100MB），拒绝目录与符号链接。
- 禁止 `webSecurity: false`、禁止 `allowRunningInsecureContent`。
- EPUB 内容在 iframe 内渲染，设置 `allowScriptedContent: false`，不执行书内脚本。

导入流程：点击导入 → IPC 弹窗 → 主进程读取解码 → 渲染进程解析 → 写 `books` / `contents` / `covers` → 刷新书架。也支持把文件拖入窗口（渲染进程直接 `file.arrayBuffer()`，TXT 的编码识别再走一次 IPC 解码）。

---

## 10. 主题与字号实现

- 语义令牌（CSS 变量）挂在 `<html data-theme>` 上，Tailwind v4 通过 `@theme` 映射为工具类：

```css
@import "tailwindcss";

@theme {
  --color-brand-300: #FFD54F;
  --color-brand-400: #FFCA28;
  --color-brand-600: #F9A825;
}

:root[data-theme='sepia'] { --reader-bg: #FBF3E0; --reader-fg: #4A3F35; --chrome-bg: #FFFDF7; }
:root[data-theme='light'] { --reader-bg: #FFFFFF; --reader-fg: #2B2B2B; --chrome-bg: #FFFDF7; }
:root[data-theme='dark']  { --reader-bg: #1E1B18; --reader-fg: #C9C2B6; --chrome-bg: #26221E; }
```

- TXT 阅读区：`style={{ background: 'var(--reader-bg)', color: 'var(--reader-fg)' }}`。
- EPUB 阅读区：CSS 变量**无法穿透 iframe**，必须通过 `rendition.themes` 注入（见 6.4）；切换主题时同时改外层容器与 iframe 内样式，避免边框色不匹配。
- 字号：三档映射为像素值，TXT 触发重新分页；EPUB 调 `themes.fontSize` + `rendition.resize()`。切换前记录定位点，切换后回位，禁止跳回章首。
- 夜间模式下奶龙 SVG 通过 `filter: brightness(0.75) saturate(0.85)` 降亮，不另做一套资源。

---

## 11. 性能与质量保障

| 指标 | 目标 | 手段 |
| --- | --- | --- |
| TXT 导入（≤10MB） | ≤ 2s | 主进程解码；章节切分单次线性扫描；不预分页 |
| 首次进入章节 | ≤ 300ms | 按章分页 + 二分上界 4000 字符 |
| 翻页 | ≤ 100ms | 只替换文本节点，无重排、无动画阻塞 |
| 字号切换 | ≤ 500ms | 重算当前章并回到原字符位置，其余章节缓存失效 |
| 书架渲染 | 500 本流畅 | 虚拟滚动（`@tanstack/react-virtual`）或分页加载 60 本/批 |
| 内存 | 常驻 < 400MB | 只保留当前书 + 相邻一章；封面使用缩略图 |

测试重点：

- 单元测试（Vitest）：`paginateChapter` 边界（空章、超长段、纯空行、中英混排）、章节正则、`normalizeHref`、百分比换算。
- 手工回归书单：GBK 编码 TXT、无章节 TXT、单章 5 万字 TXT、EPUB2（NCX）、EPUB3（nav）、无目录 EPUB、无封面 EPUB、含图片 EPUB、固定版式 EPUB。
- 冒烟（Playwright）：导入 → 打开 → 翻页 → 改字号 → 关窗 → 重开恢复。

---

## 12. 风险与备选方案

| 风险 | 影响 | 应对 |
| --- | --- | --- |
| epub.js 0.3.x 维护放缓、类型定义不全 | 遇到 bug 难修 | 锁定版本；为用到的 API 写最小 `d.ts`；渲染层隔离在 `parsers/epub.ts`，必要时换 `epub.ts`（同 API 的 TS 重写版）或 foliate-js |
| 二分分页在极端窄窗口下抖动 | 页码跳变 | 最小窗口 900×600；`ResizeObserver` debounce；重算期间冻结翻页 |
| locations 生成慢 | 首次打开百分比延迟 | 后台生成 + 进度提示；未生成时用章内比例估算 |
| EPUB 内联样式覆盖主题 | 夜间模式白底刺眼 | 注入重置样式 + `!important` 覆盖 + 内容 hook 统一处理 |
| 大文件写入 IndexedDB 失败（配额） | 导入失败 | 捕获 `QuotaExceededError`，提示清理缓存；提供"仅存路径不缓存内容"选项 |
| 原文件被移动/删除 | 重开无法解析 | 优先用缓存内容；缺失时提示重新定位文件，并保留进度 |

---

## 13. 实施里程碑（对齐 PRD 版本规划）

| 阶段 | 技术任务 |
| --- | --- |
| M1 骨架 | electron-vite 工程、双窗口页面切换、Tailwind 主题令牌、奶龙 SVG 资源、IPC 文件读取 |
| M2 书架 | IndexedDB 封装、TXT 导入与解码、书卡与空状态、进度展示 |
| M3 阅读（TXT） | 章节切分、二分分页、翻页交互、目录、进度保存与恢复、字号/主题 |
| M4 EPUB | epub.js 接入、元数据/封面、目录映射、CFI 定位、locations |
| M5 打磨 | 重排回位、降级链、性能优化、安装包与自动更新（可选） |

---

## 14. 待确认事项

1. 是否引入虚拟滚动依赖（`@tanstack/react-virtual`）解决 500 本书架，还是先按 60 本/批加载。
2. EPUB 原始字节是否长期缓存（占空间但抗文件移动），建议默认缓存、设置中可关闭。
3. 是否支持拖拽导入（成本低，建议纳入 M2）。
4. 进度"按书独立设置"是否保留"应用到所有书籍"开关（PRD 3.5 已列为可选）。
