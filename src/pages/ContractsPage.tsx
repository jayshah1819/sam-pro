import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { client } from '../api'
import type { AppData, Contract, ContractLicense, SpringPage, Vendor } from '../types'
import '../styles/contracts.css'
import { downloadExcel } from '../utils/exportExcel'

const PAGE_SIZE = 20

function fmtCurrency(v: number | null) {
  if (v == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v)
}

function statusBadge(status: Contract['status']) {
  const styles: Record<Contract['status'], string> = {
    ACTIVE:          'status-active',
    EXPIRED:         'status-expired',
    PENDING_RENEWAL: 'status-pending',
  }
  const labels: Record<Contract['status'], string> = {
    ACTIVE: 'Active', EXPIRED: 'Expired', PENDING_RENEWAL: 'Pending renewal',
  }
  return (
    <span className={`status-pill ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

type ContractForm = {
  contractNumber: string
  itOwner: string
  comments: string
  vendorName: string
  vendorJDENumber: string
  vendorContactEmail: string
  vendorWebsite: string
  department: string
  softwareName: string
  startDate: string
  endDate: string
  status: Contract['status']
  value: string
}

type LicenseForm = {
  licenseName: string
  itOwner: string
  comments: string
  softwareName: string
  version: string
  licenseType: ContractLicense['licenseType']
  status: ContractLicense['status']
  paymentMethod: ContractLicense['paymentMethod']
  startDate: string
  expiryDate: string
  seatsPurchased: string
  price: string
}

const EMPTY_FORM: ContractForm = {
  contractNumber: '',
  itOwner: '',
  comments: '',
  vendorName: '',
  vendorJDENumber: '',
  vendorContactEmail: '',
  vendorWebsite: '',
  department: '',
  softwareName: '',
  startDate: '',
  endDate: '',
  status: 'ACTIVE',
  value: '',
}

const EMPTY_LICENSE_FORM: LicenseForm = {
  licenseName: '',
  itOwner: '',
  comments: '',
  softwareName: '',
  version: '',
  licenseType: 'PER_SEAT',
  status: 'ACTIVE',
  paymentMethod: 'PURCHASE_ORDER',
  startDate: '',
  expiryDate: '',
  seatsPurchased: '',
  price: '',
}

export default function ContractsPage() {
  const [searchParams] = useSearchParams()
  const [page, setPage] = useState(0)
  const [data, setData] = useState<SpringPage<Contract> | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadTick, setReloadTick] = useState(0)
  const [search, setSearch] = useState('')

  const [saving, setSaving] = useState(false)
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [addingNewVendor, setAddingNewVendor] = useState(false)
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [addForm, setAddForm] = useState<ContractForm>(EMPTY_FORM)
  const [vendorOptions, setVendorOptions] = useState<Vendor[]>([])

  const [editingId, setEditingId] = useState<number | null>(null)
  const [editForm, setEditForm] = useState<ContractForm>(EMPTY_FORM)
  const [savingEdit, setSavingEdit] = useState(false)

  const [deletingId, setDeletingId] = useState<number | null>(null)
  const [openLicensesId, setOpenLicensesId] = useState<number | null>(null)
  const [licensesByContract, setLicensesByContract] = useState<Record<number, ContractLicense[]>>({})
  const [loadingLicensesId, setLoadingLicensesId] = useState<number | null>(null)
  const [licenseForm, setLicenseForm] = useState<LicenseForm>(EMPTY_LICENSE_FORM)
  const [savingLicense, setSavingLicense] = useState(false)
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null)
  const [deletingLicenseId, setDeletingLicenseId] = useState<number | null>(null)
  const [addLicenseOpenId, setAddLicenseOpenId] = useState<number | null>(null)

  function handleSearchChange(value: string) {
    setSearch(value)
    setPage(0)
  }

  useEffect(() => {
    setLoading(true)
    setError(null)
    client.get<SpringPage<Contract>>('/contracts', {
      params: { page, size: PAGE_SIZE, q: search.trim() || undefined },
    })
      .then(res => setData(res.data))
      .catch(() => setError('Failed to load contracts.'))
      .finally(() => setLoading(false))
  }, [page, reloadTick, search])

  useEffect(() => {
    client.get<SpringPage<Vendor>>('/vendors', { params: { page: 0, size: 500 } })
      .then(res => setVendorOptions(res.data.content ?? []))
      .catch(() => undefined)
  }, [reloadTick])

  useEffect(() => {
    const vendorId = Number(searchParams.get('vendorId'))
    if (!Number.isInteger(vendorId) || vendorOptions.length === 0) return
    const vendor = vendorOptions.find(option => option.vendorId === vendorId)
    if (!vendor) return
    setAddForm(form => ({
      ...form,
      vendorName: vendor.name,
      vendorJDENumber: vendor.vendorJDENumber ?? '',
    }))
    setAddingNewVendor(false)
    setAddModalOpen(true)
  }, [searchParams, vendorOptions])

  function findVendorOption(name: string) {
    const trimmed = name.trim().toLowerCase()
    if (!trimmed) return null
    return vendorOptions.find(v => v.name.toLowerCase() === trimmed) ?? null
  }

  function updateAddVendorName(name: string) {
    const vendor = findVendorOption(name)
    setAddForm(f => ({
      ...f,
      vendorName: name,
      vendorJDENumber: vendor?.vendorJDENumber ?? f.vendorJDENumber,
    }))
  }

  function updateEditVendorName(name: string) {
    const vendor = findVendorOption(name)
    setEditForm(f => ({
      ...f,
      vendorName: name,
      vendorJDENumber: vendor?.vendorJDENumber ?? f.vendorJDENumber,
    }))
  }

  async function handleCreateContract(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setSaving(true)
    setSaveError(null)
    try {
      const existingVendor = findVendorOption(addForm.vendorName)
      let vendorId = existingVendor?.vendorId
      if (vendorId == null) {
        const { data: createdVendor } = await client.post<Vendor>('/vendors', {
          name: addForm.vendorName.trim(),
          vendorJDENumber: addForm.vendorJDENumber.trim() || null,
          contactEmail: addForm.vendorContactEmail.trim() || null,
          website: addForm.vendorWebsite.trim() || null,
        })
        vendorId = createdVendor.vendorId ?? undefined
        if (vendorId == null) throw new Error('Vendor ID was not returned')
        setVendorOptions(prev => [createdVendor, ...prev])
      }
      await client.post('/contracts', {
        contractNumber: addForm.contractNumber.trim(),
        itOwner: addForm.itOwner.trim() || null,
        comments: addForm.comments.trim() || null,
        vendorId,
        department: addForm.department.trim() || null,
        softwareName: addForm.softwareName.trim() || null,
        startDate: addForm.startDate,
        endDate: addForm.endDate,
        status: addForm.status,
        value: addForm.value.trim() ? Number(addForm.value) : null,
      })
      setAddForm(EMPTY_FORM)
      setAddingNewVendor(false)
      setVendorPickerOpen(false)
      setAddModalOpen(false)
      setPage(0)
      setReloadTick(t => t + 1)
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to save contract.')
    } finally {
      setSaving(false)
    }
  }

  function startEdit(c: Contract) {
    setEditingId(c.id)
    setEditForm({
      contractNumber: c.contractNumber,
      itOwner: c.itOwner ?? '',
      comments: c.comments ?? '',
      vendorName: c.vendorName ?? c.vendor.name,
      vendorJDENumber: c.vendorJDENumber ?? c.vendor.vendorJDENumber ?? '',
      vendorContactEmail: '',
      vendorWebsite: '',
      department: c.department ?? '',
      softwareName: c.softwareName ?? '',
      startDate: c.startDate,
      endDate: c.endDate,
      status: c.status,
      value: c.value == null ? '' : String(c.value),
    })
    setSaveError(null)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditForm(EMPTY_FORM)
  }

  async function saveEdit(id: number) {
    setSavingEdit(true)
    setSaveError(null)
    try {
      const vendorId = findVendorOption(editForm.vendorName)?.vendorId
      if (vendorId == null) throw new Error('Choose an existing vendor before updating the contract')
      await client.put(`/contracts/${id}`, {
        contractNumber: editForm.contractNumber.trim(),
        itOwner: editForm.itOwner.trim() || null,
        comments: editForm.comments.trim() || null,
        vendorId,
        department: editForm.department.trim() || null,
        softwareName: editForm.softwareName.trim() || null,
        startDate: editForm.startDate,
        endDate: editForm.endDate,
        status: editForm.status,
        value: editForm.value.trim() ? Number(editForm.value) : null,
      })
      cancelEdit()
      setReloadTick(t => t + 1)
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to update contract.')
    } finally {
      setSavingEdit(false)
    }
  }

  async function deleteContract(id: number) {
    if (!window.confirm('Delete this contract and its licenses?')) return
    setDeletingId(id)
    setSaveError(null)
    try {
      await client.delete(`/contracts/${id}`)
      setReloadTick(t => t + 1)
    } catch {
      setSaveError('Failed to delete contract.')
    } finally {
      setDeletingId(null)
    }
  }

  async function loadLicenses(contractId: number) {
    setLoadingLicensesId(contractId)
    try {
      const { data } = await client.get<ContractLicense[]>(`/contracts/${contractId}/licenses`)
      setLicensesByContract(prev => ({ ...prev, [contractId]: data }))
    } catch {
      setSaveError('Failed to load licenses.')
    } finally {
      setLoadingLicensesId(null)
    }
  }

  async function toggleLicenses(contract: Contract) {
    if (openLicensesId === contract.id) {
      setOpenLicensesId(null)
      return
    }

    setOpenLicensesId(contract.id)
    setAddLicenseOpenId(null)
    setLicenseForm({ ...EMPTY_LICENSE_FORM, softwareName: contract.softwareName ?? '' })
    if (!licensesByContract[contract.id]) {
      await loadLicenses(contract.id)
    }
  }

  async function addLicense(contractId: number) {
    setSavingLicense(true)
    setSaveError(null)
    try {
      const { data } = await client.post<ContractLicense>(`/contracts/${contractId}/licenses`, {
        licenseName: licenseForm.licenseName.trim(),
        itOwner: licenseForm.itOwner.trim() || null,
        comments: licenseForm.comments.trim() || null,
        softwareName: licenseForm.softwareName.trim(),
        version: licenseForm.version.trim() || null,
        licenseType: licenseForm.licenseType,
        status: licenseForm.status,
        paymentMethod: licenseForm.paymentMethod,
        startDate: licenseForm.startDate || null,
        expiryDate: licenseForm.expiryDate || null,
        seatsPurchased: licenseForm.seatsPurchased.trim() ? Number(licenseForm.seatsPurchased) : null,
        price: licenseForm.price.trim() ? Number(licenseForm.price) : null,
      })
      setLicensesByContract(prev => ({
        ...prev,
        [contractId]: [...(prev[contractId] ?? []), data],
      }))
      setLicenseForm(EMPTY_LICENSE_FORM)
      setAddLicenseOpenId(null)
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to add license.')
    } finally {
      setSavingLicense(false)
    }
  }

  function startEditLicense(license: ContractLicense) {
    setEditingLicenseId(license.licenseId)
    setLicenseForm({
      licenseName: license.licenseName,
      itOwner: license.itOwner ?? '',
      comments: license.comments ?? '',
      softwareName: license.softwareName,
      version: license.version === 'default' ? '' : license.version,
      licenseType: license.licenseType,
      status: license.status,
      paymentMethod: license.paymentMethod,
      startDate: license.startDate,
      expiryDate: license.expiryDate,
      seatsPurchased: license.seatsPurchased == null ? '' : String(license.seatsPurchased),
      price: license.price == null ? '' : String(license.price),
    })
    setSaveError(null)
  }

  function cancelEditLicense() {
    setEditingLicenseId(null)
    setLicenseForm(EMPTY_LICENSE_FORM)
    setAddLicenseOpenId(null)
  }

  async function saveLicense(contractId: number) {
    if (editingLicenseId == null) {
      await addLicense(contractId)
      return
    }
    setSavingLicense(true)
    setSaveError(null)
    try {
      const { data } = await client.put<ContractLicense>(`/contracts/${contractId}/licenses/${editingLicenseId}`, {
        licenseName: licenseForm.licenseName.trim(),
        itOwner: licenseForm.itOwner.trim() || null,
        comments: licenseForm.comments.trim() || null,
        softwareName: licenseForm.softwareName.trim(),
        version: licenseForm.version.trim() || null,
        licenseType: licenseForm.licenseType,
        status: licenseForm.status,
        paymentMethod: licenseForm.paymentMethod,
        startDate: licenseForm.startDate || null,
        expiryDate: licenseForm.expiryDate || null,
        seatsPurchased: licenseForm.seatsPurchased.trim() ? Number(licenseForm.seatsPurchased) : null,
        price: licenseForm.price.trim() ? Number(licenseForm.price) : null,
      })
      setLicensesByContract(prev => ({
        ...prev,
        [contractId]: (prev[contractId] ?? []).map(license => license.licenseId === editingLicenseId ? data : license),
      }))
      cancelEditLicense()
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to update license.')
    } finally {
      setSavingLicense(false)
    }
  }

  async function deleteLicense(contractId: number, licenseId: number) {
    if (!window.confirm('Delete this license?')) return
    setDeletingLicenseId(licenseId)
    setSaveError(null)
    try {
      await client.delete(`/contracts/${contractId}/licenses/${licenseId}`)
      setLicensesByContract(prev => ({
        ...prev,
        [contractId]: (prev[contractId] ?? []).filter(license => license.licenseId !== licenseId),
      }))
      if (editingLicenseId === licenseId) cancelEditLicense()
    } catch {
      setSaveError('Failed to delete license.')
    } finally {
      setDeletingLicenseId(null)
    }
  }

  const contracts = data?.content ?? []
  const visibleContracts = useMemo(() => {
    return [...contracts].sort((a, b) => b.id - a.id)
  }, [contracts])

  const total = visibleContracts.reduce((sum, c) => sum + (c.value ?? 0), 0)

  async function exportContracts() {
    const { data: all } = await client.get<AppData>('/app-data')
    downloadExcel('contracts.xlsx', 'Contracts', all.contracts.map(contract => ({
      'Contract #': contract.contractNumber,
      Vendor: contract.vendorName ?? contract.vendor?.name ?? '',
      'Vendor JDE': contract.vendorJDENumber ?? contract.vendor?.vendorJDENumber ?? '',
      'IT owner': contract.itOwner ?? '',
      Department: contract.department ?? '',
      Software: contract.softwareName ?? '',
      Start: contract.startDate,
      End: contract.endDate,
      Value: contract.value ?? '',
      Status: contract.status,
    })))
  }

  function licenseTotal(contractId: number) {
    return (licensesByContract[contractId] ?? []).reduce((sum, license) => sum + (license.price ?? 0), 0)
  }

  return (
    <div className="contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Contracts</h1>
        <div className="flex items-center gap-3"><button type="button" className="contracts-clear-button" onClick={() => void exportContracts()}>Export Excel</button><span className="text-sm text-[#6b6375]">
          Page total: <span className="font-semibold text-[#08060d]">{fmtCurrency(total)}</span>
        </span></div>
      </div>

      <div className="contracts-toolbar flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <input
            value={search}
            onChange={e => handleSearchChange(e.target.value)}
            placeholder="Search contracts, licenses, software, or JDE"
            className="h-8 min-w-72 px-3 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
          />
          <button type="button" className="contracts-add-button" onClick={() => { setSaveError(null); setAddModalOpen(true) }}>
            + Add contract
          </button>
          {addModalOpen && (
            <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddModalOpen(false) }}>
              <div className="contracts-modal" role="dialog" aria-modal="true" aria-labelledby="add-contract-title">
                <div className="contracts-modal-head">
                  <h2 id="add-contract-title">Add contract</h2>
                  <button type="button" className="contracts-modal-close" onClick={() => setAddModalOpen(false)} aria-label="Close">×</button>
                </div>
                <div className="contracts-modal-body">
            <form onSubmit={handleCreateContract} className="contracts-modal-form grid gap-2 md:grid-cols-3">
              <input
                value={addForm.contractNumber}
                onChange={e => setAddForm(f => ({ ...f, contractNumber: e.target.value }))}
                required
                placeholder="Contract number"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <div className="vendor-picker">
                <input
                  value={addForm.vendorName}
                  onChange={event => {
                    setAddingNewVendor(false)
                    setAddForm(f => ({ ...f, vendorName: event.target.value }))
                    setVendorPickerOpen(true)
                  }}
                  onFocus={() => setVendorPickerOpen(true)}
                  onBlur={() => window.setTimeout(() => setVendorPickerOpen(false), 120)}
                  required
                  placeholder="Search or choose vendor"
                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#2b5a63]"
                />
                {vendorPickerOpen && !addingNewVendor && (
                  <div className="vendor-picker-menu">
                    {vendorOptions
                      .filter(vendor => vendor.name.toLowerCase().includes(addForm.vendorName.trim().toLowerCase()))
                      .slice(0, 12)
                      .map(vendor => (
                        <button
                          type="button"
                          key={vendor.vendorId ?? vendor.name}
                          className="vendor-picker-option"
                          onMouseDown={event => event.preventDefault()}
                          onClick={() => {
                            updateAddVendorName(vendor.name)
                            setAddingNewVendor(false)
                            setVendorPickerOpen(false)
                          }}
                        >
                          <span>{vendor.name}</span>
                          <small>{vendor.vendorId != null ? `vendor_id ${vendor.vendorId}` : ''}</small>
                        </button>
                      ))}
                    <button
                      type="button"
                      className="vendor-picker-new"
                      onMouseDown={event => event.preventDefault()}
                      onClick={() => {
                        setAddingNewVendor(true)
                        setVendorPickerOpen(false)
                        setAddForm(f => ({ ...f, vendorName: '', vendorJDENumber: '', vendorContactEmail: '', vendorWebsite: '' }))
                      }}
                    >
                      + Create new vendor
                    </button>
                  </div>
                )}
              </div>
              {addingNewVendor && (
                <>
                  <input
                    value={addForm.vendorName}
                    onChange={e => setAddForm(f => ({ ...f, vendorName: e.target.value }))}
                    required
                    placeholder="New vendor name"
                    className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                  />
                  <input
                    type="email"
                    value={addForm.vendorContactEmail}
                    onChange={e => setAddForm(f => ({ ...f, vendorContactEmail: e.target.value }))}
                    placeholder="Vendor contact email (optional)"
                    className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                  />
                  <input
                    type="url"
                    value={addForm.vendorWebsite}
                    onChange={e => setAddForm(f => ({ ...f, vendorWebsite: e.target.value }))}
                    placeholder="Vendor website (optional)"
                    className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                  />
                </>
              )}
              <input
                value={addForm.vendorJDENumber}
                onChange={e => setAddForm(f => ({ ...f, vendorJDENumber: e.target.value }))}
                placeholder="Vendor JDE number"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <input
                value={addForm.department}
                onChange={e => setAddForm(f => ({ ...f, department: e.target.value }))}
                placeholder="Department (optional)"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <input value={addForm.itOwner} onChange={e => setAddForm(f => ({ ...f, itOwner: e.target.value }))} placeholder="IT owner (optional)" className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]" />
              <input
                value={addForm.softwareName}
                onChange={e => setAddForm(f => ({ ...f, softwareName: e.target.value }))}
                placeholder="Software name (optional)"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <select
                value={addForm.status}
                onChange={e => setAddForm(f => ({ ...f, status: e.target.value as Contract['status'] }))}
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] bg-white outline-none focus:border-[#aa3bff]"
              >
                <option value="ACTIVE">Active</option>
                <option value="PENDING_RENEWAL">Pending renewal</option>
                <option value="EXPIRED">Expired</option>
              </select>
              <input
                type="date"
                value={addForm.startDate}
                onChange={e => setAddForm(f => ({ ...f, startDate: e.target.value }))}
                onFocus={e => e.currentTarget.showPicker?.()}
                required
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <input
                type="date"
                value={addForm.endDate}
                onChange={e => setAddForm(f => ({ ...f, endDate: e.target.value }))}
                onFocus={e => e.currentTarget.showPicker?.()}
                required
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <div className="flex gap-2">
                <input
                  type="number"
                  value={addForm.value}
                  onChange={e => setAddForm(f => ({ ...f, value: e.target.value }))}
                  placeholder="Value (optional)"
                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff] flex-1"
                />
                <button
                  type="submit"
                  disabled={saving || !addForm.contractNumber.trim() || !addForm.vendorName.trim() || !addForm.startDate || !addForm.endDate}
                  className="h-12 px-8 rounded-lg bg-[#08060d] text-white text-base font-semibold hover:bg-[#2a2735] disabled:opacity-40"
                >
                  {saving ? 'Saving…' : 'Add'}
                </button>
              </div>
              <textarea value={addForm.comments} onChange={e => setAddForm(f => ({ ...f, comments: e.target.value }))} placeholder="Comments (optional)" rows={3} className="contracts-comments-field" />
            </form>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      {loading && <p className="text-sm text-[#6b6375]">Loading…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && data && data.totalElements === 0 && (
        <div className="bg-white border border-[#e5e4e7] rounded-lg px-6 py-12 flex flex-col items-center gap-3">
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-[#6b6375]">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
          <p className="text-sm font-medium text-[#08060d]">No contracts yet</p>
          <p className="text-xs text-[#6b6375]">Use the Add form above to create your first contract.</p>
        </div>
      )}

      {!loading && !error && data && data.totalElements !== 0 && visibleContracts.length === 0 && (
        <div className="bg-white border border-[#e5e4e7] rounded-lg px-6 py-12 flex flex-col items-center gap-2">
          <p className="text-sm font-medium text-[#08060d]">No matching contracts</p>
          <p className="text-xs text-[#6b6375]">Try a contract number, software name, license type, or vendor JDE number.</p>
        </div>
      )}

      {!loading && !error && data && data.totalElements !== 0 && visibleContracts.length !== 0 && (
        <>
          <div className="contracts-panel">
            <div className="contracts-table-wrap">
            <table className="contracts-table">
              <thead>
                <tr className="border-b border-[#e5e4e7] bg-[#f7f6f3]">
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Contract #</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Vendor</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Vendor JDE</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Software</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Department</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">IT owner</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Start</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">End</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Value</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-[#08060d]">Actions</th>
                </tr>
              </thead>
              <tbody>
                {visibleContracts.map(c => (
                  editingId === c.id ? (
                    <tr key={c.id} className="border-b border-[#e5e4e7] last:border-0 bg-[#faf9f7]">
                      <td className="px-4 py-2">
                        <input
                          value={editForm.contractNumber}
                          onChange={e => setEditForm(f => ({ ...f, contractNumber: e.target.value }))}
                          className="h-8 w-full px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.vendorName}
                          onChange={e => updateEditVendorName(e.target.value)}
                          list="contract-vendors"
                          className="h-8 w-full px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.vendorJDENumber}
                          onChange={e => setEditForm(f => ({ ...f, vendorJDENumber: e.target.value }))}
                          className="h-8 w-full px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.softwareName}
                          onChange={e => setEditForm(f => ({ ...f, softwareName: e.target.value }))}
                          className="h-8 w-full px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          value={editForm.itOwner}
                          onChange={e => setEditForm(f => ({ ...f, itOwner: e.target.value }))}
                          placeholder="IT owner"
                          className="h-8 w-full px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                        <textarea value={editForm.comments} onChange={e => setEditForm(f => ({ ...f, comments: e.target.value }))} placeholder="Comments" rows={2} className="contracts-comments-field contracts-comments-edit" />
                        <input
                          value={editForm.department}
                          onChange={e => setEditForm(f => ({ ...f, department: e.target.value }))}
                          placeholder="Department"
                          className="h-8 w-full px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={editForm.startDate}
                          onChange={e => setEditForm(f => ({ ...f, startDate: e.target.value }))}
                          onFocus={e => e.currentTarget.showPicker?.()}
                          className="h-8 w-28 px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="date"
                          value={editForm.endDate}
                          onChange={e => setEditForm(f => ({ ...f, endDate: e.target.value }))}
                          onFocus={e => e.currentTarget.showPicker?.()}
                          className="h-8 w-28 px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          value={editForm.value}
                          onChange={e => setEditForm(f => ({ ...f, value: e.target.value }))}
                          className="h-8 w-24 px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d]"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <select
                          value={editForm.status}
                          onChange={e => setEditForm(f => ({ ...f, status: e.target.value as Contract['status'] }))}
                          className="h-8 px-2 rounded border border-[#e5e4e7] text-xs text-[#08060d] bg-white"
                        >
                          <option value="ACTIVE">Active</option>
                          <option value="PENDING_RENEWAL">Pending renewal</option>
                          <option value="EXPIRED">Expired</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-xs">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => void saveEdit(c.id)}
                            disabled={savingEdit}
                            className="px-2 py-1 rounded border border-[#e5e4e7] text-[#08060d] disabled:opacity-40"
                          >
                            Save
                          </button>
                          <button
                            onClick={cancelEdit}
                            disabled={savingEdit}
                            className="px-2 py-1 rounded border border-[#e5e4e7] text-[#6b6375] disabled:opacity-40"
                          >
                            Cancel
                          </button>
                          <button
                            onClick={() => void deleteContract(c.id)}
                            disabled={savingEdit || deletingId === c.id}
                            className="px-2 py-1 rounded border border-red-200 text-red-600 disabled:opacity-40"
                          >
                            {deletingId === c.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <Fragment key={c.id}>
                      <tr className="contract-row">
                        <td><div className="contract-number">{c.contractNumber}</div><div className="contract-subtitle">{c.department || 'Contract'}</div></td>
                        <td className="px-4 py-3 text-[#08060d]">{c.vendorName ?? c.vendor.name}</td>
                        <td className="px-4 py-3 text-[#6b6375]">{c.vendorJDENumber || c.vendor.vendorJDENumber || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="contract-software-list">
                            {Array.from(new Set((licensesByContract[c.id] ?? []).map(license => license.softwareName).concat(c.softwareName ? [c.softwareName] : []))).map(software => (
                              <span key={software} className="contract-software-chip">{software}</span>
                            ))}
                            {(licensesByContract[c.id] ?? []).length === 0 && !c.softwareName && <span className="text-[#6b6375]">—</span>}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-[#6b6375]">{c.department || '—'}</td>
                        <td className="px-4 py-3 text-[#6b6375]">{c.itOwner || '—'}</td>
                        <td className="px-4 py-3 text-[#6b6375]">{c.startDate ?? '—'}</td>
                        <td className="px-4 py-3 text-[#6b6375]">{c.endDate ?? '—'}</td>
                        <td className="px-4 py-3 text-[#08060d]">{fmtCurrency(c.value)}</td>
                        <td className="px-4 py-3">{statusBadge(c.status)}</td>
                        <td className="px-4 py-3 text-xs">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => void toggleLicenses(c)}
                              disabled={editingId !== null}
                              className={`license-toggle ${openLicensesId === c.id ? 'license-toggle-active' : ''} disabled:opacity-40`}
                            >
                              {openLicensesId === c.id ? '▾' : '▸'} {(licensesByContract[c.id] ?? []).length || ''} licenses
                            </button>
                            <button
                              onClick={() => startEdit(c)}
                              disabled={editingId !== null}
                              className="contract-edit-button disabled:opacity-40"
                            >
                              Edit
                            </button>
                          </div>
                        </td>
                      </tr>
                      {openLicensesId === c.id && (
                        <tr className="contracts-detail-row">
                          <td colSpan={11} className="px-4 py-4">
                            <div className="flex flex-col gap-3">
                              {(addLicenseOpenId === c.id || editingLicenseId != null) ? (
                              <div className="contracts-license-form grid gap-2 md:grid-cols-6">
                                <input
                                  value={licenseForm.licenseName}
                                  onChange={e => setLicenseForm(f => ({ ...f, licenseName: e.target.value }))}
                                  placeholder="License name (E5, Copilot)"
                                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                                />
                                <input value={licenseForm.itOwner} onChange={e => setLicenseForm(f => ({ ...f, itOwner: e.target.value }))} placeholder="IT owner" className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]" />
                                <input value={licenseForm.comments} onChange={e => setLicenseForm(f => ({ ...f, comments: e.target.value }))} placeholder="Comments" className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]" />
                                <input
                                  value={licenseForm.softwareName}
                                  onChange={e => setLicenseForm(f => ({ ...f, softwareName: e.target.value }))}
                                  placeholder="Software name"
                                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                                />
                                <input
                                  value={licenseForm.version}
                                  onChange={e => setLicenseForm(f => ({ ...f, version: e.target.value }))}
                                  placeholder="Version (optional)"
                                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                                />
                                <select
                                  value={licenseForm.licenseType}
                                  onChange={e => setLicenseForm(f => ({ ...f, licenseType: e.target.value as ContractLicense['licenseType'] }))}
                                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] bg-white outline-none focus:border-[#aa3bff]"
                                >
                                  <option value="PER_SEAT">Per seat</option>
                                  <option value="PER_DEVICE">Per device</option>
                                  <option value="SITE_LICENSE">Site license</option>
                                  <option value="SUBSCRIPTION">Subscription</option>
                                </select>
                                <select value={licenseForm.status} onChange={e => setLicenseForm(f => ({ ...f, status: e.target.value as ContractLicense['status'] }))} className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] bg-white">
                                  <option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="EXPIRED">Expired</option>
                                </select>
                                <select value={licenseForm.paymentMethod} onChange={e => setLicenseForm(f => ({ ...f, paymentMethod: e.target.value as ContractLicense['paymentMethod'] }))} className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] bg-white">
                                  <option value="PURCHASE_ORDER">Purchase order</option><option value="CREDIT_CARD">Credit card</option>
                                </select>
                                <input type="date" required value={licenseForm.startDate} onChange={e => setLicenseForm(f => ({ ...f, startDate: e.target.value }))} onFocus={e => e.currentTarget.showPicker?.()} className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d]" />
                                <input type="date" required value={licenseForm.expiryDate} onChange={e => setLicenseForm(f => ({ ...f, expiryDate: e.target.value }))} onFocus={e => e.currentTarget.showPicker?.()} className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d]" />
                                <input
                                  type="number"
                                  value={licenseForm.seatsPurchased}
                                  onChange={e => setLicenseForm(f => ({ ...f, seatsPurchased: e.target.value }))}
                                  placeholder="Seats"
                                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                                />
                                <input
                                  type="number"
                                  min="0"
                                  step="0.01"
                                  value={licenseForm.price}
                                  onChange={e => setLicenseForm(f => ({ ...f, price: e.target.value }))}
                                  placeholder="Price"
                                  className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
                                />
                                <div className="flex gap-2">
                                  <button
                                    type="button"
                                    onClick={() => void saveLicense(c.id)}
                                    disabled={savingLicense || !licenseForm.licenseName.trim() || !licenseForm.softwareName.trim()}
                                    className="h-9 px-4 rounded-lg bg-[#08060d] text-white text-sm font-medium hover:bg-[#2a2735] disabled:opacity-40"
                                  >
                                    {savingLicense ? 'Saving…' : editingLicenseId == null ? 'Add' : 'Save'}
                                  </button>
                                  {editingLicenseId != null && (
                                    <>
                                      <button type="button" onClick={cancelEditLicense} className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#6b6375]">
                                        Cancel
                                      </button>
                                      <button type="button" onClick={() => void deleteLicense(c.id, editingLicenseId)} disabled={deletingLicenseId === editingLicenseId} className="h-9 px-3 rounded-lg border border-red-200 text-sm text-red-600 disabled:opacity-40">
                                        {deletingLicenseId === editingLicenseId ? 'Deleting…' : 'Delete'}
                                      </button>
                                    </>
                                  )}
                                </div>
                              </div>
                              ) : (
                                <div className="license-add-row">
                                  <button
                                    type="button"
                                    onClick={() => { setAddLicenseOpenId(c.id); setEditingLicenseId(null); setLicenseForm({ ...EMPTY_LICENSE_FORM, softwareName: c.softwareName ?? '' }) }}
                                    className="license-add-button"
                                  >
                                    + Add license
                                  </button>
                                  <span className="contracts-license-total">License total: <strong>{fmtCurrency(licenseTotal(c.id))}</strong></span>
                                </div>
                              )}

                              {loadingLicensesId === c.id ? (
                                <p className="text-xs text-[#6b6375]">Loading licenses…</p>
                              ) : (licensesByContract[c.id] ?? []).length === 0 ? (
                                <p className="text-xs text-[#6b6375]">No licenses added for this contract.</p>
                              ) : (
                                <div className="contracts-detail-list">
                                    {(licensesByContract[c.id] ?? []).map(license => (
                                      <div key={license.licenseId} className="contracts-license-card">
                                        <div className="license-main">
                                          <span className="license-kicker">License</span>
                                          <strong>{license.licenseName}</strong>
                                          <span>{license.softwareName}</span>
                                        </div>
                                        <div className="license-meta">
                                          <span>{license.seatsPurchased ?? '—'} users</span>
                                          <span>{license.price == null ? 'No price' : fmtCurrency(license.price)}</span>
                                          <span className={license.paymentMethod === 'CREDIT_CARD' ? 'payment-badge payment-credit-card' : 'payment-badge'}>{license.paymentMethod === 'PURCHASE_ORDER' ? 'PO' : 'Credit card'}</span>
                                          <span>{license.status.toLowerCase()}</span>
                                          <span>{license.startDate} → {license.expiryDate}</span>
                                        </div>
                                        <div className="license-actions">
                                          <button type="button" onClick={() => startEditLicense(license)} className="license-edit-button">Edit</button>
                                        </div>
                                      </div>
                                    ))}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  )
                ))}
              </tbody>
            </table>
            </div>
          </div>

          {data.totalPages > 1 && (
            <div className="flex items-center gap-3 text-sm">
              <button disabled={data.first} onClick={() => setPage(p => p - 1)}
                className="px-3 py-1 rounded border border-[#e5e4e7] disabled:opacity-40 hover:bg-[#f7f6f3] transition-colors">
                ← Prev
              </button>
              <span className="text-[#6b6375]">Page {data.number + 1} of {data.totalPages}</span>
              <button disabled={data.last} onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded border border-[#e5e4e7] disabled:opacity-40 hover:bg-[#f7f6f3] transition-colors">
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
