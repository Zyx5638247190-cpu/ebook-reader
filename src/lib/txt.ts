export interface DecodedTxt {
  text: string
  encoding: string
}

function decodeWith(encoding: string, bytes: Uint8Array, fatal = false): string {
  return new TextDecoder(encoding, { fatal }).decode(bytes)
}

/** 浏览器端解码：BOM 优先，其次 UTF-8 严格模式，最后降级 GBK */
export function decodeTxt(buffer: ArrayBuffer): DecodedTxt {
  const bytes = new Uint8Array(buffer)

  if (bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) {
    return { text: normalize(decodeWith('utf-8', bytes.subarray(3))), encoding: 'UTF-8 BOM' }
  }
  if (bytes[0] === 0xff && bytes[1] === 0xfe) {
    return { text: normalize(decodeWith('utf-16le', bytes.subarray(2))), encoding: 'UTF-16LE' }
  }
  if (bytes[0] === 0xfe && bytes[1] === 0xff) {
    return { text: normalize(decodeWith('utf-16be', bytes.subarray(2))), encoding: 'UTF-16BE' }
  }

  try {
    return { text: normalize(decodeWith('utf-8', bytes, true)), encoding: 'UTF-8' }
  } catch {
    /* 不是合法 UTF-8，继续尝试 GBK */
  }

  try {
    return { text: normalize(decodeWith('gbk', bytes)), encoding: 'GBK' }
  } catch {
    return { text: normalize(decodeWith('utf-8', bytes)), encoding: 'UTF-8（容错）' }
  }
}

function normalize(text: string): string {
  return text.replace(/\r\n?/g, '\n').replace(/\n{3,}/g, '\n\n')
}

export function readTxtMeta(fileName: string, text: string): { title: string; author: string } {
  const base = fileName.replace(/\.[^.]+$/, '').trim()
  let title = base || '未命名书籍'
  let author = ''

  const bracketTitle = base.match(/《([^》]{1,60})》/)
  if (bracketTitle) title = bracketTitle[1].trim()

  const authorInText = text.slice(0, 800).match(/^[\s\u3000]*作\s*者\s*[:：]\s*(.{1,40})$/m)
  if (authorInText) author = authorInText[1].trim()

  if (!author) {
    const dash = base.match(/^(.{1,60}?)\s*[-—_]\s*(.{1,20})$/)
    if (dash) {
      title = dash[1].trim()
      author = dash[2].trim()
    }
  }

  return { title: title.slice(0, 80), author: author || '未知作者' }
}
