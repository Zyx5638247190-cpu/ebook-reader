/**
 * 生成示例 EPUB（EPUB3，含封面与三级目录），仅在需要重新生成示例时运行：
 *   npm run sample:epub
 */
import JSZip from 'jszip'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'

const chapters = [
  {
    id: 'chapter1',
    title: '第一章 借来的月亮',
    paragraphs: [
      '那天傍晚，奶龙在旧书摊上发现了一本没有封面的书。摊主是个戴圆眼镜的老先生，他说这本书在这里放了很久，谁也没有把它带走。',
      '“它讲什么？”奶龙问。',
      '“讲一只小龙，想把月亮借回家。”老先生推了推眼镜，“不过它一直没还。”',
      '奶龙把书翻到最后一页，发现那里真的夹着一张借书卡，上面的日期已经模糊了。它想了很久，最后用两颗水果糖把书换回了家。',
      '夜里，奶龙把书放在窗台上，月光正好落在摊开的那一页。书里的小龙站在山顶，伸着手，月亮就停在它的掌心上方，像一盏不肯熄灭的小灯。',
      '奶龙忽然明白，月亮不是被借走的，是被记住的。它把书合上，对着窗外小声说：“那我也记住你啦。”',
    ],
  },
  {
    id: 'chapter2',
    title: '第二章 书架上的小房间',
    paragraphs: [
      '奶龙的房间不大，但有一整面墙的书架。最上面一层放着它舍不得读完的书，中间一层是读过很多遍的旧朋友，最下面一层则留给那些还没准备好打开的故事。',
      '它给每一本书都安排了一个位置，像给客人准备房间。有的书喜欢靠窗，有的书要挨着暖灯，还有一本讲大海的书，被它特意放在了蓝色的小盒子里。',
      '有一天，一只迷路的飞蛾闯了进来，在书架前绕了三圈，最后停在一本诗集上。奶龙没有赶它走，只是把台灯调暗了一点，怕灯光太亮，惊扰了这位夜里的读者。',
      '飞蛾停了很久，翅膀一开一合，像在慢慢翻页。奶龙趴在桌边看着，觉得这大概就是阅读最安静的样子：不需要说话，也不需要被谁看见，只要有一个愿意停下来的时刻。',
      '后来飞蛾飞走了。奶龙在诗集里夹了一片薄薄的叶子，作为那一晚的书签。它想，等很久以后再翻开，也许还能闻到一点点夜风的味道。',
    ],
  },
  {
    id: 'chapter3',
    title: '第三章 雨天的页码',
    paragraphs: [
      '下雨的日子，奶龙不喜欢出门。它会泡一杯温热的牛奶，把椅子拖到窗边，听雨点敲在玻璃上，像有人在远处翻书。',
      '那本书它已经读到一半。故事里的主角正在穿过一片很长的森林，走了很多页，还是没有找到出口。奶龙一点也不着急，它知道有些路就是要走久一点，急也没有用。',
      '雨越下越大，窗外的树被洗得发亮。奶龙读到一句：“如果你迷路了，就先看看脚下。”它低头看了看，自己的脚正踩在毛毯的边缘，毛毯上有一圈被磨得发白的线。',
      '它忽然笑了。原来迷路的时候，脚下也一直有东西接着自己。',
      '那一章读完，奶龙在页脚画了一只很小很小的龙，当作给主角的同伴。它合上书，发现雨已经小了，天边露出一小块淡淡的黄，像书页边缘被灯光照亮的颜色。',
    ],
  },
  {
    id: 'chapter4',
    title: '第四章 把故事留到明天',
    paragraphs: [
      '晚上九点，奶龙会把书签放好，把书合上，再用手掌轻轻压一压封面，像跟今天的故事道别。',
      '它从不勉强自己读完一章。困了就睡，走神了就看看窗外，读到喜欢的地方就停下来，让那句话在心里多待一会儿。它觉得，书不会跑掉，明天还会在那里等它。',
      '关灯之前，奶龙会看一眼书架。那些书安静地站着，有的厚，有的薄，有的已经旧得发软。它们不说话，却像一群可靠的朋友，知道它读到哪里，也知道它明天还会回来。',
      '奶龙钻进被窝，把今天读到的那句话又想了一遍。窗外有很轻的风，远处有很淡的灯。它闭上眼睛，觉得自己正停在一本书的某一页上，而那一页刚好有月光。',
      '明天，故事会从这一页继续。',
    ],
  },
]

const chapterFile = (chapter) => `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>${chapter.title}</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body>
    <h1>${chapter.title}</h1>
    ${chapter.paragraphs.map((p) => `<p>${p}</p>`).join('\n    ')}
  </body>
</html>
`

const navItem = (chapter) =>
  `            <li><a href="${chapter.id}.xhtml">${chapter.title}</a></li>`

// 两层目录：卷分组 + 章节，用来覆盖嵌套 TOC 的解析与缩进
const navItems = `        <li>
          <span>第一卷 月亮与书架</span>
          <ol>
${chapters
  .slice(0, 2)
  .map(navItem)
  .join('\n')}
          </ol>
        </li>
        <li>
          <span>第二卷 雨与明天</span>
          <ol>
${chapters
  .slice(2)
  .map(navItem)
  .join('\n')}
          </ol>
        </li>`

