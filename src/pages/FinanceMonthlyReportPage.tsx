import { useEffect, useMemo, useState } from 'react'
import { client } from '../api'
import '../styles/contracts.css'
import { downloadExcel } from '../utils/exportExcel'

type MonthlyActualsReportRow = {
  softwareCode: string
  softwareName: string | null
  monthlyActuals: Record<string, number>
}

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
]

function fmtCurrency(value: number | null | undefined) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

export default function FinanceMonthlyReportPage() {
  const [year, setYear] = useState(new Date().getFullYear())
  const [rows, setRows] = useState<MonthlyActualsReportRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const yearOptions = useMemo(() => {
    const base = new Date().getFullYear()
    return [base - 1, base, base + 1]
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await client.get<MonthlyActualsReportRow[]>('/finance/view/monthly-report', {
          params: { year },
        })
        if (active) setRows(data)
      } catch {
        if (active) setError('Failed to load the monthly report.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [year])

  const totalsByMonth = useMemo(() => {
    return MONTH_NAMES.map((_, index) =>
      rows.reduce((sum, row) => sum + (row.monthlyActuals[String(index + 1)] ?? 0), 0))
  }, [rows])

  function exportReport() {
    downloadExcel(`finance-monthly-actuals-${year}.xlsx`, `${year}`, rows.map(row => {
      const out: Record<string, unknown> = {}
      out['Software Code'] = row.softwareCode
      out['Software Name'] = row.softwareName
      MONTH_NAMES.forEach((name, index) => {
        out[name] = row.monthlyActuals[String(index + 1)] ?? ''
      })
      return out
    }))
  }

  return (
    <div className="finance-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Finance — All Months</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[#6b6375]">
            Year
            <select
              value={year}
              onChange={event => setYear(Number(event.target.value))}
              className="h-8 px-2 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] bg-white cursor-pointer"
            >
              {yearOptions.map(option => <option key={option} value={option}>{option}</option>)}
            </select>
          </label>
          <button type="button" className="contracts-clear-button" onClick={exportReport}>Export Excel</button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="contracts-table-wrap">
        <table className="contracts-table">
          <thead>
            <tr>
              <th>Software Code</th>
              <th>Software Name</th>
              {MONTH_NAMES.map(name => <th key={name}>{name}</th>)}
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={2 + MONTH_NAMES.length}>Loading…</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={2 + MONTH_NAMES.length}>No finance rows found.</td></tr>
            ) : (
              rows.map(row => (
                <tr key={row.softwareCode}>
                  <td>{row.softwareCode}</td>
                  <td>{row.softwareName || '—'}</td>
                  {MONTH_NAMES.map((_, index) => (
                    <td key={index}>{fmtCurrency(row.monthlyActuals[String(index + 1)])}</td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {!loading && rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="font-semibold">Total</td>
                <td />
                {totalsByMonth.map((total, index) => (
                  <td key={index} className="font-semibold">{fmtCurrency(total)}</td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
