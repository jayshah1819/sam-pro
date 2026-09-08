import * as XLSX from 'xlsx'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/

export function downloadExcel(filename: string, sheetName: string, rows: Record<string, unknown>[]) {
  const headers = Object.keys(rows[0] ?? {})

  const cells = rows.map(row => {
    const out: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(row)) {
      // Skip empties so blank cells stay truly blank; an "" in a numeric column breaks SUM
      if (value === null || value === undefined || value === '') continue
      out[key] = typeof value === 'string' && ISO_DATE.test(value)
        ? new Date(`${value}T00:00:00`)
        : value
    }
    return out
  })

  const worksheet = XLSX.utils.json_to_sheet(cells, { header: headers, cellDates: true })

  const range = XLSX.utils.decode_range(worksheet['!ref'] ?? 'A1')
  for (let r = range.s.r + 1; r <= range.e.r; r += 1) {
    for (let c = range.s.c; c <= range.e.c; c += 1) {
      const cell = worksheet[XLSX.utils.encode_cell({ r, c })]
      if (cell?.t === 'd') cell.z = 'yyyy-mm-dd'
    }
  }

  worksheet['!cols'] = headers.map(header => {
    const widest = rows.reduce((longest, row) => {
      const value = row[header]
      return Math.max(longest, value == null ? 0 : String(value).length)
    }, header.length)
    return { wch: Math.min(Math.max(widest + 2, 10), 40) }
  })
  worksheet['!autofilter'] = { ref: worksheet['!ref'] ?? 'A1' }

  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, worksheet, sheetName)
  XLSX.writeFile(workbook, filename)
}
