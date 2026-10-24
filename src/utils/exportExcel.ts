import ExcelJS from 'exceljs'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const DATE_FORMAT = 'yyyy-mm-dd'

// Headers matching these words get the dollar-accounting number format, mirroring the
// company's reference workbook (e.g. "Baseline Budget", "Software Spend", "Actuals").
const CURRENCY_HEADER = /spend|budget|cost|price|amount|actual|remaining|total|fee|charge/i
const CURRENCY_FORMAT = '_("$"* #,##0_);_("$"* \\(#,##0\\);_("$"* "-"??_);_(@_)'

// Header styling reproduces the navy/white band used across the company's "Detailed" and
// "System Inventory" report sheets: white bold Calibri on a #1F4E78 fill, centered and
// wrapped, with a thin border on every side.
const HEADER_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
const HEADER_FILL: ExcelJS.Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1F4E78' } }
const HEADER_ALIGNMENT: Partial<ExcelJS.Alignment> = { horizontal: 'center', vertical: 'middle', wrapText: true }
const HEADER_BORDER: Partial<ExcelJS.Borders> = {
  top: { style: 'thin' },
  bottom: { style: 'thin' },
  left: { style: 'thin' },
  right: { style: 'thin' },
}
const HEADER_ROW_HEIGHT = 30
const DATA_FONT: Partial<ExcelJS.Font> = { name: 'Calibri', size: 11 }

export async function downloadExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {})

  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet(sheetName, {
    views: [{ state: 'frozen', ySplit: 1 }],
  })
  worksheet.columns = headers.map(header => ({ header, key: header }))

  const headerRow = worksheet.getRow(1)
  headerRow.height = HEADER_ROW_HEIGHT
  headerRow.eachCell(cell => {
    cell.font = HEADER_FONT
    cell.fill = HEADER_FILL
    cell.alignment = HEADER_ALIGNMENT
    cell.border = HEADER_BORDER
  })

  for (const row of rows) {
    const out: Record<string, unknown> = {}
    for (const header of headers) {
      const value = row[header]
      // Skip empties so blank cells stay truly blank; an "" in a numeric column breaks SUM
      if (value === null || value === undefined || value === '') continue
      out[header] = typeof value === 'string' && ISO_DATE.test(value)
        ? new Date(`${value}T00:00:00`)
        : value
    }
    const dataRow = worksheet.addRow(out)
    headers.forEach((header, index) => {
      const cell = dataRow.getCell(index + 1)
      cell.font = DATA_FONT
      if (cell.value instanceof Date) {
        cell.numFmt = DATE_FORMAT
      } else if (typeof cell.value === 'number' && CURRENCY_HEADER.test(header)) {
        cell.numFmt = CURRENCY_FORMAT
      }
    })
  }

  worksheet.columns.forEach((column, index) => {
    const header = headers[index]
    const widest = rows.reduce((longest, row) => {
      const value = row[header]
      return Math.max(longest, value == null ? 0 : String(value).length)
    }, header.length)
    column.width = Math.min(Math.max(widest + 2, 10), 40)
  })

  worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: headers.length } }

  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  // The anchor must be attached to the DOM for .click() to reliably trigger a
  // download across browsers (an unattached <a> can silently no-op the download).
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
