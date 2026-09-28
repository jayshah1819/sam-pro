import { useState } from 'react'

type Props = {
  value: string
  onSave: (value: string) => Promise<void>
}

// Inline-editable department badge. The caller decides what "value" is backed
// by (a contract's location, or a standalone license's own location) and how
// to persist it — this component just handles the click-to-edit interaction.
export default function DepartmentCell({ value, onSave }: Props) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(value)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    if (draft.trim() === value.trim()) {
      setEditing(false)
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSave(draft)
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
        onClick={event => { event.stopPropagation(); setDraft(value); setEditing(true) }}
        title="Click to edit department"
      >
        {value || '—'}
      </button>
    )
  }

  return (
    <span className="dept-cell-edit" onClick={event => event.stopPropagation()}>
      <input
        autoFocus
        value={draft}
        disabled={saving}
        onChange={e => setDraft(e.target.value)}
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
