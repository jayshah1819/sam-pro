import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createPortal } from 'react-dom'
import { client } from '../api'
import type { InventoryRow } from '../types'
import '../styles/contracts.css'
import { downloadExcel } from '../utils/exportExcel'

type InventoryColumn = {
  key: keyof InventoryRow
  label: string
  money?: boolean
}

const COLUMNS: InventoryColumn[] = [
  { key: 'softwareCode', label: 'Software Code' },
  { key: 'softwareName', label: 'Software Name' },
  { key: 'companyGroup', label: 'Company Group' },
  { key: 'companyNameDivision', label: 'Company Name/Division' },
  { key: 'systemFunctionality', label: 'System Functionality' },
  { key: 'manufacturerName', label: 'Manufacturer Name' },
  { key: 'vendorName', label: 'Vendor Name' },
  { key: 'totalSoftwareSpend', label: 'Total Software Spend', money: true },
  { key: 'currency', label: 'Currency' },
  { key: 'comments', label: 'Comments' },
]

const FORM_KEYS = COLUMNS.map(column => column.key)
const EMPTY_FORM: Record<string, string> = Object.fromEntries(FORM_KEYS.map(key => [key, '']))

function fmtCurrency(value: number | null, currency: string | null) {
  if (value == null) return '—'
  try {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: currency || 'USD', maximumFractionDigits: 0 }).format(value)
  } catch {
    return new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(value)
  }
}

function extractErrorMessage(err: any, fallback: string): string {
  const data = err?.response?.data
  return typeof data?.message === 'string' ? data.message : fallback
}

