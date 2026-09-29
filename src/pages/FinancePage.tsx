import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { client } from '../api'
import type { FinanceCategory, FinanceRow, FinanceViewOptions } from '../types'
import '../styles/contracts.css'
import { downloadExcel } from '../utils/exportExcel'

type DetailColumn = {
  key: keyof FinanceRow
  label: string
  money?: boolean
}

const DETAIL_COLUMNS: DetailColumn[] = [
  { key: 'softwareCode', label: 'Software Code' },
  { key: 'softwareName', label: 'Software Name' },
  { key: 'subCategory', label: 'Sub-Category' },
  { key: 'businessCriticality', label: 'Criticality' },
  { key: 'strategy', label: 'Strategy' },
  { key: 'sourceBudget', label: 'Source Budget' },
  { key: 'erp', label: 'ERP' },
  { key: 'costCode', label: 'Cost Code' },
  { key: 'location', label: 'Location' },
  { key: 'vendorId', label: 'Vendor ID' },
  { key: 'baselineBudget', label: 'Baseline Budget', money: true },
  { key: 'softwareSpend', label: 'Software Spend', money: true },
  { key: 'actuals', label: 'Actuals', money: true },
  { key: 'remaining', label: 'Remaining', money: true },
  { key: 'managedServiceProviders', label: 'Managed Service Providers', money: true },
  { key: 'itStaffInternalLabour', label: 'IT Staff Internal Labour', money: true },
  { key: 'itStaffExternalLabour', label: 'IT Staff External Labour', money: true },
  { key: 'depreciationAmortisation', label: 'Depreciation & Amortisation', money: true },
  { key: 'cloudSolutions', label: 'Cloud Solutions', money: true },
  { key: 'consultingOutsideServices', label: 'Consulting (Outside Services)', money: true },
  { key: 'totalTco', label: 'TOTAL TCO', money: true },
  { key: 'costRecoveries', label: 'Cost Recoveries', money: true },
]

type FormField = keyof FinanceRow
const FORM_KEYS: FormField[] = [
  'softwareCode', 'softwareName', 'primaryCategory', 'subCategory', 'businessCriticality', 'strategy',
  'sourceBudget', 'erp', 'costCode', 'location', 'vendorId',
  'baselineBudget', 'softwareSpend', 'actuals', 'remaining', 'managedServiceProviders',
  'itStaffInternalLabour', 'itStaffExternalLabour', 'depreciationAmortisation', 'cloudSolutions',
  'consultingOutsideServices', 'totalTco', 'costRecoveries',
]
const NUMBER_FIELDS = new Set<FormField>([
  'vendorId', 'baselineBudget', 'softwareSpend', 'actuals', 'remaining', 'managedServiceProviders',
  'itStaffInternalLabour', 'itStaffExternalLabour', 'depreciationAmortisation', 'cloudSolutions',
  'consultingOutsideServices', 'totalTco', 'costRecoveries',
])
const EMPTY_FORM: Record<string, string> = Object.fromEntries(FORM_KEYS.map(key => [key, '']))
const UNCATEGORIZED = 'Uncategorized'

function fmtCurrency(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data
  return typeof data?.message === 'string' ? data.message : fallback
}

function criticalityPillClass(value: string | null) {
  if (value === 'Critical Business System') return 'pill-negative'
  if (value === 'Important Business System') return 'pill-caution'
  if (value === 'Non-Critical Business System') return 'pill-positive'
  return 'pill-neutral'
}

function strategyPillClass(value: string | null) {
  if (value === 'Invest' || value === 'Innovate' || value === 'Sustain') return 'pill-positive'
  if (value === 'Tolerate' || value === 'Replace') return 'pill-caution'
  if (value === 'Decommission') return 'pill-negative'
  return 'pill-neutral'
}

const FLAT_COLUMNS: DetailColumn[] = [
  { key: 'primaryCategory', label: 'Primary Category' },
  ...DETAIL_COLUMNS.filter(column => column.key !== 'primaryCategory'),
]

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]

