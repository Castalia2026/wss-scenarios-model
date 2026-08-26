// Build HOW_TO_USE.docx from HOW_TO_USE.md, embedding the figures in docs/images.
// Run from this folder:  npm install   (once)   then   node build_docx.mjs
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  Document, Packer, Paragraph, TextRun, ImageRun, HeadingLevel, AlignmentType,
  Table, TableRow, TableCell, WidthType, ShadingType, BorderStyle, PageBreak,
} from 'docx'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const MD = path.join(ROOT, 'HOW_TO_USE.md')
const OUT = path.join(ROOT, 'HOW_TO_USE.docx')

const TEXT_W_PX = 624          // 6.5in of text at 96 px/in (Letter, 1in margins)
const TABLE_W_DXA = 9360       // 6.5in in DXA

function pngSize(file) {
  const b = fs.readFileSync(file)
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) }
}

function runs(text, base = {}) {
  const out = []
  const re = /(\*\*[^*]+\*\*|\*[^*]+\*|`[^`]+`|\[[^\]]+\]\([^)]+\))/g
  let last = 0, m
  const push = (t, o) => { if (t) out.push(new TextRun({ text: t, ...base, ...o })) }
  while ((m = re.exec(text)) !== null) {
    push(text.slice(last, m.index))
    const tok = m[0]
    if (tok.startsWith('**')) push(tok.slice(2, -2), { bold: true })
    else if (tok.startsWith('`')) push(tok.slice(1, -1), { font: 'Consolas', size: 18 })
    else if (tok.startsWith('[')) push(tok.slice(1, tok.indexOf(']')))
    else push(tok.slice(1, -1), { italics: true })
    last = m.index + tok.length
  }
  push(text.slice(last))
  return out.length ? out : [new TextRun({ text: '', ...base })]
}

const md = fs.readFileSync(MD, 'utf8').split(/\r?\n/)
const kids = []
const isTable = l => /^\s*\|/.test(l)
const isRule = l => /^-{3,}\s*$/.test(l)

let i = 0
while (i < md.length) {
  const line = md[i]
  if (!line.trim()) { i++; continue }

  if (isRule(line)) { kids.push(new Paragraph({ children: [new PageBreak()] })); i++; continue }

  const h = /^(#{1,4})\s+(.*)$/.exec(line)
  if (h) {
    const lvl = [HeadingLevel.HEADING_1, HeadingLevel.HEADING_2, HeadingLevel.HEADING_3, HeadingLevel.HEADING_4][h[1].length - 1]
    kids.push(new Paragraph({ heading: lvl, children: runs(h[2]),
      spacing: { before: h[1].length === 1 ? 0 : 260, after: 130 }, keepNext: true }))
    i++; continue
  }

  const img = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/.exec(line)
  if (img) {
    const file = path.join(ROOT, img[2])
    const { w, h: ih } = pngSize(file)
    const width = Math.min(TEXT_W_PX, w)
    kids.push(new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 140, after: 60 }, keepNext: true,
      children: [new ImageRun({ type: 'png', data: fs.readFileSync(file), transformation: { width, height: Math.round(width * ih / w) } })],
    }))
    i++; continue
  }

  if (isTable(line)) {
    const block = []
    while (i < md.length && isTable(md[i])) block.push(md[i++])
    const cells = r => r.trim().replace(/^\||\|$/g, '').split('|').map(c => c.trim())
    const head = cells(block[0])
    const body = block.slice(2).map(cells)
    const n = head.length
    const colW = Array.from({ length: n }, () => Math.floor(TABLE_W_DXA / n))
    const mkCell = (t, isHead) => new TableCell({
      width: { size: colW[0], type: WidthType.DXA },
      shading: isHead ? { type: ShadingType.CLEAR, fill: '1F3864', color: 'auto' } : undefined,
      margins: { top: 60, bottom: 60, left: 110, right: 110 },
      children: [new Paragraph({ spacing: { before: 20, after: 20 },
        children: runs(t, isHead ? { bold: true, color: 'FFFFFF', size: 19 } : { size: 19 }) })],
    })
    kids.push(new Table({ columnWidths: colW, width: { size: TABLE_W_DXA, type: WidthType.DXA },
      rows: [ new TableRow({ tableHeader: true, children: head.map(t => mkCell(t, true)) }),
        ...body.map(r => new TableRow({ children: Array.from({ length: n }, (_, c) => mkCell(r[c] ?? '', false)) })) ] }))
    kids.push(new Paragraph({ spacing: { after: 120 }, children: [] }))
    continue
  }

  if (/^[-*]\s+/.test(line)) {
    while (i < md.length && /^[-*]\s+/.test(md[i])) {
      let t = md[i].replace(/^[-*]\s+/, ''); i++
      while (i < md.length && /^\s{2,}\S/.test(md[i]) && !/^[-*]\s+/.test(md[i].trim())) { t += ' ' + md[i].trim(); i++ }
      kids.push(new Paragraph({ bullet: { level: 0 }, spacing: { after: 80 }, children: runs(t) }))
    }
    continue
  }

  let para = line.trim(); i++
  while (i < md.length && md[i].trim() && !isTable(md[i]) && !isRule(md[i])
         && !/^#{1,4}\s/.test(md[i]) && !/^!\[/.test(md[i]) && !/^[-*]\s+/.test(md[i])) {
    para += ' ' + md[i].trim(); i++
  }
  const isCaption = /^\*\*Figure\s/.test(para)
  kids.push(new Paragraph({
    spacing: { after: isCaption ? 220 : 140, line: 276 },
    alignment: AlignmentType.LEFT,
    children: runs(para, isCaption ? { size: 19 } : {}),
    ...(isCaption ? { border: { left: { style: BorderStyle.SINGLE, size: 12, color: '1F3864', space: 8 } }, indent: { left: 120 } } : {}),
  }))
}

const doc = new Document({
  creator: 'WSS Strategic Scenarios Tool',
  title: 'How to use the model',
  styles: { default: {
    document: { run: { font: 'Calibri', size: 21 }, paragraph: { spacing: { line: 276 } } },
    heading1: { run: { font: 'Calibri', size: 32, bold: true, color: '1F3864' } },
    heading2: { run: { font: 'Calibri', size: 26, bold: true, color: '1F3864' } },
    heading3: { run: { font: 'Calibri', size: 23, bold: true, color: '2E5496' } },
  } },
  sections: [{
    properties: { page: { size: { width: 12240, height: 15840 }, margin: { top: 1440, bottom: 1440, left: 1440, right: 1440 } } },
    children: kids,
  }],
})

fs.writeFileSync(OUT, await Packer.toBuffer(doc))
console.log('wrote', OUT, fs.statSync(OUT).size, 'bytes;', kids.length, 'blocks')
