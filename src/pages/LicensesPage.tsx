import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { client } from '../api'
import type { Contract, ContractLicense, Vendor } from '../types'
import '../styles/contracts.css'
import { downloadExcel } from '../utils/exportExcel'

function fmtCurrency(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

const LICENSE_PAGE_SIZE = 20

type LicenseForm = {
  vendorId: string
  contractId: string
  licenseName: string
  itOwner: string
  comments: string
  softwareName: string
  version: string
  licenseType: ContractLicense['licenseType']
  status: ContractLicense['status']
  paymentMethod: ContractLicense['paymentMethod']
  seatsPurchased: string
  price: string
  startDate: string
  expiryDate: string
}

const EMPTY_FORM: LicenseForm = {
  vendorId: '', contractId: '', licenseName: '', itOwner: '', comments: '', softwareName: '', version: '',
  licenseType: 'PER_SEAT', status: 'ACTIVE', paymentMethod: 'PURCHASE_ORDER', seatsPurchased: '', price: '', startDate: '', expiryDate: '',
}

export default function LicensesPage() {
  const [licenses, setLicenses] = useState<ContractLicense[]>([])
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [addOpen, setAddOpen] = useState(false)
  const [form, setForm] = useState<LicenseForm>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [view, setView] = useState<'licenses' | 'software'>('licenses')
  const [expandedSoftware, setExpandedSoftware] = useState<Record<string, boolean>>({})
  const [editingLicenseId, setEditingLicenseId] = useState<number | null>(null)
  const [vendorPickerOpen, setVendorPickerOpen] = useState(false)
  const [vendorQuery, setVendorQuery] = useState('')
  const [contractPickerOpen, setContractPickerOpen] = useState(false)
  const [contractQuery, setContractQuery] = useState('')
  const [licensePage, setLicensePage] = useState(0)

  useEffect(() => {
    Promise.all([
      client.get<ContractLicense[]>('/contracts/licenses/all'),
      client.get<{ content: Vendor[] }>('/vendors', { params: { page: 0, size: 500 } }),
      client.get<{ content: Contract[] }>('/contracts', { params: { page: 0, size: 500 } }),
    ])
      .then(([licenseResponse, vendorResponse, contractResponse]) => {
        setLicenses(licenseResponse.data ?? [])
        setVendors(vendorResponse.data.content ?? [])
        setContracts(contractResponse.data.content ?? [])
      })
      .catch(() => setError('Failed to load licenses.'))
      .finally(() => setLoading(false))
  }, [])

  const visibleLicenses = useMemo(() => {
    const needle = search.toLowerCase()
    if (!needle) return licenses
    return licenses.filter(license => [
      license.licenseId,
      license.contractId ?? '',
      license.licenseName,
      license.softwareId ?? '',
      license.vendorName,
      license.softwareName,
      license.version,
      license.licenseType,
    ].join(' ').toLowerCase().includes(needle))
  }, [licenses, search])

  const totalPrice = visibleLicenses.reduce((sum, license) => sum + (license.price ?? 0), 0)
  const licensePageCount = Math.max(1, Math.ceil(visibleLicenses.length / LICENSE_PAGE_SIZE))
  const pagedLicenses = visibleLicenses.slice(licensePage * LICENSE_PAGE_SIZE, (licensePage + 1) * LICENSE_PAGE_SIZE)
  const selectedVendorContracts = contracts.filter(contract => contract.vendorId === Number(form.vendorId))
  const softwareGroups = useMemo(() => {
    const groups = new Map<string, ContractLicense[]>()
    visibleLicenses.forEach(license => {
      const key = `${license.vendorName}::${license.softwareName}`
      groups.set(key, [...(groups.get(key) ?? []), license])
    })
    return Array.from(groups, ([key, group]) => ({
      key,
      vendorName: group[0].vendorName,
      vendor: vendors.find(vendor => vendor.name.toLowerCase() === group[0].vendorName.toLowerCase()),
      softwareName: group[0].softwareName,
      licenses: group,
      totalPrice: group.reduce((sum, license) => sum + (license.price ?? 0), 0),
    })).sort((a, b) => a.softwareName.localeCompare(b.softwareName))
  }, [visibleLicenses, vendors])

  function exportLicenses() {
    downloadExcel('licenses.xlsx', 'Licenses', licenses.map(license => ({
      'License name': license.licenseName,
      Vendor: license.vendorName,
      'IT owner': license.itOwner ?? '',
      'Software name': license.softwareName,
      'Contract ID': license.contractId ?? '',
      Type: license.licenseType,
      Status: license.status,
      Payment: license.paymentMethod === 'PURCHASE_ORDER' ? 'PO' : 'Credit card',
      Seats: license.seatsPurchased ?? '',
      Price: license.price ?? '',
      Start: license.startDate,
      Expiry: license.expiryDate,
    })))
  }

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setLicensePage(0)
    setSearch(searchText.trim().toLowerCase())
  }

  function clearSearch() {
    setSearchText('')
    setLicensePage(0)
    setSearch('')
  }

  async function addLicense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    try {
      const payload = {
        licenseName: form.licenseName.trim(),
        itOwner: form.itOwner.trim() || null,
        comments: form.comments.trim() || null,
        softwareName: form.softwareName.trim(),
        version: form.version.trim() || null,
        licenseType: form.licenseType,
        status: form.status,
        paymentMethod: form.paymentMethod,
        seatsPurchased: form.seatsPurchased.trim() ? Number(form.seatsPurchased) : null,
        price: form.price.trim() ? Number(form.price) : null,
        startDate: form.startDate || null,
        expiryDate: form.expiryDate || null,
        contractId: form.contractId ? Number(form.contractId) : null,
      }
      const { data } = editingLicenseId == null
        ? await client.post<ContractLicense>(`/vendors/${form.vendorId}/licenses`, payload)
        : await client.put<ContractLicense>(`/vendors/${form.vendorId}/licenses/${editingLicenseId}`, payload)
      setLicenses(previous => editingLicenseId == null ? [...previous, data] : previous.map(license => license.licenseId === editingLicenseId ? data : license))
      setForm(EMPTY_FORM)
      setEditingLicenseId(null)
      setVendorQuery('')
      setContractQuery('')
      setAddOpen(false)
    } catch (err: any) {
      setError(typeof err?.response?.data?.message === 'string'
        ? err.response.data.message
        : editingLicenseId == null ? 'Failed to add license.' : 'Failed to update license.')
    } finally {
      setSaving(false)
    }
  }

  async function deleteLicense() {
    if (editingLicenseId == null || !window.confirm('Delete this license?')) return
    setSaving(true)
    setError(null)
    try {
      await client.delete(`/vendors/${form.vendorId}/licenses/${editingLicenseId}`)
      setLicenses(previous => previous.filter(license => license.licenseId !== editingLicenseId))
      setEditingLicenseId(null)
      setForm(EMPTY_FORM)
      setVendorQuery('')
      setContractQuery('')
      setAddOpen(false)
    } catch (err: any) {
      setError(typeof err?.response?.data?.message === 'string' ? err.response.data.message : 'Failed to delete license.')
    } finally {
      setSaving(false)
    }
  }

  function editLicense(license: ContractLicense) {
    const vendor = vendors.find(option => option.name.toLowerCase() === license.vendorName.toLowerCase())
    setEditingLicenseId(license.licenseId)
    setVendorQuery(vendor?.name ?? license.vendorName)
    setContractQuery(license.contractId == null ? '' : contracts.find(contract => contract.id === license.contractId)?.contractNumber ?? '')
    setForm({
      vendorId: vendor?.vendorId == null ? '' : String(vendor.vendorId),
      contractId: license.contractId == null ? '' : String(license.contractId),
      licenseName: license.licenseName,
      itOwner: license.itOwner ?? '',
      comments: license.comments ?? '',
      softwareName: license.softwareName,
      version: license.version === 'default' ? '' : license.version,
      licenseType: license.licenseType,
      status: license.status,
      paymentMethod: license.paymentMethod,
      seatsPurchased: license.seatsPurchased == null ? '' : String(license.seatsPurchased),
      price: license.price == null ? '' : String(license.price),
      startDate: license.startDate,
      expiryDate: license.expiryDate,
    })
    setAddOpen(true)
  }

  return (
    <div className="licenses-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Licenses</h1>
        <div className="flex items-center gap-3"><button type="button" className="contracts-clear-button" onClick={exportLicenses}>Export Excel</button><span className="text-sm text-[#6b6375]">{view === 'licenses' ? `${visibleLicenses.length} licenses · ${fmtCurrency(totalPrice)}` : `${softwareGroups.length} software · ${visibleLicenses.length} licenses`}</span><button type="button" className="contracts-add-button" onClick={() => { setEditingLicenseId(null); setForm(EMPTY_FORM); setVendorQuery(''); setContractQuery(''); setAddOpen(true) }}>+ Add license</button></div>
      </div>

      <div className="contracts-toolbar flex flex-wrap items-center gap-2">
        <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-2">
          <input
            value={searchText}
            onChange={event => setSearchText(event.target.value)}
            placeholder="Search vendor, contract, license, or software"
            className="h-8 min-w-80 px-3 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#2b5a63]"
          />
          <button type="submit" className="contracts-search-button">Search</button>
          {search && <button type="button" onClick={clearSearch} className="contracts-clear-button">Clear</button>}
        </form>
        <div className="license-view-toggle" role="group" aria-label="License view">
          <button type="button" className={view === 'licenses' ? 'active' : ''} onClick={() => setView('licenses')}>Licenses</button>
          <button type="button" className={view === 'software' ? 'active' : ''} onClick={() => setView('software')}>Software</button>
        </div>
      </div>

      {loading && <p className="text-sm text-[#6b6375]">Loading licenses…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {addOpen && (
        <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setAddOpen(false) }}>
          <div className="contracts-modal" role="dialog" aria-modal="true" aria-labelledby="licenses-add-title">
            <div className="contracts-modal-head"><h2 id="licenses-add-title">{editingLicenseId == null ? 'Add license' : 'Edit license'}</h2><button type="button" className="contracts-modal-close" onClick={() => setAddOpen(false)} aria-label="Close">×</button></div>
            <div className="contracts-modal-body">
              <form onSubmit={addLicense} className="dashboard-license-form">
                <div className="vendor-picker">
                  <input
                    required
                    value={vendorQuery || (vendors.find(vendor => String(vendor.vendorId) === form.vendorId)?.name ?? '')}
                    placeholder="Search or choose vendor"
                    onChange={event => {
                      setVendorPickerOpen(true)
                      setVendorQuery(event.target.value)
                      const typed = event.target.value.toLowerCase()
                      const matching = vendors.find(vendor => vendor.name.toLowerCase() === typed)
                      if (matching?.vendorId != null) setForm(previous => ({ ...previous, vendorId: String(matching.vendorId), contractId: '' }))
                      else setForm(previous => ({ ...previous, vendorId: '', contractId: '' }))
                    }}
                    onFocus={() => setVendorPickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setVendorPickerOpen(false), 120)}
                  />
                  {vendorPickerOpen && (
                    <div className="vendor-picker-menu">
                      {vendors.filter(vendor => vendor.name.toLowerCase().includes(vendorQuery.toLowerCase())).slice(0, 12).map(vendor => (
                        <button type="button" key={vendor.vendorId} className="vendor-picker-option" onMouseDown={event => event.preventDefault()} onClick={() => { setForm(previous => ({ ...previous, vendorId: String(vendor.vendorId), contractId: '' })); setVendorQuery(vendor.name); setVendorPickerOpen(false) }}>
                          <span>{vendor.name}</span><small>vendor_id {vendor.vendorId}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="vendor-picker">
                  <input
                    value={contractQuery || (selectedVendorContracts.find(contract => String(contract.id) === form.contractId)?.contractNumber ?? '')}
                    disabled={!form.vendorId}
                    placeholder="Search or choose contract"
                    onChange={event => { setContractQuery(event.target.value); setContractPickerOpen(true); setForm(previous => ({ ...previous, contractId: '' })) }}
                    onFocus={() => setContractPickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setContractPickerOpen(false), 120)}
                  />
                  {contractPickerOpen && form.vendorId && (
                    <div className="vendor-picker-menu">
                      <button type="button" className="vendor-picker-option" onMouseDown={event => event.preventDefault()} onClick={() => { setForm(previous => ({ ...previous, contractId: '' })); setContractQuery(''); setContractPickerOpen(false) }}>
                        <span>Standalone vendor license</span>
                      </button>
                      {selectedVendorContracts.filter(contract => `${contract.contractNumber} ${contract.softwareName ?? ''}`.toLowerCase().includes(contractQuery.toLowerCase())).slice(0, 12).map(contract => (
                        <button type="button" key={contract.id} className="vendor-picker-option" onMouseDown={event => event.preventDefault()} onClick={() => { setForm(previous => ({ ...previous, contractId: String(contract.id) })); setContractQuery(contract.contractNumber); setContractPickerOpen(false) }}>
                          <span>{contract.contractNumber}</span><small>{contract.softwareName || contract.department || 'Contract'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input required placeholder="License name" value={form.licenseName} onChange={event => setForm(previous => ({ ...previous, licenseName: event.target.value }))} />
                <input placeholder="IT owner" value={form.itOwner} onChange={event => setForm(previous => ({ ...previous, itOwner: event.target.value }))} />
                <input required placeholder="Software name" value={form.softwareName} onChange={event => setForm(previous => ({ ...previous, softwareName: event.target.value }))} />
                <input placeholder="Version" value={form.version} onChange={event => setForm(previous => ({ ...previous, version: event.target.value }))} />
                <select value={form.licenseType} onChange={event => setForm(previous => ({ ...previous, licenseType: event.target.value as ContractLicense['licenseType'] }))}><option value="PER_SEAT">Per seat</option><option value="PER_DEVICE">Per device</option><option value="SITE_LICENSE">Site license</option><option value="SUBSCRIPTION">Subscription</option></select>
                <select value={form.status} onChange={event => setForm(previous => ({ ...previous, status: event.target.value as ContractLicense['status'] }))}><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="EXPIRED">Expired</option></select>
                <select value={form.paymentMethod} onChange={event => setForm(previous => ({ ...previous, paymentMethod: event.target.value as ContractLicense['paymentMethod'] }))}><option value="PURCHASE_ORDER">Purchase order</option><option value="CREDIT_CARD">Credit card</option></select>
                <input type="number" placeholder="Seats" value={form.seatsPurchased} onChange={event => setForm(previous => ({ ...previous, seatsPurchased: event.target.value }))} />
                <input type="number" min="0" step="0.01" placeholder="Price" value={form.price} onChange={event => setForm(previous => ({ ...previous, price: event.target.value }))} />
                <input type="date" required value={form.startDate} onChange={event => setForm(previous => ({ ...previous, startDate: event.target.value }))} onFocus={event => event.currentTarget.showPicker?.()} />
                <input type="date" required value={form.expiryDate} onChange={event => setForm(previous => ({ ...previous, expiryDate: event.target.value }))} onFocus={event => event.currentTarget.showPicker?.()} />
                <textarea placeholder="Comments" rows={3} value={form.comments} onChange={event => setForm(previous => ({ ...previous, comments: event.target.value }))} className="contracts-comments-field" />
                <div className="dashboard-license-actions"><button type="button" className="contracts-clear-button" onClick={() => setAddOpen(false)}>Cancel</button>{editingLicenseId != null && <button type="button" className="license-modal-delete" onClick={() => void deleteLicense()} disabled={saving}>Delete</button>}<button type="submit" className="contracts-search-button" disabled={saving}>{saving ? 'Saving…' : 'Save license'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}
      {!loading && !error && (
        <div className="contracts-panel licenses-panel">
          <div className="contracts-table-wrap">
            {view === 'licenses' ? <table className="contracts-table licenses-table">
              <thead>
                <tr>
                  <th>License</th>
                  <th>IT owner</th>
                  <th>Vendor</th>
                  <th>Software</th>
                  <th>Contract ID</th>
                  <th>Type</th>
                  <th>Seats</th>
                  <th>Price</th>
                  <th>Payment</th>
                  <th>Start</th>
                  <th>Expiry</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedLicenses.map(license => (
                  <tr key={license.licenseId} className="contract-row">
                    <td className="font-semibold">{license.licenseName}</td>
                    <td>{license.itOwner || '—'}</td>
                    <td>{license.vendorName || '—'}</td>
                    <td>{license.softwareName}</td>
                    <td className="font-mono text-xs">{license.contractId ?? '—'}</td>
                    <td>{license.licenseType.replace('_', ' ')}</td>
                    <td>{license.seatsPurchased ?? '—'}</td>
                    <td>{fmtCurrency(license.price)}</td>
                    <td><span className={license.paymentMethod === 'CREDIT_CARD' ? 'payment-badge payment-credit-card' : 'payment-badge'}>{license.paymentMethod === 'CREDIT_CARD' ? 'Credit card' : 'PO'}</span></td>
                    <td>{license.startDate || '—'}</td>
                    <td>{license.expiryDate || '—'}</td>
                    <td><button type="button" className="license-edit-button" onClick={() => editLicense(license)}>Edit</button></td>
                  </tr>
                ))}
                {visibleLicenses.length === 0 && (
                  <tr><td colSpan={10} className="py-10 text-center text-[#6b6375]">No licenses found.</td></tr>
                )}
              </tbody>
            </table> : <table className="contracts-table licenses-table">
              <thead><tr><th>Software</th><th>Vendor</th><th>Licenses</th><th>License names</th><th>Contracts</th><th>Total value</th></tr></thead>
              <tbody>
                {softwareGroups.map(group => {
                  const isOpen = expandedSoftware[group.key] ?? false
                  return (
                    <Fragment key={group.key}>
                      <tr className={`contract-row software-parent-row ${isOpen ? 'software-parent-row-open' : ''}`} role="button" tabIndex={0} onClick={() => setExpandedSoftware(previous => ({ ...previous, [group.key]: !isOpen }))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setExpandedSoftware(previous => ({ ...previous, [group.key]: !isOpen })) }}>
                        <td className="font-semibold">{isOpen ? '▾' : '▸'} {group.softwareName}</td>
                        <td>{group.vendorName}</td>
                        <td>{group.licenses.length}</td>
                        <td className="software-license-names">{group.licenses.map(license => license.licenseName).join(', ')}</td>
                        <td>{new Set(group.licenses.filter(license => license.contractId != null).map(license => license.contractId)).size}</td>
                        <td>{fmtCurrency(group.totalPrice)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="software-vendor-detail-row">
                          <td colSpan={6}>
                            Vendor details: <strong>{group.vendorName}</strong> · JDE {group.vendor?.vendorJDENumber || '—'} · {group.vendor?.contactEmail || '—'} · {group.vendor?.address || '—'} · {group.vendor?.website || '—'}
                          </td>
                        </tr>
                      )}
                      {isOpen && group.licenses.map(license => (
                        <tr key={`${group.key}-${license.licenseId}`} className="software-license-detail-row">
                          <td colSpan={6}>
                            <div className="software-license-detail-grid">
                              <strong>{license.licenseName}</strong>
                              <span>Contract: {license.contractId ?? 'Standalone'}</span>
                              <span>Users: {license.seatsPurchased ?? '—'}</span>
                              <span>Price: {fmtCurrency(license.price)}</span>
                              <span><span className={license.paymentMethod === 'CREDIT_CARD' ? 'payment-badge payment-credit-card' : 'payment-badge'}>{license.paymentMethod === 'CREDIT_CARD' ? 'Credit card' : 'PO'}</span></span>
                              <span>Expiry: {license.expiryDate || '—'}</span>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </Fragment>
                  )
                })}
                {softwareGroups.length === 0 && <tr><td colSpan={6} className="py-10 text-center text-[#6b6375]">No software found.</td></tr>}
              </tbody>
            </table>}
          </div>
          {view === 'licenses' && visibleLicenses.length > LICENSE_PAGE_SIZE && (
            <div className="pagination-controls licenses-pagination">
              <button type="button" disabled={licensePage === 0} onClick={() => setLicensePage(page => page - 1)}>Previous</button>
              <span>Page {licensePage + 1} of {licensePageCount}</span>
              <button type="button" disabled={licensePage >= licensePageCount - 1} onClick={() => setLicensePage(page => page + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
