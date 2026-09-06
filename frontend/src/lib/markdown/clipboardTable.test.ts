import { describe, expect, it } from 'vitest'
import {
  clipboardToMarkdownTable,
  delimitedToGrid,
  gridToMarkdown,
  htmlToGrid,
} from './clipboardTable'

/** Minimal stand-in for the parts of DataTransfer the converter reads. */
function clipboard(flavours: Record<string, string>): DataTransfer {
  return { getData: (type: string) => flavours[type] ?? '' } as unknown as DataTransfer
}

// Excel wraps its payload in fragment comments and a mso-laden style block.
const EXCEL_HTML = `
<html xmlns:o="urn:schemas-microsoft-com:office:office">
<head><style>
<!-- table { mso-displayed-decimal-separator:"\\."; } .xl65 { mso-number-format:"0\\.00"; } -->
</style></head>
<body link="#0563C1">
<!--StartFragment-->
<table border=0 cellpadding=0 cellspacing=0 width=240 style='border-collapse:collapse'>
 <tr height=20><td class=xl65>Metric</td><td>FY24</td><td>FY25E</td></tr>
 <tr height=20><td>Revenue</td><td>1200</td><td>1450</td></tr>
 <tr height=20><td>EBITDA%</td><td>18.2</td><td>&nbsp;</td></tr>
</table>
<!--EndFragment-->
</body></html>`

const SHEETS_HTML = `<meta charset="utf-8"><google-sheets-html-origin>
<table xmlns="http://www.w3.org/1999/xhtml" cellspacing="0" cellpadding="0" dir="ltr">
<colgroup><col width="100"/><col width="100"/></colgroup>
<tbody>
<tr><td data-sheets-value='{"1":2,"2":"Ticker"}'>Ticker</td><td>Weight</td></tr>
<tr><td>INFY</td><td>12%</td></tr>
</tbody></table>`

// Gmail and Outlook wrap ordinary prose in a single-column layout table.
const GMAIL_LAYOUT_HTML = `<div dir="ltr"><table width="100%"><tbody>
<tr><td>Hi team, sharing my notes on the quarter.</td></tr>
<tr><td>Margins look durable.</td></tr>
</tbody></table></div>`

describe('htmlToGrid', () => {
  it('reads an Excel range past the fragment comments and mso style block', () => {
    expect(htmlToGrid(EXCEL_HTML)).toEqual([
      ['Metric', 'FY24', 'FY25E'],
      ['Revenue', '1200', '1450'],
      ['EBITDA%', '18.2', ' '],
    ])
  })

  it('reads a Google Sheets range', () => {
    expect(htmlToGrid(SHEETS_HTML)).toEqual([
      ['Ticker', 'Weight'],
      ['INFY', '12%'],
    ])
  })

  it('expands colspan so the columns stay aligned', () => {
    const html = `<table>
      <tr><th colspan="2">Forecast</th><th>Note</th></tr>
      <tr><td>a</td><td>b</td><td>c</td></tr>
    </table>`
    expect(htmlToGrid(html)).toEqual([
      ['Forecast', '', 'Note'],
      ['a', 'b', 'c'],
    ])
  })

  it('ignores rows belonging to a nested layout table', () => {
    const html = `<table><tr><td>outer1</td><td>outer2</td></tr>
      <tr><td><table><tr><td>inner</td></tr></table></td><td>x</td></tr></table>`
    const grid = htmlToGrid(html)
    expect(grid).toHaveLength(2)
    expect(grid![1]).toHaveLength(2)
  })

  it('returns null when a cell is long enough to be an article', () => {
    expect(htmlToGrid(`<table><tr><td>${'x'.repeat(600)}</td><td>b</td></tr></table>`)).toBeNull()
  })

  it('returns null when there is no table', () => {
    expect(htmlToGrid('<div><p>just prose</p></div>')).toBeNull()
  })
})

