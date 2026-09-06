import { useEffect, useMemo, useState } from 'react'
import { client } from '../api'
import type { Contract, ContractLicense, SoftwareProduct, SpringPage } from '../types'
import '../styles/contracts.css'

type SoftwareEntry = SoftwareProduct & {
  softwareId: number
  licenses: Array<ContractLicense & { contractNumber: string }>
}

type SoftwareVendorGroup = {
  vendor: string
  software: SoftwareEntry[]
}

export default function SoftwarePage() {
  const [groups, setGroups] = useState<SoftwareVendorGroup[]>([])
  const [expanded, setExpanded] = useState<Record<string, boolean>>({})
  const [search, setSearch] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true
    async function load() {
      setLoading(true)
      setError(null)
      try {
        const [{ data: softwarePage }, { data: contractPage }] = await Promise.all([
          client.get<SpringPage<SoftwareProduct>>('/software', { params: { page: 0, size: 500 } }),
          client.get<SpringPage<Contract>>('/contracts', { params: { page: 0, size: 500 } }),
        ])
        const licenseResults = await Promise.all(
          (contractPage.content ?? []).map(async contract => {
            const { data } = await client.get<ContractLicense[]>(`/contracts/${contract.id}/licenses`)
            return data.map(license => ({ ...license, contractNumber: contract.contractNumber }))
          }),
        )
        const licenses = licenseResults.flat()
        const bySoftware = new Map<number, SoftwareEntry>()
        for (const software of softwarePage.content ?? []) {
          const softwareId = software.softwareId ?? software.id
          if (softwareId == null) continue
          bySoftware.set(softwareId, { ...software, softwareId, licenses: [] })
        }
        for (const license of licenses) {
          if (license.softwareId == null) continue
          const software = bySoftware.get(license.softwareId)
          if (software) software.licenses.push(license)
        }
        const grouped = new Map<string, SoftwareEntry[]>()
        for (const software of bySoftware.values()) {
          const list = grouped.get(software.vendor) ?? []
          list.push(software)
          grouped.set(software.vendor, list)
        }
        if (active) setGroups(Array.from(grouped, ([vendor, software]) => ({ vendor, software })))
      } catch {
        if (active) setError('Failed to load software and licenses.')
      } finally {
        if (active) setLoading(false)
      }
    }
    void load()
    return () => { active = false }
  }, [])

  const visibleGroups = useMemo(() => {
    const needle = search.trim().toLowerCase()
    if (!needle) return groups
    return groups
      .map(group => ({
        ...group,
        software: group.software.filter(software =>
          `${group.vendor} ${software.name} ${software.version} ${software.softwareId}`.toLowerCase().includes(needle),
        ),
      }))
      .filter(group => group.software.length > 0)
  }, [groups, search])

  function toggle(vendor: string) {
    setExpanded(prev => ({ ...prev, [vendor]: !(prev[vendor] ?? true) }))
  }

  return (
    <div className="software-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Software</h1>
        <span className="text-sm text-[#6b6375]">{groups.reduce((total, group) => total + group.software.length, 0)} software products</span>
      </div>

      <div className="contracts-toolbar flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={event => setSearch(event.target.value)}
          placeholder="Search software, vendor, version, or software ID"
          className="h-8 min-w-80 px-3 rounded-md border border-[#e5e4e7] text-sm text-[#08060d] outline-none focus:border-[#2b5a63]"
        />
      </div>

      {loading && <p className="text-sm text-[#6b6375]">Loading software and licenses…</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}
      {!loading && !error && visibleGroups.length === 0 && <div className="contracts-panel px-6 py-12 text-center text-sm text-[#6b6375]">No matching software found.</div>}

      {!loading && !error && visibleGroups.map(group => {
        const isOpen = expanded[group.vendor] ?? true
        return (
          <section key={group.vendor} className="software-vendor-panel contracts-panel">
            <button type="button" onClick={() => toggle(group.vendor)} className="software-vendor-summary vendor-summary w-full px-4 py-4 border-b text-left">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[#08060d]">{group.vendor}</p>
                  <p className="text-xs text-[#6b6375]">{group.software.length} software products</p>
                </div>
                <span className="text-lg text-[#2b5a63]">{isOpen ? '▾' : '▸'}</span>
              </div>
            </button>
            {isOpen && (
              <div className="contracts-table-wrap">
                <table className="software-table contracts-table">
                  <thead><tr><th>Software ID</th><th>Software</th><th>Version</th><th>Licenses</th></tr></thead>
                  <tbody>
                    {group.software.map(software => (
                      <tr key={software.softwareId} className="contract-row">
                        <td className="font-mono text-xs">{software.softwareId}</td>
                        <td><div className="contract-number">{software.name}</div><div className="contract-subtitle">{software.vendor}</div></td>
                        <td>{software.version}</td>
                        <td>{software.licenses.length === 0 ? <span className="text-[#5b5b57]">No licenses</span> : <div className="software-license-list">{software.licenses.map(license => <span key={`${license.licenseId}-${license.contractNumber}`} className="software-license-chip">{license.licenseId} · {license.licenseName} · {license.contractNumber} · {license.price == null ? 'No price' : `$${license.price.toLocaleString()}`}</span>)}</div>}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )
      })}
    </div>
  )
}
