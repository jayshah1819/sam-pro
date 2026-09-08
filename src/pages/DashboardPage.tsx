import { Fragment, useEffect, useState } from 'react'
import { client } from '../api'
import type { Contract, ContractLicense, Vendor } from '../types'
import '../styles/contracts.css'

interface SeatGroup {
  key: string
  vendorName: string
  licenseName: string
  totalSeats: number
  licenses: ContractLicense[]
}

function money(value: number | null) {
  if (value == null) return '—'
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

function expiryLabel(value: string) {
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function asArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? value as T[] : []
}

export default function DashboardPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [licenses, setLicenses] = useState<ContractLicense[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [renewingLicenseId, setRenewingLicenseId] = useState<number | null>(null)
  const [renewingContractId, setRenewingContractId] = useState<number | null>(null)
  const [renewalContractCandidate, setRenewalContractCandidate] = useState<Contract | null>(null)
  const [renewalCandidate, setRenewalCandidate] = useState<ContractLicense | null>(null)
  const [expandedSeatKey, setExpandedSeatKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    Promise.allSettled([
      client.get<{ content: Contract[] }>('/contracts', { params: { page: 0, size: 500 } }),
      client.get<ContractLicense[]>('/contracts/licenses/all'),
      client.get<{ content: Vendor[] }>('/vendors', { params: { page: 0, size: 500 } }),
    ])
      .then(([contractResult, licenseResult, vendorResult]) => {
        const failures: string[] = []
        if (contractResult.status === 'fulfilled') setContracts(asArray<Contract>(contractResult.value.data.content))
        else failures.push('contracts')
        if (licenseResult.status === 'fulfilled') setLicenses(asArray<ContractLicense>(licenseResult.value.data))
        else failures.push('licenses')
        if (vendorResult.status === 'fulfilled') setVendors(asArray<Vendor>(vendorResult.value.data.content))
        else failures.push('vendors')
        if (failures.length) setError(`Failed to load ${failures.join(', ')}.`)
      })
  }, [])

  const cutoff = new Date()
  cutoff.setMonth(cutoff.getMonth() + 2)
  const cutoffDate = cutoff.toISOString().slice(0, 10)
  const today = new Date().toISOString().slice(0, 10)
  const urgentCutoff = new Date()
  urgentCutoff.setDate(urgentCutoff.getDate() + 15)
  const urgentDate = urgentCutoff.toISOString().slice(0, 10)
  const expiringLicenses = licenses.filter(license => license.expiryDate >= today && license.expiryDate <= cutoffDate)
  const expiringContracts = contracts.filter(contract => contract.endDate >= today && contract.endDate <= cutoffDate)
  const creditCardLicenses = licenses.filter(license => license.paymentMethod === 'CREDIT_CARD')
  const expiredLicenses = licenses.filter(license => license.expiryDate < today)
  const pendingLicenses = licenses.filter(license => license.status === 'PENDING')
  const contractNumberById = new Map(contracts.map(contract => [String(contract.id), contract.contractNumber]))
  // Same vendor + software + licence name rolls up into one seat total, however many contracts it spans
  const seatGroups: SeatGroup[] = Array.from(licenses.reduce((groups, license) => {
    const vendorName = (license.vendorName || 'Unknown vendor').trim()
    const licenseName = (license.licenseName || license.softwareName || 'Unnamed').trim()
    const softwareName = (license.softwareName || '').trim()
    const key = `${vendorName.toLowerCase()}::${softwareName.toLowerCase()}::${licenseName.toLowerCase()}`
    const existing = groups.get(key)
    if (existing) {
      existing.totalSeats += license.seatsPurchased ?? 0
      existing.licenses.push(license)
    } else {
      groups.set(key, { key, vendorName, licenseName, totalSeats: license.seatsPurchased ?? 0, licenses: [license] })
    }
    return groups
  }, new Map<string, SeatGroup>()).values())
    .sort((a, b) => b.totalSeats - a.totalSeats)
    .slice(0, 10)
  const largestSeatTotal = Math.max(...seatGroups.map(group => group.totalSeats), 0)
  const chartStep = Math.max(10, Math.ceil((largestSeatTotal / 4) / 10) * 10)
  const chartMax = Math.max(chartStep * 4, 10)

  function toggleSeatGroup(key: string) {
    setExpandedSeatKey(previous => previous === key ? null : key)
  }

  async function renewLicense(license: ContractLicense) {
    const vendor = vendors.find(option => option.name.toLowerCase() === license.vendorName.toLowerCase())
    if (vendor?.vendorId == null) return
    setRenewingLicenseId(license.licenseId)
    try {
      const { data } = await client.put<ContractLicense>(`/vendors/${vendor.vendorId}/licenses/${license.licenseId}`, {
        licenseName: license.licenseName,
        softwareName: license.softwareName,
        version: license.version,
        licenseType: license.licenseType,
        status: 'ACTIVE',
        paymentMethod: license.paymentMethod,
        seatsPurchased: license.seatsPurchased,
        price: license.price,
        contractId: license.contractId,
        renew: true,
      })
      setLicenses(previous => previous.map(item => item.licenseId === license.licenseId ? data : item))
    } catch {
      setError('Failed to renew license.')
    } finally {
      setRenewingLicenseId(null)
    }
  }

  async function renewContract(contract: Contract) {
    setRenewingContractId(contract.id)
    try {
      const nextStartDate = contract.endDate
      const nextEndDate = new Date(`${contract.endDate}T00:00:00`)
      nextEndDate.setFullYear(nextEndDate.getFullYear() + 1)
      const { data } = await client.put<Contract>(`/contracts/${contract.id}`, {
        contractNumber: contract.contractNumber,
        vendorId: contract.vendorId,
        department: contract.department,
        softwareName: contract.softwareName,
        startDate: nextStartDate,
        endDate: nextEndDate.toISOString().slice(0, 10),
        status: 'ACTIVE',
        value: contract.value,
      })
      setContracts(previous => previous.map(item => item.id === contract.id ? data : item))
    } catch {
      setError('Failed to renew contract.')
    } finally {
      setRenewingContractId(null)
    }
  }

  return (
    <div className="dashboard-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Dashboard</h1>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="dashboard-metrics dashboard-license-metrics">
        <div><span>Total licenses</span><strong>{licenses.length}</strong></div>
        <div><span>Expired licenses</span><strong>{expiredLicenses.length}</strong></div>
        <div><span>Pending approval</span><strong>{pendingLicenses.length}</strong></div>
      </div>

      <div className="dashboard-alert-grid">
        <section className="contracts-panel dashboard-alert-panel">
          <header><h2>Expiring within 2 months</h2><strong>{expiringLicenses.length + expiringContracts.length}</strong></header>
          {(renewalCandidate || renewalContractCandidate) && (
            <div className="dashboard-renewal-alert" role="alertdialog" aria-modal="true" aria-labelledby="renewal-title">
              <div><h2 id="renewal-title">Renew {renewalCandidate ? 'license' : 'contract'}?</h2><p>{renewalCandidate?.licenseName ?? renewalContractCandidate?.contractNumber} · {renewalCandidate?.vendorName ?? renewalContractCandidate?.vendorName}</p><small>New period starts on the current expiry date and runs for one year.</small></div>
              <div className="dashboard-renewal-actions"><button type="button" className="contracts-clear-button" onClick={() => { setRenewalCandidate(null); setRenewalContractCandidate(null) }}>No</button><button type="button" className="license-renew-button" onClick={() => { const license = renewalCandidate; const contract = renewalContractCandidate; setRenewalCandidate(null); setRenewalContractCandidate(null); if (license) void renewLicense(license); if (contract) void renewContract(contract) }}>Yes</button></div>
            </div>
          )}
          {expiringLicenses.length === 0 && expiringContracts.length === 0 ? <p className="dashboard-empty">Nothing expiring soon.</p> : <>
            {expiringLicenses.map(license => <div className={`dashboard-alert-row ${license.expiryDate <= urgentDate ? 'dashboard-urgent-row' : ''}`} key={`license-${license.licenseId}`}><span><b>{license.licenseName}</b><small>License · {license.vendorName} · {license.softwareName}</small></span><strong>{license.expiryDate}</strong><button type="button" className="license-renew-button" onClick={() => setRenewalCandidate(license)} disabled={renewingLicenseId === license.licenseId}>{renewingLicenseId === license.licenseId ? 'Renewing…' : 'Renew'}</button></div>)}
            {expiringContracts.map(contract => <div className={`dashboard-alert-row ${contract.endDate <= urgentDate ? 'dashboard-urgent-row' : ''}`} key={`contract-${contract.id}`}><span><b>{contract.contractNumber}</b><small>Contract · {contract.vendorName || contract.vendor.name} · {contract.softwareName || 'No software'}</small></span><strong>{contract.endDate}</strong><button type="button" className="license-renew-button" onClick={() => setRenewalContractCandidate(contract)} disabled={renewingContractId === contract.id}>{renewingContractId === contract.id ? 'Renewing…' : 'Renew'}</button></div>)}
          </>}
        </section>
        <section className="contracts-panel dashboard-alert-panel dashboard-credit-card-panel">
          <header><h2>Credit card licenses</h2><strong>{creditCardLicenses.length}</strong></header>
          {creditCardLicenses.length === 0 ? <p className="dashboard-empty">No credit card licenses.</p> : creditCardLicenses.map(license => <div className="dashboard-alert-row" key={license.licenseId}><span><b>{license.licenseName}</b><small>{license.vendorName} · {license.softwareName}</small></span><strong>{money(license.price)}</strong></div>)}
        </section>
      </div>

      <section className="contracts-panel dashboard-chart-panel">
        <div className="dashboard-chart-head"><div><h2>Seats by licence</h2><p>Every contract holding the same licence is totalled here — click a row to see each contract and when it expires</p></div><strong>{licenses.reduce((sum, license) => sum + (license.seatsPurchased ?? 0), 0)} seats</strong></div>
        {seatGroups.length === 0 ? <p className="dashboard-empty">No seat data available.</p> : <>
          <div className="dashboard-license-chart">
            <div className="dashboard-license-axis">
              {[0, 1, 2, 3, 4].map(index => <span key={index}>{index * chartStep}</span>)}
            </div>
            {seatGroups.map((group, index) => (
              <Fragment key={group.key}>
                <div
                  className={`dashboard-license-line-row dashboard-seat-row${expandedSeatKey === group.key ? ' is-expanded' : ''}`}
                  role="button"
                  tabIndex={0}
                  aria-expanded={expandedSeatKey === group.key}
                  onClick={() => toggleSeatGroup(group.key)}
                  onKeyDown={event => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      toggleSeatGroup(group.key)
                    }
                  }}
                >
                  <span className="dashboard-license-line-label" title={`${group.licenseName} · ${group.vendorName}`}>{group.licenseName}</span>
                  <div className="dashboard-license-line-track"><span className={`dashboard-license-line dashboard-line-color-${index % 6}`} style={{ width: `${Math.max((group.totalSeats / chartMax) * 100, 2)}%` }}><b>{group.totalSeats}</b></span></div>
                </div>
                {expandedSeatKey === group.key && (
                  <div className="dashboard-seat-detail">
                    <div className="dashboard-seat-detail-row dashboard-seat-detail-head"><span>Contract ID</span><span>Contract</span><span>Seats</span><span>Expires</span></div>
                    {[...group.licenses].sort((a, b) => a.expiryDate.localeCompare(b.expiryDate)).map(license => (
                      <div className={`dashboard-seat-detail-row${license.expiryDate < today ? ' is-expired' : ''}`} key={license.licenseId}>
                        <span>{license.contractId ?? '—'}</span>
                        <span>{license.contractId == null ? 'No contract' : contractNumberById.get(String(license.contractId)) ?? '—'}</span>
                        <span>{license.seatsPurchased ?? 0}</span>
                        <span>{expiryLabel(license.expiryDate)}</span>
                      </div>
                    ))}
                    <div className="dashboard-seat-detail-row dashboard-seat-detail-total"><span>Total</span><span>{group.licenses.length} contracts</span><span>{group.totalSeats}</span><span>seats</span></div>
                  </div>
                )}
              </Fragment>
            ))}
          </div>
        </>}
      </section>
    </div>
  )
}