describe('delimitedToGrid', () => {
  it('parses a plain tab-separated range', () => {
    expect(delimitedToGrid('A\tB\r\n1\t2\r\n')).toEqual([
      ['A', 'B'],
      ['1', '2'],
    ])
  })

  it('keeps a quoted cell containing a tab and a newline intact', () => {
    const tsv = 'Name\tNote\r\n"Infy"\t"line one\nline two\ttabbed"\r\n'
    expect(delimitedToGrid(tsv)).toEqual([
      ['Name', 'Note'],
      ['Infy', 'line one\nline two\ttabbed'],
    ])
  })

  it('unescapes a doubled quote', () => {
    expect(delimitedToGrid('A\tB\r\n"say ""hi"""\t2\r\n')![1][0]).toBe('say "hi"')
  })

  it('does not treat a mid-field quote as an opener', () => {
    expect(delimitedToGrid('Size\tQty\r\n5" pipe\t3\r\n')![1][0]).toBe('5" pipe')
  })

  it('returns null for ragged prose that happens to contain a tab', () => {
    expect(delimitedToGrid('Some prose\twith a tab\nand a second line\n')).toBeNull()
  })

  it('returns null when there is no tab at all', () => {
    expect(delimitedToGrid('line one\nline two\n')).toBeNull()
  })

  it('returns null for a single column', () => {
    expect(delimitedToGrid('a\nb\n')).toBeNull()
  })
})

describe('gridToMarkdown', () => {
  it('renders the first row as the header', () => {
    expect(
      gridToMarkdown([
        ['Metric', 'FY24'],
        ['Revenue', '1200'],
      ])
    ).toBe('| Metric | FY24 |\n| --- | --- |\n| Revenue | 1200 |')
  })

  it('escapes a pipe inside a cell', () => {
    const md = gridToMarkdown([
      ['A', 'B'],
      ['x|y', 'z'],
    ])
    expect(md).toContain('x\\|y')
  })

  it('collapses an in-cell newline to a space rather than a <br>', () => {
    // react-markdown drops raw HTML, so a <br> would vanish silently and
    // concatenate the text either side.
    const md = gridToMarkdown([
      ['A', 'B'],
      ['line one\nline two', 'z'],
    ])
    expect(md).toContain('line one line two')
    expect(md).not.toContain('<br')
  })

  it('normalises &nbsp; and pads short rows', () => {
    const md = gridToMarkdown([
      ['A', 'B', 'C'],
      ['1', ' '],
    ])
    expect(md).toBe('| A | B | C |\n| --- | --- | --- |\n| 1 |  |  |')
  })

  it('refuses a single-column grid', () => {
    expect(gridToMarkdown([['a'], ['b']])).toBeNull()
  })

  it('refuses a grid larger than the cell budget', () => {
    const wide = Array.from({ length: 5 }, () => Array.from({ length: 900 }, () => 'x'))
    expect(gridToMarkdown(wide)).toBeNull()
  })
})

describe('clipboardToMarkdownTable', () => {
  it('converts a real Excel paste', () => {
    const md = clipboardToMarkdownTable(
      clipboard({
        'text/html': EXCEL_HTML,
        'text/plain': 'Metric\tFY24\tFY25E\r\nRevenue\t1200\t1450\r\nEBITDA%\t18.2\t\r\n',
      })
    )
    expect(md).toBe(
      '| Metric | FY24 | FY25E |\n| --- | --- | --- |\n| Revenue | 1200 | 1450 |\n| EBITDA% | 18.2 |  |'
    )
  })

  it('falls back to the TSV flavour when no HTML is offered', () => {
    const md = clipboardToMarkdownTable(clipboard({ 'text/plain': 'A\tB\r\n1\t2\r\n' }))
    expect(md).toBe('| A | B |\n| --- | --- |\n| 1 | 2 |')
  })

  it('returns null for a Gmail layout table so the browser pastes normally', () => {
    expect(
      clipboardToMarkdownTable(
        clipboard({
          'text/html': GMAIL_LAYOUT_HTML,
          'text/plain': 'Hi team, sharing my notes on the quarter.\nMargins look durable.',
        })
      )
    ).toBeNull()
  })

  it('returns null for ordinary prose', () => {
    expect(
      clipboardToMarkdownTable(clipboard({ 'text/plain': 'Margins should expand in FY26.' }))
    ).toBeNull()
  })

  it('survives a clipboard that throws on getData', () => {
    const hostile = {
      getData: () => {
        throw new Error('blocked')
      },
    } as unknown as DataTransfer
    expect(clipboardToMarkdownTable(hostile)).toBeNull()
  })
})