export default function FinancePage() {
  const tab = useLocation().pathname.endsWith('/detailed') ? 'detailed' : 'summary'
  const now = new Date()
  const [selectedYear, setSelectedYear] = useState(now.getFullYear())
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1)
  const yearOptions = useMemo(() => {
    const base = now.getFullYear()
    return [base - 1, base, base + 1]
  }, [])
  const [rows, setRows] = useState<FinanceRow[]>([])
  const [categories, setCategories] = useState<FinanceCategory[]>([])
  const [options, setOptions] = useState<FinanceViewOptions>({ businessCriticality: [], strategy: [] })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [actualsRow, setActualsRow] = useState<FinanceRow | null>(null)
  const [actualsAmount, setActualsAmount] = useState('')
  const [actualsSaving, setActualsSaving] = useState(false)
  const [actualsError, setActualsError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [{ data: categoryData }, { data: optionData }] = await Promise.all([
          client.get<FinanceCategory[]>('/finance/categories'),
          client.get<FinanceViewOptions>('/finance/view/options'),
        ])
        if (!active) return
        setCategories(categoryData)
        setOptions(optionData)
      } catch {
        if (active) setError('Failed to load finance data.')
      }
    }
    void load()
    return () => { active = false }
  }, [])

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await client.get<FinanceRow[]>('/finance/view', {
          params: { year: selectedYear, month: selectedMonth },
        })
        if (active) setRows(data)
      } catch {
        if (active) setError('Failed to load finance data.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [selectedYear, selectedMonth])

  const primaryCategories = useMemo(
    () => Array.from(new Set(categories.map(category => category.primaryCategory))),
    [categories],
  )
  const subCategoryOptions = useMemo(
    () => categories.filter(category => category.primaryCategory === form.primaryCategory),
    [categories, form.primaryCategory],
  )

  const filteredRows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return rows
    return rows.filter(row =>
      `${row.softwareCode} ${row.softwareName ?? ''} ${row.primaryCategory ?? ''} ${row.subCategory ?? ''} ${row.erp ?? ''} ${row.costCode ?? ''} ${row.location ?? ''}`
        .toLowerCase()
        .includes(needle),
    )
  }, [rows, search])

  const totals = useMemo(() => {
    const sum = (key: keyof FinanceRow) => filteredRows.reduce((acc, row) => acc + (Number(row[key]) || 0), 0)
    return {
      count: filteredRows.length,
      totalTco: sum('totalTco'),
      softwareSpend: sum('softwareSpend'),
      actuals: sum('actuals'),
      remaining: sum('remaining'),
    }
  }, [filteredRows])

  // Actuals recorded this month become next month's Software Spend, so this
  // month's Actuals total is exactly the predicted spend for next month.
  const nextMonthLabel = useMemo(() => {
    const nextMonth = selectedMonth === 12 ? 1 : selectedMonth + 1
    const nextYear = selectedMonth === 12 ? selectedYear + 1 : selectedYear
    return `${MONTH_NAMES[nextMonth - 1]} ${nextYear}`
  }, [selectedMonth, selectedYear])

  const groups = useMemo(() => {
    const byCategory = new Map<string, FinanceRow[]>()
    for (const row of filteredRows) {
      const key = row.primaryCategory || UNCATEGORIZED
      const list = byCategory.get(key) ?? []
      list.push(row)
      byCategory.set(key, list)
    }
    return Array.from(byCategory, ([category, items]) => ({
      category,
      items: items.sort((a, b) => a.softwareCode.localeCompare(b.softwareCode)),
      totalTco: items.reduce((acc, row) => acc + (row.totalTco ?? 0), 0),
    })).sort((a, b) => b.totalTco - a.totalTco || a.category.localeCompare(b.category))
  }, [filteredRows])

  const flatRows = useMemo(
    () => [...filteredRows].sort((a, b) =>
      a.softwareCode.localeCompare(b.softwareCode) || (a.costCode ?? '').localeCompare(b.costCode ?? '')),
    [filteredRows],
  )

  function updateField(key: string, value: string) {
    setForm(previous => {
      const next = { ...previous, [key]: value }
      if (key === 'primaryCategory') next.subCategory = ''
      // Remaining is derived automatically: Baseline Budget minus Actuals spent so far.
      if (key === 'baselineBudget' || key === 'actuals') {
        const baseline = Number(next.baselineBudget)
        const actuals = Number(next.actuals)
        next.remaining = next.baselineBudget.trim() !== '' && next.actuals.trim() !== ''
          && !Number.isNaN(baseline) && !Number.isNaN(actuals)
          ? String(baseline - actuals)
          : ''
      }
      return next
    })
  }

  async function openMonthlyActual(row: FinanceRow) {
    setActualsRow(row)
    setActualsAmount('')
    setActualsError(null)
    try {
      const { data } = await client.get<number | null>(
        `/finance/view/${encodeURIComponent(row.softwareCode)}/actuals`,
        { params: { year: selectedYear, month: selectedMonth } },
      )
      setActualsAmount(data == null ? '' : String(data))
    } catch {
      // Leave the field blank if the lookup fails; submitting will still overwrite it.
    }
  }

  async function submitMonthlyActual(event: FormEvent) {
    event.preventDefault()
    if (!actualsRow) return
    const amount = Number(actualsAmount)
    if (!actualsAmount.trim() || Number.isNaN(amount) || amount < 0) {
      setActualsError('Enter a zero or positive amount')
      return
    }
    setActualsSaving(true)
    setActualsError(null)
    try {
      const { data } = await client.post<FinanceRow>(
        `/finance/view/${encodeURIComponent(actualsRow.softwareCode)}/actuals`,
        { year: selectedYear, month: selectedMonth, amount })
      setRows(previous => previous.map(row => (row.id === data.id ? data : row)))
      setActualsRow(null)
      setActualsAmount('')
    } catch (err) {
      setActualsError(extractErrorMessage(err, 'Failed to record actual spend.'))
    } finally {
      setActualsSaving(false)
    }
  }

  function openEditRow(row: FinanceRow) {
    setFormError(null)
    setEditingId(row.id)
    setForm(Object.fromEntries(FORM_KEYS.map(key => {
      const value = row[key]
      return [key, value == null ? '' : String(value)]
    })))
    setModalOpen(true)
  }

  async function submitRow(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!form.softwareCode.trim()) {
      setFormError('Software Code is required')
      return
    }
    setSaving(true)
    try {
      const payload: Record<string, unknown> = {}
      for (const key of FORM_KEYS) {
        const raw = form[key]?.trim() ?? ''
        payload[key] = raw === '' ? null : (NUMBER_FIELDS.has(key) ? Number(raw) : raw)
      }
      const { data } = editingId != null
        ? await client.put<FinanceRow>(`/finance/view/${editingId}`, payload)
        : await client.post<FinanceRow>('/finance/view', payload)
      setRows(previous => editingId != null
        ? previous.map(row => (row.id === data.id ? data : row))
        : [...previous, data])
      setForm(EMPTY_FORM)
      setEditingId(null)
      setModalOpen(false)
    } catch (err) {
      setFormError(extractErrorMessage(err, editingId != null ? 'Failed to update finance row.' : 'Failed to add finance row.'))
    } finally {
      setSaving(false)
    }
  }

  function exportFinance() {
    downloadExcel('finance-detailed.xlsx', 'Detailed', filteredRows.map(row => {
      const out: Record<string, unknown> = {}
      out['Software Code'] = row.softwareCode
      out['Software Name'] = row.softwareName
      out['Primary Category'] = row.primaryCategory
      for (const column of DETAIL_COLUMNS) out[column.label] = row[column.key]
      return out
    }))
  }

  return (
    <div className="finance-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Finance</h1>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-[#6b6375]">
            Month
            <select
              value={selectedMonth}
              onChange={event => setSelectedMonth(Number(event.target.value))}
              className="h-8 px-2 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] bg-white cursor-pointer"
            >
              {MONTH_NAMES.map((name, index) => <option key={name} value={index + 1}>{name}</option>)}
            </select>
          </label>
          <select
            value={selectedYear}
            onChange={event => setSelectedYear(Number(event.target.value))}
            aria-label="Year"
            className="h-8 px-2 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] bg-white cursor-pointer"
          >
            {yearOptions.map(year => <option key={year} value={year}>{year}</option>)}
          </select>
          <button type="button" className="contracts-clear-button" onClick={exportFinance}>Export Excel</button>
          <span className="text-sm text-[#6b6375]">
            Total TCO: <span className="font-semibold text-[#08060d]">{fmtCurrency(totals.totalTco)}</span>
          </span>
        </div>
      </div>

      {tab === 'summary' && (
        <div className="dept-summary-cards">
          <div className="dept-summary-card"><small>Software</small><strong>{totals.count}</strong></div>
          <div className="dept-summary-card is-spend"><small>Total TCO</small><strong>{fmtCurrency(totals.totalTco)}</strong></div>
          <div className="dept-summary-card"><small>Software Spend</small><strong>{fmtCurrency(totals.softwareSpend)}</strong></div>
          <div className="dept-summary-card"><small>Actuals</small><strong>{fmtCurrency(totals.actuals)}</strong></div>
          <div className="dept-summary-card"><small>Remaining</small><strong>{fmtCurrency(totals.remaining)}</strong></div>
          <div className="dept-summary-card is-spend"><small>Predicted for {nextMonthLabel}</small><strong>{fmtCurrency(totals.actuals)}</strong></div>
        </div>
      )}

      <div className="contracts-toolbar flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search software code, name, category, ERP, cost code, or location"
          className="h-8 min-w-80 px-3 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#2b5a63]"
        />
        <button type="button" className="contracts-add-button" onClick={() => { setFormError(null); setEditingId(null); setForm(EMPTY_FORM); setModalOpen(true) }}>
          + Add software
        </button>
      </div>

      {modalOpen && createPortal(
        <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModalOpen(false) }}>
          <div className="contracts-modal finance-modal" role="dialog" aria-modal="true" aria-labelledby="finance-add-title">
            <div className="contracts-modal-head">
              <div>
                <h2 id="finance-add-title">{editingId != null ? 'Edit software' : 'Add software'}</h2>
                <p className="contracts-modal-subtitle">
                  {editingId != null ? 'Update this software\u2019s classification and financials.' : 'Software Code + Cost Code must be unique together.'}
                </p>
              </div>
              <button type="button" className="contracts-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={submitRow}>
              <div className="contracts-modal-body">
                <section className="contracts-field-section">
                  <h3 className="contracts-field-section-title">Identity &amp; classification</h3>
                  <div className="contracts-field-grid">
                    <label className="contracts-field">
                      <span>Software Code</span>
                      <input
                        required
                        value={form.softwareCode}
                        onChange={event => updateField('softwareCode', event.target.value)}
                        placeholder="e.g. SW-1042"
                        readOnly={Boolean(editingId)}
                        className={editingId != null ? 'contracts-field-readonly' : undefined}
                      />
                    </label>
                    <label className="contracts-field">
                      <span>Software Name</span>
                      <input value={form.softwareName} onChange={event => updateField('softwareName', event.target.value)} placeholder="Software name" />
                    </label>
                    <label className="contracts-field">
                      <span>Primary Category</span>
                      <select value={form.primaryCategory} onChange={event => updateField('primaryCategory', event.target.value)}>
                        <option value="">Select category</option>
                        {primaryCategories.map(primary => <option key={primary} value={primary}>{primary}</option>)}
                      </select>
                    </label>
                    <label className="contracts-field">
                      <span>Sub-Category</span>
                      <select value={form.subCategory} onChange={event => updateField('subCategory', event.target.value)} disabled={!form.primaryCategory}>
                        <option value="">Select sub-category</option>
                        {subCategoryOptions.map(sub => <option key={sub.id} value={sub.subCategory}>{sub.subCategory}</option>)}
                      </select>
                    </label>
                    <label className="contracts-field">
                      <span>Business Criticality</span>
                      <select value={form.businessCriticality} onChange={event => updateField('businessCriticality', event.target.value)}>
                        <option value="">Select criticality</option>
                        {options.businessCriticality.map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                    <label className="contracts-field">
                      <span>Strategy</span>
                      <select value={form.strategy} onChange={event => updateField('strategy', event.target.value)}>
                        <option value="">Select strategy</option>
                        {options.strategy.map(value => <option key={value} value={value}>{value}</option>)}
                      </select>
                    </label>
                  </div>
                </section>

                <section className="contracts-field-section">
                  <h3 className="contracts-field-section-title">Reference</h3>
                  <div className="contracts-field-grid contracts-field-grid-3">
                    <label className="contracts-field">
                      <span>Source Budget</span>
                      <input value={form.sourceBudget} onChange={event => updateField('sourceBudget', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>ERP</span>
                      <input value={form.erp} onChange={event => updateField('erp', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Cost Code</span>
                      <input value={form.costCode} onChange={event => updateField('costCode', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Location</span>
                      <input value={form.location} onChange={event => updateField('location', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Vendor ID</span>
                      <input type="number" value={form.vendorId} onChange={event => updateField('vendorId', event.target.value)} />
                    </label>
                  </div>
                </section>

                <section className="contracts-field-section">
                  <h3 className="contracts-field-section-title">Financials</h3>
                  <div className="contracts-field-grid contracts-field-grid-3">
                    {DETAIL_COLUMNS.filter(column => column.money && column.key !== 'remaining').map(column => (
                      <label className="contracts-field" key={column.key}>
                        <span>{column.label}</span>
                        <input type="number" step="0.01" value={form[column.key]} onChange={event => updateField(column.key, event.target.value)} />
                      </label>
                    ))}
                    <label className="contracts-field">
                      <span>Remaining</span>
                      <input
                        type="number"
                        value={form.remaining}
                        readOnly
                        className="contracts-field-readonly"
                      />
                      <p className="contracts-field-hint">Auto-calculated: Baseline Budget − Actuals</p>
                    </label>
                  </div>
                </section>
              </div>

              <div className="contracts-modal-footer">
                {formError && <p className="contracts-modal-error">{formError}</p>}
                <div className="contracts-modal-footer-actions">
                  <button type="button" className="contracts-clear-button" onClick={() => setModalOpen(false)}>Cancel</button>
                  <button type="submit" className="contracts-modal-submit" disabled={saving}>
                    {saving ? 'Saving…' : editingId != null ? 'Save changes' : 'Save software'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}

      {loading && <p className="text-sm text-[#6b6375]">Loading finance data…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && filteredRows.length === 0 && (
        <div className="contracts-panel px-6 py-12 text-center text-sm text-[#6b6375]">No finance entries yet.</div>
      )}

      {!loading && !error && tab === 'summary' && (
        <div className="contracts-panel px-4 py-4 flex flex-wrap gap-2">
          {groups.map(group => (
            <span key={group.category} className="status-pill">{group.category} · {group.items.length}</span>
          ))}
        </div>
      )}

      {!loading && !error && tab === 'detailed' && filteredRows.length > 0 && (
        <div className="contracts-panel contracts-table-wrap">
          <table className="contracts-table">
            <thead>
              <tr>{FLAT_COLUMNS.map(column => <th key={column.key}>{column.label}</th>)}<th className="finance-actions-col">Actions</th></tr>
            </thead>
            <tbody>
              {flatRows.map(row => (
                <tr key={row.id} className="contract-row">
                  {FLAT_COLUMNS.map(column => {
                    if (column.key === 'businessCriticality' || column.key === 'strategy') {
                      const value = row[column.key] as string | null
                      const pillClass = column.key === 'businessCriticality' ? criticalityPillClass(value) : strategyPillClass(value)
                      return <td key={column.key}>{value ? <span className={`status-pill ${pillClass}`}>{value}</span> : '—'}</td>
                    }
                    const value = row[column.key]
                    const display = column.money ? fmtCurrency(value as number | null) : (value ?? '—')
                    return <td key={column.key}>{String(display)}</td>
                  })}
                  <td className="finance-row-actions">
                    <button type="button" className="contracts-clear-button" onClick={() => openEditRow(row)}>
                      Edit
                    </button>
                    <button type="button" className="contracts-clear-button" onClick={() => openMonthlyActual(row)}>
                      + Actual
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {actualsRow && createPortal(
        <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setActualsRow(null) }}>
          <div className="contracts-modal" role="dialog" aria-modal="true" aria-labelledby="finance-actual-title">
            <div className="contracts-modal-head">
              <div>
                <h2 id="finance-actual-title">Record monthly actual</h2>
                <p className="contracts-modal-subtitle">
                  {actualsRow.softwareName || actualsRow.softwareCode} — {MONTH_NAMES[selectedMonth - 1]} {selectedYear}.
                  This becomes that month's Actuals and updates Remaining automatically.
                </p>
              </div>
              <button type="button" className="contracts-modal-close" onClick={() => setActualsRow(null)}>×</button>
            </div>
            <form onSubmit={submitMonthlyActual}>
              <div className="contracts-modal-body">
                <label className="contracts-field">
                  <span>Amount spent this month</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    autoFocus
                    value={actualsAmount}
                    onChange={event => setActualsAmount(event.target.value)}
                  />
                </label>
              </div>
              <div className="contracts-modal-footer">
                {actualsError && <p className="contracts-modal-error">{actualsError}</p>}
                <div className="contracts-modal-footer-actions">
                  <button type="button" className="contracts-clear-button" onClick={() => setActualsRow(null)}>Cancel</button>
                  <button type="submit" className="contracts-modal-submit" disabled={actualsSaving}>
                    {actualsSaving ? 'Saving…' : 'Add actual'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>,
        document.body,
      )}
    </div>
  )
}
