import { useState } from 'react'
import type { Contract } from '../types'
import { updateContractDepartment } from '../utils/departments'

type Props = {
  contract: Contract | null | undefined
  onSaved: (updated: Contract) => void
}

// Inline-editable department badge. Department lives on the contract record,
// so saving here updates the contract directly — every other tab (Contracts,
// Licenses, Vendors, Departments) reads the same contract and stays in sync.
export default function DepartmentCell({ contract, onSaved }: Props) {
  const [editing, setEditing] = useState(false)
  const [value, setValue] = useState(contract?.location ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (!contract) return <span className="dept-cell-empty">—</span>

  async function save() {
    if (!contract) return
    if (value.trim() === (contract.location ?? '').trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      const updated = await updateContractDepartment(contract, value)
      onSaved(updated)
      setEditing(false)
    } catch {
      setError('Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!editing) {
    return (
      <button
        type="button"
        className="dept-cell-view"
        onClick={event => { event.stopPropagation(); setValue(contract.location ?? ''); setEditing(true) }}
        title="Click to edit department"
      >
        {contract.location || '—'}
      </button>
    )
  }

  return (
    <span className="dept-cell-edit" onClick={event => event.stopPropagation()}>
      <input
        autoFocus
        value={value}
        disabled={saving}
        onChange={e => setValue(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter') void save()
          if (e.key === 'Escape') { setEditing(false); setError(null) }
        }}
        onBlur={() => void save()}
        placeholder="Department"
      />
      {error && <span className="dept-cell-error">{error}</span>}
    </span>
  )
}
