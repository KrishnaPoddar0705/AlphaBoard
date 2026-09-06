/**
 * Turns a copied spreadsheet range into a GitHub-flavoured markdown table.
 *
 * Excel, Numbers, Google Sheets and web pages all put a `text/html` <table> on
 * the clipboard, with a tab-separated `text/plain` alongside it. We prefer the
 * HTML because it survives cells containing tabs and newlines; the TSV is the
 * fallback for sources that offer no HTML flavour.
 *
 * Anything that is not confidently a data table returns null so the caller lets
 * the browser paste normally. Getting that wrong is worse than not converting:
 * Gmail, Outlook and Word wrap ordinary prose in layout tables, and silently
 * turning a pasted paragraph into a table would be baffling.
 */

/** Beyond this a paste is a document, not a table -- and parsing it would stall. */
const MAX_CELLS = 4000
/** A cell this long means we grabbed an article wrapped in a layout table. */
const MAX_CELL_CHARS = 500

function safeGet(data: DataTransfer, type: string): string {
  try {
    return data.getData(type) || ''
  } catch {
    return ''
  }
}

function cellText(cell: HTMLElement): string {
  const clone = cell.cloneNode(true) as HTMLElement
  clone.querySelectorAll('br').forEach((br) => br.replaceWith('\n'))
  return clone.textContent ?? ''
}

export function htmlToGrid(html: string): string[][] | null {
  let doc: Document
  try {
    doc = new DOMParser().parseFromString(html, 'text/html')
  } catch {
    return null
  }

  const table = doc.querySelector('table')
  if (!table) return null

  // Excel and Word nest tables for layout. Keep only rows owned by this table,
  // otherwise a nested table's cells flatten into the parent's rows.
  const rows = Array.from(table.querySelectorAll('tr')).filter(
    (tr) => tr.closest('table') === table
  )

  const grid: string[][] = []
  for (const tr of rows) {
    const cells = Array.from(tr.querySelectorAll<HTMLTableCellElement>(':scope > td, :scope > th'))
    if (cells.length === 0) continue

    const row: string[] = []
    for (const cell of cells) {
      const text = cellText(cell)
      if (text.length > MAX_CELL_CHARS) return null
      row.push(text)
      // colspan is expanded so columns stay aligned; rowspan is deliberately
      // ignored, since honouring it needs an occupancy matrix for a case that
      // produces an ambiguous markdown table anyway.
      const span = Math.min(Math.max(cell.colSpan || 1, 1), 20)
      for (let i = 1; i < span; i++) row.push('')
    }
    grid.push(row)
  }

  return grid.length > 0 ? grid : null
}

/**
 * Parses tab-separated clipboard text. Excel quotes any cell containing a tab,
 * newline or quote, and doubles embedded quotes, so a naive split on \t and \n
 * corrupts exactly the cells people care about.
 */
export function delimitedToGrid(text: string): string[][] | null {
  if (!text.includes('\t')) return null

  const rows: string[][] = []
  let row: string[] = []
  let cur = ''
  let inQuotes = false
  let i = 0

  while (i < text.length) {
    const ch = text[i]

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i += 2
          continue
        }
        inQuotes = false
        i++
        continue
      }
      cur += ch
      i++
      continue
    }

    // Only treat a quote as an opener at the start of a field, so `5" pipe`
    // stays literal text.
    if (ch === '"' && cur === '') {
      inQuotes = true
      i++
      continue
    }
    if (ch === '\t') {
      row.push(cur)
      cur = ''
      i++
      continue
    }
    if (ch === '\r') {
      i++
      continue
    }
    if (ch === '\n') {
      row.push(cur)
      rows.push(row)
      row = []
      cur = ''
      i++
      continue
    }
    cur += ch
    i++
  }
  if (cur !== '' || row.length > 0) {
    row.push(cur)
    rows.push(row)
  }

  while (rows.length > 0 && rows[rows.length - 1].every((c) => c.trim() === '')) rows.pop()

  // A spreadsheet range is always a perfect rectangle. Ragged rows mean this is
  // prose that happens to contain a tab.
  if (rows.length < 2) return null
  const cols = rows[0].length
  if (cols < 2) return null
  if (rows.some((r) => r.length !== cols)) return null

  return rows
}

function escapeCell(raw: string): string {
  return (
    raw
      // Excel fills blank cells with &nbsp;, and Sheets sprinkles zero-widths.
      .replace(/\u00a0/g, ' ')
      .replace(/[\u200b-\u200d\ufeff]/g, '')
      .replace(/\\/g, '\\\\')
      .replace(/\|/g, '\\|')
      // A markdown table row is one line, and react-markdown drops raw <br>
      // because rehype-raw is not installed -- it would vanish silently and
      // concatenate the text either side. Collapse whitespace to a space.
      .replace(/\s+/g, ' ')
      .trim()
  )
}

export function gridToMarkdown(grid: string[][]): string | null {
  if (grid.length < 2) return null

  const cols = Math.max(...grid.map((r) => r.length))
  if (cols < 2) return null
  if (grid.length * cols > MAX_CELLS) return null

  const normalised = grid.map((r) => {
    const cells = r.slice(0, cols).map(escapeCell)
    while (cells.length < cols) cells.push('')
    return cells
  })

  const line = (cells: string[]) => `| ${cells.join(' | ')} |`
  const separator = `| ${Array(cols).fill('---').join(' | ')} |`

  // The first row becomes the header -- Excel emits <td> throughout and never
  // marks a header, and a selected range's top row is nearly always one.
  return [line(normalised[0]), separator, ...normalised.slice(1).map(line)].join('\n')
}

/** The markdown table for this clipboard payload, or null to paste normally. */
export function clipboardToMarkdownTable(data: DataTransfer | null): string | null {
  if (!data) return null

  const html = safeGet(data, 'text/html')
  if (html) {
    const grid = htmlToGrid(html)
    if (grid) {
      const md = gridToMarkdown(grid)
      if (md) return md
    }
  }

  const text = safeGet(data, 'text/plain')
  if (text) {
    const grid = delimitedToGrid(text)
    if (grid) return gridToMarkdown(grid)
  }

  return null
}
