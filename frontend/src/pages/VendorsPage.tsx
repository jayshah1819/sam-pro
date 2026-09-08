import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { client } from '../api'
import { ToolbarDropdown } from '../components'
import type { Contract, ContractLicense, Vendor } from '../types'
import '../styles/contracts.css'
import { downloadExcel } from '../utils/exportExcel'

type VendorInsight = {
  vendorKey: string
  vendorIdLabel: string
  vendorId: number | null
  vendorName: string
  vendorJDENumber: string | null
  vendorContactEmail: string | null
  vendorAddress: string | null
  vendorWebsite: string | null
  softwareIds: number[]
  contractCount: number
  totalBudget: number
  totalLicensePrice: number
  contracts: Contract[]
  licenses: ContractLicense[]
}

type VendorLicenseForm = {
  vendorId: string
  contractId: string
  licenseName: string
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

const VENDOR_PAGE_SIZE = 20

const EMPTY_VENDOR_LICENSE_FORM: VendorLicenseForm = {
  vendorId: '',
  contractId: '',
  licenseName: '',
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

function fmtCurrency(v: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v)
}

function statusBadge(status: Contract['status']) {
  const styles: Record<Contract['status'], string> = {
    ACTIVE: 'status-active',
    EXPIRED: 'status-expired',
    PENDING_RENEWAL: 'status-pending',
  }
  return <span className={`status-pill ${styles[status]}`}>{status.replace('_', ' ')}</span>
}

function vendorIdLabel(vendor: Vendor): string {
  if (vendor.vendorId != null) {
    return String(vendor.vendorId)
  }
  return '—'
}

export default function VendorsPage() {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [contracts, setContracts] = useState<Contract[]>([])
  const [licenses, setLicenses] = useState<ContractLicense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [detailsOpen, setDetailsOpen] = useState<Record<string, boolean>>({})
  const [expandedContracts, setExpandedContracts] = useState<Record<number, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [vendorJDENumber, setVendorJDENumber] = useState('')
  const [vendorContactEmail, setVendorContactEmail] = useState('')
  const [vendorAddress, setVendorAddress] = useState('')
  const [vendorComments, setVendorComments] = useState('')
  const [vendorWebsite, setVendorWebsite] = useState('')
  const [savingVendor, setSavingVendor] = useState(false)
  const [deletingVendorId, setDeletingVendorId] = useState<number | null>(null)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [editingVendorId, setEditingVendorId] = useState<number | null>(null)
  const [highlightedVendorId, setHighlightedVendorId] = useState<number | null>(null)
  const [vendorEditDraft, setVendorEditDraft] = useState<Record<number, Vendor>>({})
  const [vendorLicenseForm, setVendorLicenseForm] = useState<VendorLicenseForm>(EMPTY_VENDOR_LICENSE_FORM)
  const [savingVendorLicense, setSavingVendorLicense] = useState(false)
  const [topAddLicenseOpen, setTopAddLicenseOpen] = useState(false)
  const [vendorPage, setVendorPage] = useState(0)
  const [licenseVendorQuery, setLicenseVendorQuery] = useState('')
  const [licenseVendorPickerOpen, setLicenseVendorPickerOpen] = useState(false)
  const [licenseContractQuery, setLicenseContractQuery] = useState('')
  const [licenseContractPickerOpen, setLicenseContractPickerOpen] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.allSettled([
      client.get<{ content: Vendor[] }>('/vendors', { params: { page: 0, size: 500 } }),
      client.get<{ content: Contract[] }>('/contracts', { params: { page: 0, size: 500 } }),
      client.get<ContractLicense[]>('/contracts/licenses/all'),
    ])
      .then(([vendorResult, contractResult, licenseResult]) => {
        const failures: string[] = []
        if (vendorResult.status === 'fulfilled') setVendors(vendorResult.value.data.content ?? [])
        else failures.push('vendors')
        if (contractResult.status === 'fulfilled') setContracts(contractResult.value.data.content ?? [])
        else failures.push('contracts')
        if (licenseResult.status === 'fulfilled') setLicenses(licenseResult.value.data ?? [])
        else failures.push('licenses')
        if (failures.length) setError(`Failed to load ${failures.join(', ')}.`)
      })
      .finally(() => setLoading(false))
  }, [])

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setVendorPage(0)
    setSearch(searchText.trim())
  }

  function clearSearch() {
    setSearchText('')
    setVendorPage(0)
    setSearch('')
  }

  function toggleVendor(vendorKey: string) {
    setExpanded(prev => ({ ...prev, [vendorKey]: !prev[vendorKey] }))
  }

  async function addVendor(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!vendorName.trim()) {
      return
    }

    setSavingVendor(true)
    setSaveError(null)
    try {
      const { data } = await client.post<Vendor>('/vendors', {
        name: vendorName.trim(),
        vendorJDENumber: vendorJDENumber.trim() || null,
        contactEmail: vendorContactEmail.trim() || null,
        address: vendorAddress.trim() || null,
        website: vendorWebsite.trim() || null,
        comments: vendorComments.trim() || null,
      })
      setVendors(prev => [data, ...prev])
      setHighlightedVendorId(data.vendorId ?? null)
      window.setTimeout(() => setHighlightedVendorId(null), 1800)
      setVendorName('')
      setVendorJDENumber('')
      setVendorContactEmail('')
      setVendorAddress('')
      setVendorWebsite('')
      setVendorComments('')
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to add vendor.')
    } finally {
      setSavingVendor(false)
    }
  }

  function beginEditVendor(vendor: Vendor) {
    if (vendor.vendorId == null) {
      return
    }
    setEditingVendorId(vendor.vendorId)
    setVendorEditDraft(prev => ({ ...prev, [vendor.vendorId!]: { ...vendor } }))
  }

  function updateVendorDraft(vendorId: number, patch: Partial<Vendor>) {
    const base = vendors.find(v => v.vendorId === vendorId)
    setVendorEditDraft(prev => ({
      ...prev,
      [vendorId]: {
        ...(base ?? prev[vendorId] ?? { tenantId: '', name: '', canonicalName: null, aliases: [], vendorJDENumber: null, contactEmail: null, address: null, website: null, comments: null }),
        ...patch,
      },
    }))
  }

  async function updateVendor(vendorId: number) {
    const draft = vendorEditDraft[vendorId]
    const base = vendors.find(v => v.vendorId === vendorId) ?? draft
    if (!base || !draft) {
      return
    }

    setSavingVendor(true)
    setSaveError(null)
    try {
      const { data } = await client.put<Vendor>(`/vendors/${vendorId}`, {
        name: draft.name?.trim() || base.name,
        vendorJDENumber: draft.vendorJDENumber?.trim() || null,
        canonicalName: draft.canonicalName?.trim() || null,
        contactEmail: draft.contactEmail?.trim() || null,
        address: draft.address?.trim() || null,
        website: draft.website?.trim() || null,
        comments: draft.comments?.trim() || null,
      })
      setVendors(prev => prev.map(item => item.vendorId === data.vendorId ? { ...item, ...data } : item))
      setHighlightedVendorId(data.vendorId ?? vendorId)
      window.setTimeout(() => setHighlightedVendorId(null), 1800)
      setVendorEditDraft(prev => {
        const next = { ...prev }
        delete next[vendorId]
        return next
      })
      setEditingVendorId(null)
    } catch (err: any) {
      const responseMessage = err?.response?.data?.message
      const message = typeof responseMessage === 'string' ? responseMessage : err?.response?.status === 401
        ? 'Your session is not authorized for this update. Sign out and sign in again.'
        : 'Failed to update vendor.'
      setSaveError(message)
    } finally {
      setSavingVendor(false)
    }
  }

  async function deleteVendor(vendor: VendorInsight) {
    if (vendor.vendorId == null || !window.confirm(`Delete ${vendor.vendorName}?`)) return
    setDeletingVendorId(vendor.vendorId)
    setSaveError(null)
    try {
      await client.delete(`/vendors/${vendor.vendorId}`)
      setVendors(previous => previous.filter(item => item.vendorId !== vendor.vendorId))
      setExpanded(previous => {
        const next = { ...previous }
        delete next[vendor.vendorKey]
        return next
      })
      setDetailsOpen(previous => {
        const next = { ...previous }
        delete next[vendor.vendorKey]
        return next
      })
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to delete vendor.')
    } finally {
      setDeletingVendorId(null)
    }
  }

  async function addVendorLicense(event: FormEvent<HTMLFormElement>, vendorId: number) {
    event.preventDefault()
    setSavingVendorLicense(true)
    setSaveError(null)
    try {
      const { data } = await client.post<ContractLicense>(`/vendors/${vendorId}/licenses`, {
        contractId: Number(vendorLicenseForm.contractId),
        licenseName: vendorLicenseForm.licenseName.trim(),
        softwareName: vendorLicenseForm.softwareName.trim(),
        version: vendorLicenseForm.version.trim() || null,
        licenseType: vendorLicenseForm.licenseType,
        status: vendorLicenseForm.status,
        paymentMethod: vendorLicenseForm.paymentMethod,
        startDate: vendorLicenseForm.startDate || null,
        expiryDate: vendorLicenseForm.expiryDate || null,
        seatsPurchased: vendorLicenseForm.seatsPurchased.trim() ? Number(vendorLicenseForm.seatsPurchased) : null,
        price: vendorLicenseForm.price.trim() ? Number(vendorLicenseForm.price) : null,
      })
      setLicenses(prev => [...prev, data])
      setVendorLicenseForm(EMPTY_VENDOR_LICENSE_FORM)
      setTopAddLicenseOpen(false)
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to add vendor license.')
    } finally {
      setSavingVendorLicense(false)
    }
  }

  const insights = useMemo<VendorInsight[]>(() => {
    const contractsByVendorId = new Map<number, Contract[]>()
    for (const c of contracts) {
      const id = c.vendorId ?? c.vendor?.vendorId
      if (!id) {
        continue
      }
      const list = contractsByVendorId.get(id) ?? []
      list.push(c)
      contractsByVendorId.set(id, list)
    }

    const vendorById = new Map(vendors.filter(vendor => vendor.vendorId != null).map(vendor => [vendor.vendorId as number, vendor]))
    for (const c of contracts) {
      const publicVendorId = c.vendorId ?? c.vendor?.vendorId
      if (publicVendorId && !vendorById.has(publicVendorId)) {
        vendorById.set(publicVendorId, {
          ...c.vendor,
          vendorId: publicVendorId,
          tenantId: String(c.tenantId),
          name: c.vendorName ?? c.vendor.name,
          vendorJDENumber: c.vendorJDENumber ?? c.vendor.vendorJDENumber ?? null,
        })
      }
    }

    const out = Array.from(vendorById.values()).map((vendor) => {
      const vendorContracts = vendor.vendorId ? contractsByVendorId.get(vendor.vendorId) ?? [] : []
      const totalBudget = vendorContracts.reduce((sum, c) => sum + (c.value ?? 0), 0)
      const vendorLicenses = licenses.filter(license => license.vendorName.toLowerCase() === vendor.name.toLowerCase())
      const totalLicensePrice = vendorLicenses.reduce((sum, license) => sum + (license.price ?? 0), 0)
      vendorContracts.sort((a, b) => (a.startDate < b.startDate ? 1 : -1))

      return {
        vendorKey: vendor.vendorId == null ? vendor.name : String(vendor.vendorId),
        vendorId: vendor.vendorId ?? null,
        vendorIdLabel: vendorIdLabel(vendor),
        vendorName: vendor.name,
        vendorJDENumber: vendor.vendorJDENumber ?? null,
        vendorContactEmail: vendor.contactEmail ?? null,
        vendorAddress: vendor.address ?? null,
        vendorWebsite: vendor.website ?? null,
        softwareIds: Array.from(new Set(vendorContracts.flatMap(c => c.softwareIds ?? []))).sort((a, b) => a - b),
        contractCount: vendorContracts.length,
        totalBudget,
        contracts: vendorContracts,
        licenses: vendorLicenses,
        totalLicensePrice,
      }
    })

    out.sort((a, b) => b.totalBudget - a.totalBudget || b.contractCount - a.contractCount)
    const needle = search.trim().toLowerCase()
    if (!needle) return out
    return out.filter(vendor => {
      const contractText = vendor.contracts.map(contract => `${contract.contractNumber} ${contract.softwareName ?? ''}`).join(' ')
      const licenseText = vendor.licenses.map(license => `${license.licenseName} ${license.softwareName} ${license.licenseId}`).join(' ')
      return `${vendor.vendorName} ${vendor.vendorJDENumber ?? ''} ${vendor.vendorContactEmail ?? ''} ${vendor.vendorAddress ?? ''} ${contractText} ${licenseText}`
        .toLowerCase()
        .includes(needle)
    })
  }, [contracts, vendors, licenses])

  const grandTotal = insights.reduce((sum, r) => sum + r.totalBudget, 0)

  function exportVendors() {
    downloadExcel('vendors.xlsx', 'Vendors', insights.map(vendor => ({
      Vendor: vendor.vendorName,
      'Vendor JDE': vendor.vendorJDENumber ?? '',
      'Contact email': vendor.vendorContactEmail ?? '',
      Address: vendor.vendorAddress ?? '',
      Website: vendor.vendorWebsite ?? '',
      Contracts: vendor.contractCount,
      Licenses: vendor.licenses.length,
      'License total': vendor.totalLicensePrice,
      'Contract value': vendor.totalBudget,
    })))
  }
  const vendorPageCount = Math.max(1, Math.ceil(insights.length / VENDOR_PAGE_SIZE))
  const visibleInsights = insights.slice(vendorPage * VENDOR_PAGE_SIZE, (vendorPage + 1) * VENDOR_PAGE_SIZE)

  function toggleContract(contractId: number) {
    setExpandedContracts(prev => ({ ...prev, [contractId]: !prev[contractId] }))
  }

  const selectedVendorLicenseContracts = contracts.filter(contract => contract.vendorId === Number(vendorLicenseForm.vendorId))

  return (
    <div className="vendors-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Vendors</h1>
        <div className="flex items-center gap-3"><button type="button" className="contracts-clear-button" onClick={exportVendors}>Export Excel</button><span className="text-sm text-[#6b6375]">
          Total Budget: <span className="font-semibold text-[#08060d]">{fmtCurrency(grandTotal)}</span>
        </span></div>
      </div>

      <div className="contracts-toolbar flex flex-col gap-2">
        <div className="flex flex-wrap items-center gap-2">
          <form onSubmit={submitSearch} className="flex flex-wrap items-center gap-2">
            <input
              value={searchText}
              onChange={e => setSearchText(e.target.value)}
              placeholder="Search vendors, JDE, contracts, licenses, or software"
              className="h-8 min-w-80 px-3 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
            />
            <button type="submit" className="contracts-search-button">Search</button>
            {search && <button type="button" onClick={clearSearch} className="contracts-clear-button">Clear</button>}
          </form>
          <ToolbarDropdown label="Add Vendor" panelClassName="w-[420px] max-w-[92vw]">
            <form onSubmit={addVendor} className="grid gap-2 md:grid-cols-2">
              <input
                value={vendorName}
                onChange={e => setVendorName(e.target.value)}
                placeholder="Vendor name"
                required
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff] flex-1"
              />
              <input
                value={vendorJDENumber}
                onChange={e => setVendorJDENumber(e.target.value)}
                placeholder="Vendor JDE number"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <input
                type="email"
                value={vendorContactEmail}
                onChange={e => setVendorContactEmail(e.target.value)}
                placeholder="Contact email (optional)"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <input
                value={vendorWebsite}
                onChange={e => setVendorWebsite(e.target.value)}
                placeholder="Website (optional)"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <input
                value={vendorAddress}
                onChange={e => setVendorAddress(e.target.value)}
                placeholder="Address (optional)"
                className="h-9 px-3 rounded-lg border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#aa3bff]"
              />
              <textarea value={vendorComments} onChange={e => setVendorComments(e.target.value)} placeholder="Comments (optional)" rows={3} className="contracts-comments-field md:col-span-2" />
              <button
                type="submit"
                disabled={savingVendor || !vendorName.trim()}
                className="h-9 px-4 rounded-lg bg-[#08060d] text-white text-sm font-medium hover:bg-[#2a2735] disabled:opacity-40 md:col-span-2"
              >
                {savingVendor ? 'Saving…' : 'Add'}
              </button>
            </form>
          </ToolbarDropdown>
          <button type="button" className="contracts-add-button" onClick={() => { setVendorLicenseForm(EMPTY_VENDOR_LICENSE_FORM); setLicenseVendorQuery(''); setLicenseContractQuery(''); setTopAddLicenseOpen(true) }}>+ Add license</button>
        </div>
      </div>

      {topAddLicenseOpen && (
        <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setTopAddLicenseOpen(false) }}>
          <div className="contracts-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-license-title">
            <div className="contracts-modal-head"><h2 id="vendor-license-title">Add license</h2><button type="button" className="contracts-modal-close" onClick={() => setTopAddLicenseOpen(false)} aria-label="Close">×</button></div>
            <div className="contracts-modal-body">
              <form onSubmit={event => { const vendorId = Number(vendorLicenseForm.vendorId); if (vendorId) void addVendorLicense(event, vendorId) }} className="dashboard-license-form">
                <div className="vendor-picker">
                  <input
                    required
                    value={licenseVendorQuery || (vendors.find(vendor => String(vendor.vendorId) === vendorLicenseForm.vendorId)?.name ?? '')}
                    placeholder="Search or choose vendor"
                    onChange={event => {
                      setLicenseVendorPickerOpen(true)
                      setLicenseVendorQuery(event.target.value)
                      const typed = event.target.value.toLowerCase()
                      const matching = vendors.find(vendor => vendor.name.toLowerCase() === typed)
                      if (matching?.vendorId != null) setVendorLicenseForm(form => ({ ...form, vendorId: String(matching.vendorId), contractId: '' }))
                      else setVendorLicenseForm(form => ({ ...form, vendorId: '', contractId: '' }))
                    }}
                    onFocus={() => setLicenseVendorPickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setLicenseVendorPickerOpen(false), 120)}
                  />
                  {licenseVendorPickerOpen && (
                    <div className="vendor-picker-menu">
                      {vendors.filter(vendor => vendor.name.toLowerCase().includes(licenseVendorQuery.toLowerCase())).slice(0, 12).map(vendor => (
                        <button type="button" key={vendor.vendorId} className="vendor-picker-option" onMouseDown={event => event.preventDefault()} onClick={() => { setVendorLicenseForm(form => ({ ...form, vendorId: String(vendor.vendorId), contractId: '' })); setLicenseVendorQuery(vendor.name); setLicenseVendorPickerOpen(false) }}>
                          <span>{vendor.name}</span><small>vendor_id {vendor.vendorId}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <div className="vendor-picker">
                  <input
                    value={licenseContractQuery || (selectedVendorLicenseContracts.find(contract => String(contract.id) === vendorLicenseForm.contractId)?.contractNumber ?? '')}
                    disabled={!vendorLicenseForm.vendorId}
                    placeholder="Search or choose contract"
                    onChange={event => { setLicenseContractQuery(event.target.value); setLicenseContractPickerOpen(true); setVendorLicenseForm(form => ({ ...form, contractId: '' })) }}
                    onFocus={() => setLicenseContractPickerOpen(true)}
                    onBlur={() => window.setTimeout(() => setLicenseContractPickerOpen(false), 120)}
                  />
                  {licenseContractPickerOpen && vendorLicenseForm.vendorId && (
                    <div className="vendor-picker-menu">
                      <button type="button" className="vendor-picker-option" onMouseDown={event => event.preventDefault()} onClick={() => { setVendorLicenseForm(form => ({ ...form, contractId: '' })); setLicenseContractQuery(''); setLicenseContractPickerOpen(false) }}>
                        <span>Standalone vendor license</span>
                      </button>
                      {selectedVendorLicenseContracts.filter(contract => `${contract.contractNumber} ${contract.softwareName ?? ''}`.toLowerCase().includes(licenseContractQuery.toLowerCase())).slice(0, 12).map(contract => (
                        <button type="button" key={contract.id} className="vendor-picker-option" onMouseDown={event => event.preventDefault()} onClick={() => { setVendorLicenseForm(form => ({ ...form, contractId: String(contract.id) })); setLicenseContractQuery(contract.contractNumber); setLicenseContractPickerOpen(false) }}>
                          <span>{contract.contractNumber}</span><small>{contract.softwareName || 'Contract'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <input required placeholder="License name" value={vendorLicenseForm.licenseName} onChange={event => setVendorLicenseForm(form => ({ ...form, licenseName: event.target.value }))} />
                <input required placeholder="Software name" value={vendorLicenseForm.softwareName} onChange={event => setVendorLicenseForm(form => ({ ...form, softwareName: event.target.value }))} />
                <input placeholder="Version" value={vendorLicenseForm.version} onChange={event => setVendorLicenseForm(form => ({ ...form, version: event.target.value }))} />
                <select value={vendorLicenseForm.licenseType} onChange={event => setVendorLicenseForm(form => ({ ...form, licenseType: event.target.value as ContractLicense['licenseType'] }))}><option value="PER_SEAT">Per seat</option><option value="PER_DEVICE">Per device</option><option value="SITE_LICENSE">Site license</option><option value="SUBSCRIPTION">Subscription</option></select>
                <select value={vendorLicenseForm.status} onChange={event => setVendorLicenseForm(form => ({ ...form, status: event.target.value as ContractLicense['status'] }))}><option value="ACTIVE">Active</option><option value="PENDING">Pending</option><option value="EXPIRED">Expired</option></select>
                <select value={vendorLicenseForm.paymentMethod} onChange={event => setVendorLicenseForm(form => ({ ...form, paymentMethod: event.target.value as ContractLicense['paymentMethod'] }))}><option value="PURCHASE_ORDER">Purchase order</option><option value="CREDIT_CARD">Credit card</option></select>
                <input type="number" placeholder="Seats" value={vendorLicenseForm.seatsPurchased} onChange={event => setVendorLicenseForm(form => ({ ...form, seatsPurchased: event.target.value }))} />
                <input type="number" min="0" step="0.01" placeholder="Price" value={vendorLicenseForm.price} onChange={event => setVendorLicenseForm(form => ({ ...form, price: event.target.value }))} />
                <div className="dashboard-license-actions"><button type="button" className="contracts-clear-button" onClick={() => setTopAddLicenseOpen(false)}>Cancel</button><button type="submit" className="contracts-search-button" disabled={savingVendorLicense}>{savingVendorLicense ? 'Saving…' : 'Save license'}</button></div>
              </form>
            </div>
          </div>
        </div>
      )}

      {saveError && <p className="text-sm text-red-600">{saveError}</p>}

      {loading && <p className="text-sm text-[#6b6375]">Loading vendor insights…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!loading && !error && insights.length === 0 && (
        <div className="bg-white border border-[#e5e4e7] rounded-lg px-6 py-12 text-center">
          <p className="text-sm font-medium text-[#08060d]">{search.trim() ? 'No matching vendors' : 'No vendors yet'}</p>
          <p className="text-xs text-[#6b6375]">
            {search.trim() ? 'Try a vendor name, JDE number, contract, license, or software term.' : 'Add a vendor first, then create contracts with that vendor.'}
          </p>
        </div>
      )}

      {!loading && !error && visibleInsights.map(v => {
        const isOpen = expanded[v.vendorKey] ?? false
        const licensesForContract = (contractId: number) => v.licenses.filter(license => license.contractId === contractId)
        const standaloneLicenses = v.licenses.filter(license => license.contractId == null)
        return (
          <div key={v.vendorKey} className={`vendor-panel contracts-panel ${highlightedVendorId === v.vendorId ? 'record-highlight' : ''}`}>
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleVendor(v.vendorKey)}
              onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') toggleVendor(v.vendorKey) }}
              className="vendor-summary w-full px-4 py-4 border-b text-left"
            >
              <div className="vendor-summary-grid">
                <div className="vendor-info">
                  <div className="vendor-identity">
                    <p className="vendor-name">{v.vendorName}</p>
                    <span className="vendor-status-line">{v.contractCount} contracts · {v.licenses.length} licenses</span>
                  </div>
                  <div className="vendor-contact">
                    <span><small>JDE</small>{v.vendorJDENumber || '—'}</span>
                    <span><small>Email</small>{v.vendorContactEmail || '—'}</span>
                    <span><small>Address</small>{v.vendorAddress || '—'}</span>
                    <span><small>Website</small>{v.vendorWebsite || '—'}</span>
                  </div>
                </div>
                <div className="vendor-metrics">
                  <span><small>Licenses</small><strong>{fmtCurrency(v.totalLicensePrice)}</strong></span>
                  <span><small>Contracts</small><strong>{fmtCurrency(v.totalBudget)}</strong></span>
                </div>
                <div className="vendor-side-actions">
                  <button
                    type="button"
                    className="vendor-details-button"
                    aria-expanded={detailsOpen[v.vendorKey] ?? false}
                    onClick={event => {
                      event.stopPropagation()
                      setDetailsOpen(previous => ({ ...previous, [v.vendorKey]: !(previous[v.vendorKey] ?? false) }))
                    }}
                  >
                    Details
                  </button>
                </div>
              </div>
            </div>

            {detailsOpen[v.vendorKey] && (
              <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setDetailsOpen(previous => ({ ...previous, [v.vendorKey]: false })) }}>
                <div className="contracts-modal vendor-details-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-details-title">
                  <div className="contracts-modal-head">
                    <div>
                      <p className="vendor-details-kicker">VENDOR DETAILS</p>
                      <h2 id="vendor-details-title">{v.vendorName}</h2>
                    </div>
                    <button type="button" className="contracts-modal-close" onClick={() => setDetailsOpen(previous => ({ ...previous, [v.vendorKey]: false }))} aria-label="Close">×</button>
                  </div>
                  <div className="contracts-modal-body">
                    <div className="vendor-details-grid vendor-details-modal-grid">
                      <span><small>JDE number</small>{v.vendorJDENumber || '—'}</span>
                      <span><small>Contact email</small>{v.vendorContactEmail || '—'}</span>
                      <span><small>Website</small>{v.vendorWebsite || '—'}</span>
                      <span><small>Address</small>{v.vendorAddress || '—'}</span>
                      <span><small>Contracts</small>{v.contractCount}</span>
                      <span><small>Licenses</small>{v.licenses.length}</span>
                      <span><small>Contract value</small>{fmtCurrency(v.totalBudget)}</span>
                      <span><small>License value</small>{fmtCurrency(v.totalLicensePrice)}</span>
                    </div>
                  </div>
                  <div className="vendor-details-actions vendor-details-modal-actions">
                  <button
                    type="button"
                    className="vendor-edit-button"
                    onClick={event => {
                      event.stopPropagation()
                      setDetailsOpen(previous => ({ ...previous, [v.vendorKey]: false }))
                      if (v.vendorId != null) {
                        const vendorRecord = vendors.find(vendor => vendor.vendorId === v.vendorId) ?? {
                          vendorId: v.vendorId, tenantId: '', name: v.vendorName,
                          vendorJDENumber: v.vendorJDENumber, canonicalName: null, aliases: [],
                          contactEmail: v.vendorContactEmail, address: v.vendorAddress,
                          website: v.vendorWebsite, comments: null,
                        }
                        beginEditVendor(vendorRecord)
                      }
                    }}
                  >Edit vendor</button>
                  <button type="button" className="vendor-delete-button" disabled={deletingVendorId === v.vendorId} onClick={event => { event.stopPropagation(); void deleteVendor(v) }}>
                    {deletingVendorId === v.vendorId ? 'Deleting…' : 'Delete vendor'}
                  </button>
                  </div>
                </div>
              </div>
            )}

            {editingVendorId === (v.vendorId ?? null) && (() => {
              const draft = v.vendorId == null ? null : (vendorEditDraft[v.vendorId] ?? vendors.find(item => item.vendorId === v.vendorId))
              if (!draft) return null
              return (
                <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setEditingVendorId(null) }}>
                  <div className="contracts-modal vendor-edit-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-edit-title">
                    <div className="contracts-modal-head">
                      <div>
                        <p className="vendor-edit-kicker">VENDOR PROFILE</p>
                        <h2 id="vendor-edit-title">Edit {draft.name}</h2>
                      </div>
                      <button type="button" className="contracts-modal-close" onClick={() => setEditingVendorId(null)} aria-label="Close">×</button>
                    </div>
                    <form
                      className="contracts-modal-body vendor-edit-form"
                      onSubmit={(event) => {
                        event.preventDefault();
                        if (v.vendorId != null) void updateVendor(v.vendorId)
                      }}
                    >
                      <p className="vendor-edit-help">Update the vendor identity and contact details used across contracts and licenses.</p>
                      <div className="vendor-edit-fields">
                        <label>Vendor name<input value={draft.name} onChange={event => { if (v.vendorId != null) updateVendorDraft(v.vendorId, { name: event.target.value }) }} required /></label>
                        <label>JDE number<input value={draft.vendorJDENumber ?? ''} onChange={event => { if (v.vendorId != null) updateVendorDraft(v.vendorId, { vendorJDENumber: event.target.value || null }) }} /></label>
                        <label>Contact email<input type="email" value={draft.contactEmail ?? ''} onChange={event => { if (v.vendorId != null) updateVendorDraft(v.vendorId, { contactEmail: event.target.value || null }) }} /></label>
                        <label>Website<input value={draft.website ?? ''} onChange={event => { if (v.vendorId != null) updateVendorDraft(v.vendorId, { website: event.target.value || null }) }} /></label>
                        <label className="vendor-edit-wide">Address<input value={draft.address ?? ''} onChange={event => { if (v.vendorId != null) updateVendorDraft(v.vendorId, { address: event.target.value || null }) }} /></label>
                        <label className="vendor-edit-wide">Comments<textarea value={draft.comments ?? ''} onChange={event => { if (v.vendorId != null) updateVendorDraft(v.vendorId, { comments: event.target.value || null }) }} rows={4} /></label>
                      </div>
                      {saveError && <p className="vendor-edit-error">{saveError}</p>}
                      <div className="vendor-edit-actions">
                        <button type="button" className="contracts-clear-button" onClick={() => setEditingVendorId(null)}>Cancel</button>
                        <button type="button" className="vendor-delete-button" disabled={deletingVendorId === v.vendorId} onClick={() => void deleteVendor(v)}>
                          {deletingVendorId === v.vendorId ? 'Deleting…' : 'Delete vendor'}
                        </button>
                        <button type="submit" className="contracts-search-button" disabled={savingVendor}>{savingVendor ? 'Saving…' : 'Save vendor'}</button>
                      </div>
                    </form>
                  </div>
                </div>
              )
            })()}

            {isOpen && (
              <>
              <div className="contracts-table-wrap">
                <table className="vendor-contract-table contracts-table">
                  <thead>
                      <tr>
                      <th className="text-left px-4 py-2 font-medium text-[#08060d]">Contract #</th>
                      <th className="text-left px-4 py-2 font-medium text-[#08060d]">Software</th>
                      <th className="text-left px-4 py-2 font-medium text-[#08060d]">Start</th>
                      <th className="text-left px-4 py-2 font-medium text-[#08060d]">End</th>
                      <th className="text-left px-4 py-2 font-medium text-[#08060d]">Budget</th>
                      <th className="text-left px-4 py-2 font-medium text-[#08060d]">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {v.contracts.map(c => {
                      const contractLicenses = licensesForContract(c.id)
                      const contractLicenseTotal = contractLicenses.reduce((sum, license) => sum + (license.price ?? 0), 0)
                      const isContractOpen = expandedContracts[c.id] ?? false
                      return (
                        <Fragment key={c.id}>
                          <tr
                            className={`contract-row vendor-contract-parent ${isContractOpen ? 'vendor-contract-parent-open' : ''}`}
                            role="button"
                            tabIndex={0}
                            onClick={() => toggleContract(c.id)}
                            onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') toggleContract(c.id) }}
                          >
                            <td><div className="contract-number">{c.contractNumber}</div><div className="contract-subtitle">{c.softwareName || c.department || 'Contract details'}</div></td>
                            <td className="px-4 py-2 text-[#6b6375]">{c.softwareName || '—'}</td>
                            <td className="px-4 py-2 text-[#6b6375]">{c.startDate || '—'}</td>
                            <td className="px-4 py-2 text-[#6b6375]">{c.endDate || '—'}</td>
                            <td className="px-4 py-2 text-[#08060d]">{isContractOpen ? '▾ ' : '▸ '}{contractLicenses.length ? fmtCurrency(contractLicenseTotal) : fmtCurrency(c.value ?? 0)}</td>
                            <td className="px-4 py-2">{statusBadge(c.status)}</td>
                          </tr>
                          {isContractOpen && contractLicenses.map(license => (
                            <tr key={`contract-license-${license.licenseId}`} className="vendor-license-row">
                              <td><div className="contract-subtitle">License</div></td>
                              <td>{license.softwareName} — {license.licenseName}</td>
                              <td colSpan={2}>License details</td>
                              <td>{license.price == null ? '—' : fmtCurrency(license.price)}</td>
                              <td>{license.seatsPurchased == null ? '—' : `${license.seatsPurchased} seats`}</td>
                            </tr>
                          ))}
                        </Fragment>
                      )
                    })}
                    {standaloneLicenses.map(license => (
                      <tr key={`vendor-license-${license.licenseId}`} className="vendor-license-row">
                        <td><div className="contract-number">Vendor license</div><div className="contract-subtitle">No contract</div></td>
                        <td>{license.softwareName} — {license.licenseName}</td>
                        <td colSpan={2}>License details</td>
                        <td>{license.price == null ? '—' : fmtCurrency(license.price)}</td>
                        <td>{license.seatsPurchased == null ? '—' : `${license.seatsPurchased} seats`}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              </>
            )}
          </div>
        )
      })}
      {!loading && !error && insights.length > VENDOR_PAGE_SIZE && (
        <div className="pagination-controls">
          <button type="button" disabled={vendorPage === 0} onClick={() => setVendorPage(page => page - 1)}>Previous</button>
          <span>Page {vendorPage + 1} of {vendorPageCount}</span>
          <button type="button" disabled={vendorPage >= vendorPageCount - 1} onClick={() => setVendorPage(page => page + 1)}>Next</button>
        </div>
      )}
    </div>
  )
}