export default function InventoryPage() {
  const [rows, setRows] = useState<InventoryRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [form, setForm] = useState<Record<string, string>>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const { data } = await client.get<InventoryRow[]>('/inventory')
        if (active) setRows(data)
      } catch {
        if (active) setError('Failed to load inventory data.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return rows
    return rows.filter(row =>
      row.softwareCode.toLowerCase().includes(term) ||
      (row.softwareName ?? '').toLowerCase().includes(term) ||
      (row.vendorName ?? '').toLowerCase().includes(term) ||
      (row.manufacturerName ?? '').toLowerCase().includes(term))
  }, [rows, search])

  function openAddModal() {
    setEditingId(null)
    setForm(EMPTY_FORM)
    setFormError(null)
    setModalOpen(true)
  }

  function openEditModal(row: InventoryRow) {
    setEditingId(row.id)
    setForm({
      softwareCode: row.softwareCode,
      softwareName: row.softwareName ?? '',
      companyGroup: row.companyGroup ?? '',
      companyNameDivision: row.companyNameDivision ?? '',
      systemFunctionality: row.systemFunctionality ?? '',
      manufacturerName: row.manufacturerName ?? '',
      vendorName: row.vendorName ?? '',
      totalSoftwareSpend: row.totalSoftwareSpend != null ? String(row.totalSoftwareSpend) : '',
      currency: row.currency ?? '',
      comments: row.comments ?? '',
    })
    setFormError(null)
    setModalOpen(true)
  }

  function updateField(key: string, value: string) {
    setForm(previous => ({ ...previous, [key]: value }))
  }

  async function submitForm(event: FormEvent) {
    event.preventDefault()
    setFormError(null)
    if (!form.softwareCode.trim()) {
      setFormError('Software Code is required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        softwareCode: form.softwareCode.trim(),
        softwareName: form.softwareName || null,
        companyGroup: form.companyGroup || null,
        companyNameDivision: form.companyNameDivision || null,
        systemFunctionality: form.systemFunctionality || null,
        manufacturerName: form.manufacturerName || null,
        vendorName: form.vendorName || null,
        totalSoftwareSpend: form.totalSoftwareSpend.trim() !== '' ? Number(form.totalSoftwareSpend) : null,
        currency: form.currency || null,
        comments: form.comments || null,
      }
      const { data } = editingId != null
        ? await client.put<InventoryRow>(`/inventory/${editingId}`, payload)
        : await client.post<InventoryRow>('/inventory', payload)
      setRows(previous => editingId != null
        ? previous.map(row => (row.id === data.id ? data : row))
        : [...previous, data])
      setModalOpen(false)
    } catch (err) {
      setFormError(extractErrorMessage(err, 'Failed to save inventory row.'))
    } finally {
      setSaving(false)
    }
  }

  async function deleteRow(row: InventoryRow) {
    if (!confirm(`Delete inventory row for ${row.softwareCode}?`)) return
    try {
      await client.delete(`/inventory/${row.id}`)
      setRows(previous => previous.filter(item => item.id !== row.id))
    } catch (err) {
      setError(extractErrorMessage(err, 'Failed to delete inventory row.'))
    }
  }

  function exportInventory() {
    downloadExcel('inventory.xlsx', 'Inventory', filteredRows.map(row => {
      const out: Record<string, unknown> = {}
      for (const column of COLUMNS) out[column.label] = row[column.key]
      return out
    }))
  }

  return (
    <div className="finance-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Finance — Inventory</h1>
        <button type="button" className="contracts-clear-button" onClick={exportInventory}>Export Excel</button>
      </div>

      <div className="contracts-toolbar flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search software code, name, vendor, or manufacturer"
          className="h-8 min-w-80 px-3 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#2b5a63]"
        />
        <button type="button" className="contracts-add-button" onClick={openAddModal}>
          + Add inventory
        </button>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="contracts-table-wrap">
        <table className="contracts-table">
          <thead>
            <tr>
              {COLUMNS.map(column => <th key={column.key}>{column.label}</th>)}
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan={COLUMNS.length + 1}>Loading…</td></tr>
            ) : filteredRows.length === 0 ? (
              <tr><td colSpan={COLUMNS.length + 1}>No inventory rows found.</td></tr>
            ) : (
              filteredRows.map(row => (
                <tr key={row.id}>
                  {COLUMNS.map(column => (
                    <td key={column.key}>
                      {column.money ? fmtCurrency(row[column.key] as number | null, row.currency) : (row[column.key] ?? '—')}
                    </td>
                  ))}
                  <td>
                    <button type="button" className="contracts-clear-button" onClick={() => openEditModal(row)}>
                      Edit
                    </button>{' '}
                    <button type="button" className="contracts-clear-button" onClick={() => deleteRow(row)}>
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {modalOpen && createPortal(
        <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setModalOpen(false) }}>
          <div className="contracts-modal" role="dialog" aria-modal="true" aria-labelledby="inventory-modal-title">
            <div className="contracts-modal-head">
              <div>
                <h2 id="inventory-modal-title">{editingId != null ? 'Edit inventory row' : 'Add inventory row'}</h2>
                <p className="contracts-modal-subtitle">Software Code links this row to its Finance entry.</p>
              </div>
              <button type="button" className="contracts-modal-close" onClick={() => setModalOpen(false)} aria-label="Close">×</button>
            </div>
            <form onSubmit={submitForm}>
              <div className="contracts-modal-body">
                <section className="contracts-field-section">
                  <div className="contracts-field-grid">
                    <label className="contracts-field">
                      <span>Software Code</span>
                      <input required value={form.softwareCode} onChange={event => updateField('softwareCode', event.target.value)} placeholder="e.g. SW-1042" />
                    </label>
                    <label className="contracts-field">
                      <span>Software Name</span>
                      <input value={form.softwareName} onChange={event => updateField('softwareName', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Company Group</span>
                      <input value={form.companyGroup} onChange={event => updateField('companyGroup', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Company Name/Division</span>
                      <input value={form.companyNameDivision} onChange={event => updateField('companyNameDivision', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>System Functionality</span>
                      <input value={form.systemFunctionality} onChange={event => updateField('systemFunctionality', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Manufacturer Name</span>
                      <input value={form.manufacturerName} onChange={event => updateField('manufacturerName', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Vendor Name</span>
                      <input value={form.vendorName} onChange={event => updateField('vendorName', event.target.value)} />
                    </label>
                    <label className="contracts-field">
                      <span>Total Software Spend</span>
                      <input type="number" step="0.01" value={form.totalSoftwareSpend} onChange={event => updateField('totalSoftwareSpend', event.target.value)} />
                      <p className="contracts-field-hint">Auto-updated from Finance's monthly Software Spend rollover.</p>
                    </label>
                    <label className="contracts-field">
                      <span>Currency</span>
                      <input value={form.currency} onChange={event => updateField('currency', event.target.value)} placeholder="USD" />
                    </label>
                    <label className="contracts-field">
                      <span>Comments</span>
                      <input value={form.comments} onChange={event => updateField('comments', event.target.value)} />
                    </label>
                  </div>
                </section>
              </div>

              <div className="contracts-modal-footer">
                {formError && <p className="contracts-modal-error">{formError}</p>}
                <div className="contracts-modal-footer-actions">
                  <button type="button" className="contracts-clear-button" onClick={() => setModalOpen(false)}>Cancel</button>
                  <button type="submit" className="contracts-modal-submit" disabled={saving}>
                    {saving ? 'Saving…' : 'Save inventory row'}
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
