# 奶龙书屋 · 电子书阅读器（Web Demo）

黄色奶龙主题的本地电子书阅读器。当前版本是可运行的 **Web Demo**，用 Vite + React 实现，尚未接入 Electron 桌面壳。

## 快速开始

```bash
npm install
npm run dev
```

打开终端提示的地址（默认 `http://localhost:5173/`）。书架为空时可以直接点「试试示例 TXT / 试试示例 EPUB」，或把 `.txt` / `.epub` 文件拖进窗口。

其他命令：

```bash
npm run build     # 类型检查 + 生产构建
npm run lint      # tsc --noEmit
npm run test      # Vitest：解码、章节切分、分页定位、EPUB 进度降级
npm run test:e2e  # Playwright 冒烟测试（需先启动 dev server）
npm run test:storage # 模拟浏览器禁用站点存储，检查书架不报警且刷新后书还在
npm run test:progress # 翻到 TXT / EPUB 最后一页，检查全书进度显示 100%
npm run test:matrix # 3 字号 × 3 主题 × 2 窗口尺寸的排版矩阵检查
```

`test:e2e` / `test:matrix` 会自动探测 5173–5177 中正在运行的奶龙书屋，并自动查找本机 Chrome / Edge。端口或浏览器路径不同时：

```powershell
$env:BASE_URL="http://localhost:5175/"; npm run test:e2e
```

## 已实现功能

- **导入**：TXT（UTF-8 / GBK / UTF-16，BOM 优先）、EPUB，支持多选与拖拽；重复文件会被拦截
- **书架**：封面（EPUB 提取，缺省为主色渐变占位）、书名、作者、格式、进度、最近阅读排序、移出书架
- **TXT 阅读**：按章节切分（识别失败时按 8000 字切块）、离屏容器 + 二分查找分页、跨章翻页
- **EPUB 阅读**：epub.js `paginated` 渲染、CFI 定位、目录两级缩进、主题穿透 iframe
- **翻页**：点击左 / 右 25% 热区、方向键 / PageUp / PageDown / 空格、横向滑动
- **目录**：左侧滑入侧边栏，当前章节高亮，点击跳转后自动关闭
- **设置**：三档字号（16 / 19 / 23px）、三种背景（白 / 米黄 / 夜间），即时生效并持久化
- **进度记忆**：翻页防抖写入、切章 / 卸载 / 关闭页面立即写入，重开回到原位置
- **主题**：暖黄奶龙视觉、空状态 / 加载 / 设置面板奶龙插画、夜间自动降亮

## 技术栈

React 19 · TypeScript（strict）· Vite 7 · Tailwind CSS v4 · Zustand 5 · epub.js 0.3.93 · idb · lucide-react · Vitest

## 目录结构

```text
src/
├─ components/          展示组件（书架卡片、奶龙、Toast 等）
├─ pages/
│  ├─ Bookshelf.tsx     书架页
│  └─ Reader/           阅读页、目录、设置、翻页热区、epub 会话
├─ stores/              library / reader / settings 三个 Zustand store
├─ lib/                 解析、分页、存储、主题、纯函数
└─ index.css            Tailwind 入口、阅读主题变量、奶龙动效
public/samples/         示例 TXT / EPUB
scripts/                示例生成与 Playwright 检查脚本
```

## 存储策略（Web Demo）

所有数据都放在 **localStorage**（`reader:` 前缀），不使用 IndexedDB：

| 数据 | 键 | 说明 |
| --- | --- | --- |
| 书籍元数据 | `reader:books` | 书名、作者、格式、进度、最近阅读时间 |
| 阅读进度 | `reader:progress:<id>` | 按书保存；TXT 含字符偏移，EPUB 含 CFI |
| 阅读设置 | `reader:settings` | 字号与主题，全局保存 |
| TXT 全文 | `reader:content:<id>` | 直接存文本 |
| EPUB 原始字节 | `reader:content:<id>` | 转 Base64 后存字符串 |
| EPUB 封面 | `reader:cover:<id>` | data URL，可直接给 `<img>` |

localStorage 每个 origin 约 5MB，因此单本 EPUB 控制在 3MB 以内、TXT 控制在约 400 万字以内；超限或配额不足时，导入会给出明确提示而不是静默失败。封面超过 700KB 或配额不足时自动回退为占位封面。

浏览器禁用站点存储（隐私设置、无痕策略或受限预览环境）时，应用会降级为**内存 + 服务端文件兜底**：`npm run dev` / `npm run preview` 启动的开发服务器会把写入同步到 `.reader-data/`，刷新后自动读回，书架、进度、设置都不丢。纯静态部署没有该接口时才会退化为仅本次页面有效，此时导入成功的提示会注明「刷新后会丢失」。

TXT 进度以**章内字符偏移**为唯一真值，页码只是派生值；字号或窗口尺寸变化后会重新分页并按偏移回位。EPUB 进度按 `CFI → 章节 href → 全书百分比 → 从头开始` 降级恢复。

## 与 Electron 版的差异

- 文件导入使用 `<input type="file">` + 浏览器 File API，暂未接入 `window.api` IPC
- 存储使用浏览器 IndexedDB / localStorage，对应桌面版的 `userData` 目录
- 未包含主进程、原生菜单、electron-builder 打包配置

阅读器核心（分页、进度、主题、目录）与 UI 已按可迁移方式拆分，接入 Electron 时主要替换导入层与存储层。

## 已知取舍

- localStorage 容量约 5MB：大体积 EPUB / TXT 无法导入，会提示「本地存储空间不足」；如需支持大文件，应改回 IndexedDB 或接入 Electron 文件系统
- 书架暂未提供按书名 / 导入时间排序与右键菜单
- 设置项为全局设置，尚未按书独立保存
- 暂无全文搜索、书签、批注、PDF/MOBI 等非 MVP 功能
