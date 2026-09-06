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
  const [expandedContracts, setExpandedContracts] = useState<Record<number, boolean>>({})
  const [searchText, setSearchText] = useState('')
  const [search, setSearch] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [vendorJDENumber, setVendorJDENumber] = useState('')
  const [vendorContactEmail, setVendorContactEmail] = useState('')
  const [vendorAddress, setVendorAddress] = useState('')
  const [vendorComments, setVendorComments] = useState('')
  const [savingVendor, setSavingVendor] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [vendorLicenseForm, setVendorLicenseForm] = useState<VendorLicenseForm>(EMPTY_VENDOR_LICENSE_FORM)
  const [savingVendorLicense, setSavingVendorLicense] = useState(false)
  const [topAddLicenseOpen, setTopAddLicenseOpen] = useState(false)
  const [vendorPage, setVendorPage] = useState(0)

  useEffect(() => {
    setLoading(true)
    setError(null)

    Promise.all([
      client.get<{ content: Vendor[] }>('/vendors', { params: { page: 0, size: 500 } }),
      client.get<{ content: Contract[] }>('/contracts', { params: { page: 0, size: 500 } }),
      client.get<ContractLicense[]>('/contracts/licenses/all'),
    ])
      .then(([vendorResponse, contractResponse, licenseResponse]) => {
        setVendors(vendorResponse.data.content ?? [])
        setContracts(contractResponse.data.content ?? [])
        setLicenses(licenseResponse.data ?? [])
      })
      .catch(() => setError('Failed to load vendors or contracts.'))
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
        comments: vendorComments.trim() || null,
      })
      setVendors(prev => [data, ...prev])
      setVendorName('')
      setVendorJDENumber('')
      setVendorContactEmail('')
      setVendorAddress('')
      setVendorComments('')
    } catch (err: any) {
      const message = err?.response?.data?.message
      setSaveError(typeof message === 'string' ? message : 'Failed to add vendor.')
    } finally {
      setSavingVendor(false)
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

  function toggleVendor(vendorKey: string) {
    setExpanded(prev => ({ ...prev, [vendorKey]: !prev[vendorKey] }))
  }

  function toggleContract(contractId: number) {
    setExpandedContracts(prev => ({ ...prev, [contractId]: !prev[contractId] }))
  }

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
          <button type="button" className="contracts-add-button" onClick={() => setTopAddLicenseOpen(true)}>+ Add license</button>
        </div>
      </div>

      {topAddLicenseOpen && (
        <div className="contracts-modal-overlay" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setTopAddLicenseOpen(false) }}>
          <div className="contracts-modal" role="dialog" aria-modal="true" aria-labelledby="vendor-license-title">
            <div className="contracts-modal-head"><h2 id="vendor-license-title">Add license</h2><button type="button" className="contracts-modal-close" onClick={() => setTopAddLicenseOpen(false)} aria-label="Close">×</button></div>
            <div className="contracts-modal-body">
              <form onSubmit={event => { const vendorId = Number(vendorLicenseForm.vendorId); if (vendorId) void addVendorLicense(event, vendorId) }} className="dashboard-license-form">
                <select required value={vendorLicenseForm.vendorId} onChange={event => setVendorLicenseForm(form => ({ ...form, vendorId: event.target.value, contractId: '' }))}><option value="">Choose vendor</option>{vendors.map(vendor => <option key={vendor.vendorId} value={vendor.vendorId ?? ''}>{vendor.name}</option>)}</select>
                <select value={vendorLicenseForm.contractId} disabled={!vendorLicenseForm.vendorId} onChange={event => setVendorLicenseForm(form => ({ ...form, contractId: event.target.value }))}><option value="">Standalone vendor license</option>{contracts.filter(contract => contract.vendorId === Number(vendorLicenseForm.vendorId)).map(contract => <option key={contract.id} value={contract.id}>{contract.contractNumber}</option>)}</select>
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
          <div key={v.vendorKey} className="vendor-panel contracts-panel">
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
              </div>
            </div>

            {isOpen && (
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
