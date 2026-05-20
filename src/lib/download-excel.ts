import writeExcelFile from 'write-excel-file/browser'

type ExcelRow = Record<string, string | number>

export function excelTimestamp() {
  const now = new Date()
  const pad = (n: number) => n.toString().padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

function buildColumns(rows: ExcelRow[], columnWidths?: number[]) {
  const keys = Object.keys(rows[0] ?? {})

  return keys.map((key, index) => ({
    header: key,
    width: columnWidths?.[index],
    cell: (row: ExcelRow) => {
      const value = row[key]
      if (typeof value === 'number') {
        return { value, type: Number }
      }
      return { value: String(value ?? '') }
    },
  }))
}

export async function downloadExcelFile(
  rows: ExcelRow[],
  options: {
    sheetName: string
    fileName: string
    columnWidths?: number[]
  }
) {
  if (rows.length === 0) return

  await writeExcelFile(rows, {
    sheet: options.sheetName,
    columns: buildColumns(rows, options.columnWidths),
  }).toFile(options.fileName)
}
