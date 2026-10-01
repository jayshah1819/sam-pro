import { Fragment, useEffect, useMemo, useState, type FormEvent } from 'react'
import { client } from '../api'
import { DepartmentCell } from '../components'
import type { Contract, ContractLicense, Vendor } from '../types'
import '../styles/contracts.css'
import { downloadExcel } from '../utils/exportExcel'
import { updateContractDepartment, updateStandaloneLicenseLocation } from '../utils/departments'

function fmtCurrency(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

const LICENSE_PAGE_SIZE = 20

type LicenseForm = {
  vendorId: string
  contractId: string
  location: string
  licenseName: string
  itOwner: string
  businessOwner: string
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
  softwareCode: string
  functionalGrouping: string
  functionalOwner: string
  confidenceLevel: string
  manufacturerName: string
  systemCategory: string
  systemCategorization: string
  businessCriticality: string
  systemStrategy: string
  erpSystem: string
  annualInfrastructureCost: string
  annualCostNonLicense: string
  annualLicenseCost: string
  annualCostTotal: string
  acsBudget: string
  numberOfActiveUsers: string
  numberOfLicensesOwned: string
  proposedFunctionGroupOwner: string
  billingVendor: string
  billingVendorId: string
  businessFunction: string
  numberOfUsers: string
  budgetOwner: string
  primaryItGroup: string
  primaryItGroupLeadership: string
  contractDuration: string
  paymentSchedule: string
  currency: string
  criticalityLevels: string
  description: string
}

const EMPTY_FORM: LicenseForm = {
  vendorId: '', contractId: '', location: '', licenseName: '', itOwner: '', businessOwner: '', comments: '', softwareName: '', version: '',
  licenseType: 'PER_SEAT', status: 'ACTIVE', paymentMethod: 'PURCHASE_ORDER', seatsPurchased: '', price: '', startDate: '', expiryDate: '',
  softwareCode: '', functionalGrouping: '', functionalOwner: '', confidenceLevel: '', manufacturerName: '', systemCategory: '',
  systemCategorization: '', businessCriticality: '', systemStrategy: '', erpSystem: '', annualInfrastructureCost: '',
  annualCostNonLicense: '', annualLicenseCost: '', annualCostTotal: '', acsBudget: '', numberOfActiveUsers: '',
  numberOfLicensesOwned: '', proposedFunctionGroupOwner: '', billingVendor: '', billingVendorId: '', businessFunction: '',
  numberOfUsers: '', budgetOwner: '', primaryItGroup: '', primaryItGroupLeadership: '', contractDuration: '',
  paymentSchedule: '', currency: '', criticalityLevels: '', description: '',
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
    Promise.allSettled([
      client.get<ContractLicense[]>('/contracts/licenses/all'),
      client.get<{ content: Vendor[] }>('/vendors', { params: { page: 0, size: 500 } }),
      client.get<{ content: Contract[] }>('/contracts', { params: { page: 0, size: 500 } }),
    ])
      .then(([licenseResult, vendorResult, contractResult]) => {
        const failures: string[] = []
        if (licenseResult.status === 'fulfilled') setLicenses(licenseResult.value.data ?? [])
        else failures.push('licenses')
        if (vendorResult.status === 'fulfilled') setVendors(vendorResult.value.data.content ?? [])
        else failures.push('vendors')
        if (contractResult.status === 'fulfilled') setContracts(contractResult.value.data.content ?? [])
        else failures.push('contracts')
        if (failures.length) setError(`Failed to load ${failures.join(', ')}.`)
      })
      .finally(() => setLoading(false))
  }, [])

  const contractById = useMemo(() => new Map(contracts.map(contract => [contract.id, contract])), [contracts])

  function handleDepartmentSaved(updated: Contract) {
    setContracts(prev => prev.map(contract => contract.id === updated.id ? updated : contract))
    setLicenses(prev => prev.map(license => license.contractId === updated.id ? { ...license, location: updated.location } : license))
  }

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
      license.location ?? '',
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
    downloadExcel('licenses.xlsx', 'Licenses', visibleLicenses.map(license => ({
      'License name': license.licenseName,
      Vendor: license.vendorName,
      'Vendor ID': license.vendorId ?? '',
      'IT owner': license.itOwner ?? '',
      'Business owner': license.businessOwner ?? '',
      'Software name': license.softwareName,
      'Software code': license.softwareCode ?? '',
      'Contract ID': license.contractId ?? '',
      Department: license.location ?? '',
      Type: license.licenseType,
      Status: license.status,
      Payment: license.paymentMethod === 'PURCHASE_ORDER' ? 'PO' : 'Credit card',
      Seats: license.seatsPurchased ?? '',
      Price: license.price ?? '',
      Start: license.startDate,
      Expiry: license.expiryDate,
      'Functional grouping': license.functionalGrouping ?? '',
      'Functional owner': license.functionalOwner ?? '',
      'Confidence level': license.confidenceLevel ?? '',
      'Manufacturer name': license.manufacturerName ?? '',
      'System category': license.systemCategory ?? '',
      'System categorization': license.systemCategorization ?? '',
      'Business criticality': license.businessCriticality ?? '',
      'System strategy': license.systemStrategy ?? '',
      'ERP system': license.erpSystem ?? '',
      'Annual infrastructure cost': license.annualInfrastructureCost ?? '',
      'Annual cost (non-license)': license.annualCostNonLicense ?? '',
      'Annual license cost': license.annualLicenseCost ?? '',
      'Annual cost - total': license.annualCostTotal ?? '',
      'ACS budget': license.acsBudget ?? '',
      'Number of active users': license.numberOfActiveUsers ?? '',
      'Number of licenses owned': license.numberOfLicensesOwned ?? '',
      'Proposed function group/dept owner': license.proposedFunctionGroupOwner ?? '',
      'Billing vendor': license.billingVendor ?? '',
      'Billing vendor ID': license.billingVendorId ?? '',
      'Business function': license.businessFunction ?? '',
      'Number of users': license.numberOfUsers ?? '',
      'Budget owner': license.budgetOwner ?? '',
      'Primary IT group': license.primaryItGroup ?? '',
      'Primary IT group leadership': license.primaryItGroupLeadership ?? '',
      'Contract duration': license.contractDuration ?? '',
      'Payment schedule': license.paymentSchedule ?? '',
      Currency: license.currency ?? '',
      'Criticality levels': license.criticalityLevels ?? '',
      Description: license.description ?? '',
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
    if (!form.vendorId) {
      setError('Select a vendor before saving this license.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const payload = {
        licenseName: form.licenseName.trim(),
        itOwner: form.itOwner.trim() || null,
        businessOwner: form.businessOwner.trim() || null,
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
        location: form.contractId ? null : (form.location.trim() || null),
        softwareCode: form.softwareCode.trim() || null,
        functionalGrouping: form.functionalGrouping.trim() || null,
        functionalOwner: form.functionalOwner.trim() || null,
        confidenceLevel: form.confidenceLevel.trim() || null,
        manufacturerName: form.manufacturerName.trim() || null,
        systemCategory: form.systemCategory.trim() || null,
        systemCategorization: form.systemCategorization.trim() || null,
        businessCriticality: form.businessCriticality.trim() || null,
        systemStrategy: form.systemStrategy.trim() || null,
        erpSystem: form.erpSystem.trim() || null,
        annualInfrastructureCost: form.annualInfrastructureCost.trim() ? Number(form.annualInfrastructureCost) : null,
        annualCostNonLicense: form.annualCostNonLicense.trim() ? Number(form.annualCostNonLicense) : null,
        annualLicenseCost: form.annualLicenseCost.trim() ? Number(form.annualLicenseCost) : null,
        annualCostTotal: form.annualCostTotal.trim() ? Number(form.annualCostTotal) : null,
        acsBudget: form.acsBudget.trim() ? Number(form.acsBudget) : null,
        numberOfActiveUsers: form.numberOfActiveUsers.trim() ? Number(form.numberOfActiveUsers) : null,
        numberOfLicensesOwned: form.numberOfLicensesOwned.trim() ? Number(form.numberOfLicensesOwned) : null,
        proposedFunctionGroupOwner: form.proposedFunctionGroupOwner.trim() || null,
        billingVendor: form.billingVendor.trim() || null,
        billingVendorId: form.billingVendorId.trim() ? Number(form.billingVendorId) : null,
        businessFunction: form.businessFunction.trim() || null,
        numberOfUsers: form.numberOfUsers.trim() ? Number(form.numberOfUsers) : null,
        budgetOwner: form.budgetOwner.trim() || null,
        primaryItGroup: form.primaryItGroup.trim() || null,
        primaryItGroupLeadership: form.primaryItGroupLeadership.trim() || null,
        contractDuration: form.contractDuration.trim() || null,
        paymentSchedule: form.paymentSchedule.trim() || null,
        currency: form.currency.trim() || null,
        criticalityLevels: form.criticalityLevels.trim() || null,
        description: form.description.trim() || null,
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
      location: license.contractId == null ? (license.location ?? '') : '',
      licenseName: license.licenseName,
      itOwner: license.itOwner ?? '',
      businessOwner: license.businessOwner ?? '',
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
      softwareCode: license.softwareCode ?? '',
      functionalGrouping: license.functionalGrouping ?? '',
      functionalOwner: license.functionalOwner ?? '',
      confidenceLevel: license.confidenceLevel ?? '',
      manufacturerName: license.manufacturerName ?? '',
      systemCategory: license.systemCategory ?? '',
      systemCategorization: license.systemCategorization ?? '',
      businessCriticality: license.businessCriticality ?? '',
      systemStrategy: license.systemStrategy ?? '',
      erpSystem: license.erpSystem ?? '',
      annualInfrastructureCost: license.annualInfrastructureCost == null ? '' : String(license.annualInfrastructureCost),
      annualCostNonLicense: license.annualCostNonLicense == null ? '' : String(license.annualCostNonLicense),
      annualLicenseCost: license.annualLicenseCost == null ? '' : String(license.annualLicenseCost),
      annualCostTotal: license.annualCostTotal == null ? '' : String(license.annualCostTotal),
      acsBudget: license.acsBudget == null ? '' : String(license.acsBudget),
      numberOfActiveUsers: license.numberOfActiveUsers == null ? '' : String(license.numberOfActiveUsers),
      numberOfLicensesOwned: license.numberOfLicensesOwned == null ? '' : String(license.numberOfLicensesOwned),
      proposedFunctionGroupOwner: license.proposedFunctionGroupOwner ?? '',
      billingVendor: license.billingVendor ?? '',
      billingVendorId: license.billingVendorId == null ? '' : String(license.billingVendorId),
      businessFunction: license.businessFunction ?? '',
      numberOfUsers: license.numberOfUsers == null ? '' : String(license.numberOfUsers),
      budgetOwner: license.budgetOwner ?? '',
      primaryItGroup: license.primaryItGroup ?? '',
      primaryItGroupLeadership: license.primaryItGroupLeadership ?? '',
      contractDuration: license.contractDuration ?? '',
      paymentSchedule: license.paymentSchedule ?? '',
      currency: license.currency ?? '',
      criticalityLevels: license.criticalityLevels ?? '',
      description: license.description ?? '',
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
                          <span>{contract.contractNumber}</span><small>{contract.softwareName || contract.location || 'Contract'}</small>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <label className="dashboard-license-readonly-field">
                  <span>Department</span>
                  {form.contractId ? (
                    <input
                      readOnly
                      disabled
                      className="contracts-field-readonly"
                      value={selectedVendorContracts.find(contract => String(contract.id) === form.contractId)?.location || 'No department set on contract'}
                      title="Department follows the linked contract. Change it from the Contracts or Departments tab."
                    />
                  ) : (
                    <input
                      placeholder="e.g. FD"
                      value={form.location}
                      onChange={event => setForm(previous => ({ ...previous, location: event.target.value }))}
                    />
                  )}
                </label>
                <input required placeholder="License name" value={form.licenseName} onChange={event => setForm(previous => ({ ...previous, licenseName: event.target.value }))} />
                <input placeholder="IT owner" value={form.itOwner} onChange={event => setForm(previous => ({ ...previous, itOwner: event.target.value }))} />
                <input placeholder="Business owner" value={form.businessOwner} onChange={event => setForm(previous => ({ ...previous, businessOwner: event.target.value }))} />
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
                <fieldset className="license-extended-fields">
                  <legend>Additional details</legend>
                  <input placeholder="Software code (auto-set from Software ID after save)" value={form.softwareCode} disabled title="Automatically set to the software's ID so it always links to Finance; not editable." />
                  <input placeholder="Functional grouping" value={form.functionalGrouping} onChange={event => setForm(previous => ({ ...previous, functionalGrouping: event.target.value }))} />
                  <input placeholder="Functional owner" value={form.functionalOwner} onChange={event => setForm(previous => ({ ...previous, functionalOwner: event.target.value }))} />
                  <input placeholder="Confidence level" value={form.confidenceLevel} onChange={event => setForm(previous => ({ ...previous, confidenceLevel: event.target.value }))} />
                  <input placeholder="Manufacturer name" value={form.manufacturerName} onChange={event => setForm(previous => ({ ...previous, manufacturerName: event.target.value }))} />
                  <input placeholder="System category" value={form.systemCategory} onChange={event => setForm(previous => ({ ...previous, systemCategory: event.target.value }))} />
                  <input placeholder="System categorization" value={form.systemCategorization} onChange={event => setForm(previous => ({ ...previous, systemCategorization: event.target.value }))} />
                  <input placeholder="Business criticality" value={form.businessCriticality} onChange={event => setForm(previous => ({ ...previous, businessCriticality: event.target.value }))} />
                  <input placeholder="System strategy" value={form.systemStrategy} onChange={event => setForm(previous => ({ ...previous, systemStrategy: event.target.value }))} />
                  <input placeholder="ERP system" value={form.erpSystem} onChange={event => setForm(previous => ({ ...previous, erpSystem: event.target.value }))} />
                  <input type="number" min="0" step="0.01" placeholder="Annual infrastructure cost" value={form.annualInfrastructureCost} onChange={event => setForm(previous => ({ ...previous, annualInfrastructureCost: event.target.value }))} />
                  <input type="number" min="0" step="0.01" placeholder="Annual cost (non-license)" value={form.annualCostNonLicense} onChange={event => setForm(previous => ({ ...previous, annualCostNonLicense: event.target.value }))} />
                  <input type="number" min="0" step="0.01" placeholder="Annual license cost" value={form.annualLicenseCost} onChange={event => setForm(previous => ({ ...previous, annualLicenseCost: event.target.value }))} />
                  <input type="number" min="0" step="0.01" placeholder="Annual cost - total" value={form.annualCostTotal} onChange={event => setForm(previous => ({ ...previous, annualCostTotal: event.target.value }))} />
                  <input type="number" min="0" step="0.01" placeholder="ACS budget" value={form.acsBudget} onChange={event => setForm(previous => ({ ...previous, acsBudget: event.target.value }))} />
                  <input type="number" min="0" placeholder="Number of active users" value={form.numberOfActiveUsers} onChange={event => setForm(previous => ({ ...previous, numberOfActiveUsers: event.target.value }))} />
                  <input type="number" min="0" placeholder="Number of licenses owned" value={form.numberOfLicensesOwned} onChange={event => setForm(previous => ({ ...previous, numberOfLicensesOwned: event.target.value }))} />
                  <input placeholder="Proposed function group/dept owner" value={form.proposedFunctionGroupOwner} onChange={event => setForm(previous => ({ ...previous, proposedFunctionGroupOwner: event.target.value }))} />
                  <input placeholder="Billing vendor" value={form.billingVendor} onChange={event => setForm(previous => ({ ...previous, billingVendor: event.target.value }))} />
                  <input type="number" placeholder="Billing vendor ID" value={form.billingVendorId} onChange={event => setForm(previous => ({ ...previous, billingVendorId: event.target.value }))} />
                  <input placeholder="Business function" value={form.businessFunction} onChange={event => setForm(previous => ({ ...previous, businessFunction: event.target.value }))} />
                  <input type="number" min="0" placeholder="Number of users" value={form.numberOfUsers} onChange={event => setForm(previous => ({ ...previous, numberOfUsers: event.target.value }))} />
                  <input placeholder="Budget owner" value={form.budgetOwner} onChange={event => setForm(previous => ({ ...previous, budgetOwner: event.target.value }))} />
                  <input placeholder="Primary IT group" value={form.primaryItGroup} onChange={event => setForm(previous => ({ ...previous, primaryItGroup: event.target.value }))} />
                  <input placeholder="Primary IT group leadership" value={form.primaryItGroupLeadership} onChange={event => setForm(previous => ({ ...previous, primaryItGroupLeadership: event.target.value }))} />
                  <input placeholder="Contract duration" value={form.contractDuration} onChange={event => setForm(previous => ({ ...previous, contractDuration: event.target.value }))} />
                  <input placeholder="Payment schedule" value={form.paymentSchedule} onChange={event => setForm(previous => ({ ...previous, paymentSchedule: event.target.value }))} />
                  <input placeholder="Currency" value={form.currency} onChange={event => setForm(previous => ({ ...previous, currency: event.target.value }))} />
                  <input placeholder="Criticality levels" value={form.criticalityLevels} onChange={event => setForm(previous => ({ ...previous, criticalityLevels: event.target.value }))} />
                  <textarea placeholder="Description" rows={2} value={form.description} onChange={event => setForm(previous => ({ ...previous, description: event.target.value }))} className="contracts-comments-field license-extended-description" />
                </fieldset>
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
                  <th>Business owner</th>
                  <th>Vendor</th>
                  <th>Vendor ID</th>
                  <th>Software</th>
                  <th>Software code</th>
                  <th>Contract ID</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Seats</th>
                  <th>Price</th>
                  <th>Payment</th>
                  <th>Start</th>
                  <th>Expiry</th>
                  <th>Functional grouping</th>
                  <th>Functional owner</th>
                  <th>Confidence level</th>
                  <th>Manufacturer name</th>
                  <th>System category</th>
                  <th>System categorization</th>
                  <th>Business criticality</th>
                  <th>System strategy</th>
                  <th>ERP system</th>
                  <th>Annual infra cost</th>
                  <th>Annual cost (non-license)</th>
                  <th>Annual license cost</th>
                  <th>Annual cost - total</th>
                  <th>ACS budget</th>
                  <th>Active users</th>
                  <th>Licenses owned</th>
                  <th>Proposed function group/dept owner</th>
                  <th>Billing vendor</th>
                  <th>Billing vendor ID</th>
                  <th>Business function</th>
                  <th>Number of users</th>
                  <th>Budget owner</th>
                  <th>Primary IT group</th>
                  <th>Primary IT group leadership</th>
                  <th>Contract duration</th>
                  <th>Payment schedule</th>
                  <th>Currency</th>
                  <th>Criticality levels</th>
                  <th>Description</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {pagedLicenses.map(license => (
                  <tr key={license.licenseId} className="contract-row">
                    <td className="font-semibold">{license.licenseName}</td>
                    <td>{license.itOwner || '—'}</td>
                    <td>{license.businessOwner || '—'}</td>
                    <td>{license.vendorName || '—'}</td>
                    <td className="font-mono text-xs">{license.vendorId ?? '—'}</td>
                    <td>{license.softwareName}</td>
                    <td className="font-mono text-xs">{license.softwareCode || '—'}</td>
                    <td className="font-mono text-xs">{license.contractId ?? '—'}</td>
                    <td>
                      <DepartmentCell
                        value={license.contractId == null ? (license.location ?? '') : (contractById.get(license.contractId)?.location ?? '')}
                        onSave={async value => {
                          if (license.contractId == null) {
                            const updated = await updateStandaloneLicenseLocation(license.licenseId, value)
                            setLicenses(prev => prev.map(l => l.licenseId === updated.licenseId ? updated : l))
                          } else {
                            const contract = contractById.get(license.contractId)
                            if (!contract) return
                            handleDepartmentSaved(await updateContractDepartment(contract, value))
                          }
                        }}
                      />
                    </td>
                    <td>{license.licenseType.replace('_', ' ')}</td>
                    <td>{license.seatsPurchased ?? '—'}</td>
                    <td>{fmtCurrency(license.price)}</td>
                    <td><span className={license.paymentMethod === 'CREDIT_CARD' ? 'payment-badge payment-credit-card' : 'payment-badge'}>{license.paymentMethod === 'CREDIT_CARD' ? 'Credit card' : 'PO'}</span></td>
                    <td>{license.startDate || '—'}</td>
                    <td>{license.expiryDate || '—'}</td>
                    <td>{license.functionalGrouping || '—'}</td>
                    <td>{license.functionalOwner || '—'}</td>
                    <td>{license.confidenceLevel || '—'}</td>
                    <td>{license.manufacturerName || '—'}</td>
                    <td>{license.systemCategory || '—'}</td>
                    <td>{license.systemCategorization || '—'}</td>
                    <td>{license.businessCriticality || '—'}</td>
                    <td>{license.systemStrategy || '—'}</td>
                    <td>{license.erpSystem || '—'}</td>
                    <td>{fmtCurrency(license.annualInfrastructureCost)}</td>
                    <td>{fmtCurrency(license.annualCostNonLicense)}</td>
                    <td>{fmtCurrency(license.annualLicenseCost)}</td>
                    <td>{fmtCurrency(license.annualCostTotal)}</td>
                    <td>{fmtCurrency(license.acsBudget)}</td>
                    <td>{license.numberOfActiveUsers ?? '—'}</td>
                    <td>{license.numberOfLicensesOwned ?? '—'}</td>
                    <td>{license.proposedFunctionGroupOwner || '—'}</td>
                    <td>{license.billingVendor || '—'}</td>
                    <td className="font-mono text-xs">{license.billingVendorId ?? '—'}</td>
                    <td>{license.businessFunction || '—'}</td>
                    <td>{license.numberOfUsers ?? '—'}</td>
                    <td>{license.budgetOwner || '—'}</td>
                    <td>{license.primaryItGroup || '—'}</td>
                    <td>{license.primaryItGroupLeadership || '—'}</td>
                    <td>{license.contractDuration || '—'}</td>
                    <td>{license.paymentSchedule || '—'}</td>
                    <td>{license.currency || '—'}</td>
                    <td>{license.criticalityLevels || '—'}</td>
                    <td className="license-description-cell">{license.description || '—'}</td>
                    <td><button type="button" className="license-edit-button" onClick={() => editLicense(license)}>Edit</button></td>
                  </tr>
                ))}
                {visibleLicenses.length === 0 && (
                  <tr><td colSpan={44} className="py-10 text-center text-[#6b6375]">No licenses found.</td></tr>
                )}
              </tbody>
            </table> : <table className="contracts-table licenses-table">
              <thead><tr><th>Software</th><th>Software code</th><th>Vendor</th><th>Vendor ID</th><th>Licenses</th><th>License names</th><th>Contracts</th><th>Total value</th></tr></thead>
              <tbody>
                {softwareGroups.map(group => {
                  const isOpen = expandedSoftware[group.key] ?? false
                  return (
                    <Fragment key={group.key}>
                      <tr className={`contract-row software-parent-row ${isOpen ? 'software-parent-row-open' : ''}`} role="button" tabIndex={0} onClick={() => setExpandedSoftware(previous => ({ ...previous, [group.key]: !isOpen }))} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setExpandedSoftware(previous => ({ ...previous, [group.key]: !isOpen })) }}>
                        <td className="font-semibold">{isOpen ? '▾' : '▸'} {group.softwareName}</td>
                        <td className="font-mono text-xs">{group.licenses[0]?.softwareCode || '—'}</td>
                        <td>{group.vendorName}</td>
                        <td className="font-mono text-xs">{group.vendor?.vendorId ?? '—'}</td>
                        <td>{group.licenses.length}</td>
                        <td className="software-license-names">{group.licenses.map(license => license.licenseName).join(', ')}</td>
                        <td>{new Set(group.licenses.filter(license => license.contractId != null).map(license => license.contractId)).size}</td>
                        <td>{fmtCurrency(group.totalPrice)}</td>
                      </tr>
                      {isOpen && (
                        <tr className="software-vendor-detail-row">
                          <td colSpan={8}>
                            Vendor details: <strong>{group.vendorName}</strong> · JDE {group.vendor?.vendorJDENumber || '—'} · {group.vendor?.contactEmail || '—'} · {group.vendor?.address || '—'} · {group.vendor?.website || '—'}
                          </td>
                        </tr>
                      )}
                      {isOpen && group.licenses.map(license => (
                        <tr key={`${group.key}-${license.licenseId}`} className="software-license-detail-row">
                          <td colSpan={8}>
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
                {softwareGroups.length === 0 && <tr><td colSpan={8} className="py-10 text-center text-[#6b6375]">No software found.</td></tr>}
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