const nav = `<?xml version="1.0" encoding="utf-8"?>
<!DOCTYPE html>
<html xmlns="http://www.w3.org/1999/xhtml" xmlns:epub="http://www.idpf.org/2007/ops" xml:lang="zh-CN" lang="zh-CN">
  <head>
    <meta charset="utf-8" />
    <title>目录</title>
    <link rel="stylesheet" type="text/css" href="style.css" />
  </head>
  <body>
    <nav epub:type="toc" id="toc">
      <h1>目录</h1>
      <ol>
${navItems}
      </ol>
    </nav>
  </body>
</html>
`

const opf = `<?xml version="1.0" encoding="utf-8"?>
<package xmlns="http://www.idpf.org/2007/opf" version="3.0" unique-identifier="bookid" xml:lang="zh-CN">
  <metadata xmlns:dc="http://purl.org/dc/elements/1.1/">
    <dc:identifier id="bookid">urn:uuid:nailong-demo-0001</dc:identifier>
    <dc:title>奶龙与月亮</dc:title>
    <dc:creator>奶龙饲养员</dc:creator>
    <dc:language>zh-CN</dc:language>
    <dc:description>一只黄色小奶龙与月亮、书架和雨天的四个小故事。</dc:description>
    <meta property="dcterms:modified">2026-10-18T00:00:00Z</meta>
    <meta name="cover" content="cover-image" />
  </metadata>
  <manifest>
    <item id="nav" href="nav.xhtml" media-type="application/xhtml+xml" properties="nav" />
    <item id="css" href="style.css" media-type="text/css" />
    <item id="cover-image" href="cover.svg" media-type="image/svg+xml" properties="cover-image" />
${chapters.map((c) => `    <item id="${c.id}" href="${c.id}.xhtml" media-type="application/xhtml+xml" />`).join('\n')}
  </manifest>
  <spine>
${chapters.map((c) => `    <itemref idref="${c.id}" />`).join('\n')}
  </spine>
</package>
`

const css = `body {
  font-family: "Songti SC", "SimSun", serif;
  line-height: 1.8;
  margin: 0;
  padding: 0 8%;
}
h1 {
  font-size: 1.5em;
  margin: 1.2em 0 1em;
  font-weight: 600;
}
p {
  margin: 0 0 0.8em;
  text-indent: 2em;
  font-size: 1em;
}
`

const cover = `<svg xmlns="http://www.w3.org/2000/svg" width="600" height="800" viewBox="0 0 600 800">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#FFD54F" />
      <stop offset="1" stop-color="#FFCA28" />
    </linearGradient>
    <radialGradient id="moon" cx="0.5" cy="0.5" r="0.5">
      <stop offset="0" stop-color="#FFF9E3" />
      <stop offset="1" stop-color="#FFE9A3" />
    </radialGradient>
  </defs>
  <rect width="600" height="800" fill="url(#bg)" />
  <circle cx="430" cy="190" r="92" fill="url(#moon)" opacity="0.95" />
  <ellipse cx="300" cy="740" rx="190" ry="46" fill="#F0B02A" opacity="0.35" />
  <circle cx="300" cy="500" r="150" fill="#FFE082" stroke="#F0B02A" stroke-width="6" />
  <path d="M205 375 C182 330 205 292 243 286 C240 326 253 350 274 366 Z" fill="#F9A825" />
  <path d="M395 375 C418 330 395 292 357 286 C360 326 347 350 326 366 Z" fill="#F9A825" />
  <ellipse cx="252" cy="500" rx="20" ry="25" fill="#3A3226" />
  <ellipse cx="348" cy="500" rx="20" ry="25" fill="#3A3226" />
  <circle cx="259" cy="491" r="6" fill="#FFFFFF" />
  <circle cx="355" cy="491" r="6" fill="#FFFFFF" />
  <ellipse cx="215" cy="540" rx="26" ry="15" fill="#FF9E80" opacity="0.6" />
  <ellipse cx="385" cy="540" rx="26" ry="15" fill="#FF9E80" opacity="0.6" />
  <path d="M276 545 Q300 570 324 545" fill="none" stroke="#3A3226" stroke-width="9" stroke-linecap="round" />
  <ellipse cx="300" cy="650" rx="84" ry="66" fill="#FFF4C9" />
  <text x="300" y="128" text-anchor="middle" font-family="Serif" font-size="58" fill="#6B5518" letter-spacing="8">奶龙与月亮</text>
  <text x="300" y="182" text-anchor="middle" font-family="Serif" font-size="26" fill="#7A6423" letter-spacing="4">四个温柔的小故事</text>
</svg>
`

const container = `<?xml version="1.0" encoding="utf-8"?>
<container version="1.0" xmlns="urn:oasis:names:tc:opendocument:xmlns:container">
  <rootfiles>
    <rootfile full-path="OEBPS/content.opf" media-type="application/oebps-package+xml" />
  </rootfiles>
</container>
`

const zip = new JSZip()
zip.file('mimetype', 'application/epub+zip', { compression: 'STORE' })
zip.file('META-INF/container.xml', container)
zip.file('OEBPS/content.opf', opf)
zip.file('OEBPS/nav.xhtml', nav)
zip.file('OEBPS/style.css', css)
zip.file('OEBPS/cover.svg', cover)
chapters.forEach((chapter) => {
  zip.file(`OEBPS/${chapter.id}.xhtml`, chapterFile(chapter))
})

const output = resolve('public/samples/nailong-demo.epub')
mkdirSync(dirname(output), { recursive: true })
const buffer = await zip.generateAsync({
  type: 'nodebuffer',
  compression: 'DEFLATE',
  compressionOptions: { level: 9 },
  mimeType: 'application/epub+zip',
})
writeFileSync(output, buffer)
console.log(`已生成 ${output}（${buffer.length} bytes）`)
