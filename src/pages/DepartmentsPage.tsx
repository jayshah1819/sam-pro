import { useEffect, useMemo, useState } from 'react'
import { client } from '../api'
import type { Contract, ContractLicense } from '../types'
import { downloadExcel } from '../utils/exportExcel'
import '../styles/contracts.css'

function fmtCurrency(value: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(value)
}

// Org chart used to roll subsidiary departments up into their parent.
// Edit this map if the real department codes/hierarchy differ.
const DEPARTMENT_TREE: { name: string; children: string[] }[] = [
  { name: 'FD', children: ['JVS', 'SPC', 'POLICE'] },
]

const KNOWN_DEPARTMENTS = new Set(
  DEPARTMENT_TREE.flatMap(node => [node.name, ...node.children]),
)

type DepartmentNode = {
  key: string
  label: string
  children: DepartmentNode[]
  ownContracts: Contract[]
  allContracts: Contract[]
  // Licenses with no linked contract carry their own department directly on the
  // license (Entitlement.location) instead of inheriting it from a contract.
  ownStandaloneLicenses: ContractLicense[]
  allStandaloneLicenses: ContractLicense[]
}

function normalize(location: string | null | undefined) {
  return (location ?? '').trim().toUpperCase()
}

export default function DepartmentsPage() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [licenses, setLicenses] = useState<ContractLicense[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<Set<string>>(new Set())
  const [selectedKey, setSelectedKey] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      client.get<{ content: Contract[] }>('/contracts', { params: { page: 0, size: 500 } }),
      client.get<ContractLicense[]>('/contracts/licenses/all'),
    ])
      .then(([contractsRes, licensesRes]) => {
        setContracts(contractsRes.data.content ?? [])
        setLicenses(licensesRes.data ?? [])
      })
      .catch(() => setError('Failed to load department data.'))
      .finally(() => setLoading(false))
  }, [])

  const tree = useMemo<DepartmentNode[]>(() => {
    const byLocation = new Map<string, Contract[]>()
    contracts.forEach(contract => {
      const key = normalize(contract.location)
      if (!byLocation.has(key)) byLocation.set(key, [])
      byLocation.get(key)!.push(contract)
    })

    const standaloneByLocation = new Map<string, ContractLicense[]>()
    licenses.forEach(license => {
      if (license.contractId != null) return
      const key = normalize(license.location)
      if (!standaloneByLocation.has(key)) standaloneByLocation.set(key, [])
      standaloneByLocation.get(key)!.push(license)
    })

    function buildNode(name: string, children: string[]): DepartmentNode {
      const key = normalize(name)
      const ownContracts = byLocation.get(key) ?? []
      const ownStandaloneLicenses = standaloneByLocation.get(key) ?? []
      const childNodes = children.map(childName => buildNode(childName, []))
      const allContracts = [...ownContracts, ...childNodes.flatMap(child => child.allContracts)]
      const allStandaloneLicenses = [...ownStandaloneLicenses, ...childNodes.flatMap(child => child.allStandaloneLicenses)]
      return { key, label: name, children: childNodes, ownContracts, allContracts, ownStandaloneLicenses, allStandaloneLicenses }
    }

    const knownNodes = DEPARTMENT_TREE.map(node => buildNode(node.name, node.children))

    // Anything not under a known department/subsidiary still gets its own top-level node
    // (e.g. "IT", blank company) so no contract or standalone-license data is silently dropped.
    const otherNodes: DepartmentNode[] = []
    const otherKeys = new Set([...byLocation.keys(), ...standaloneByLocation.keys()])
    otherKeys.forEach(key => {
      if (KNOWN_DEPARTMENTS.has(key)) return
      const rows = byLocation.get(key) ?? []
      const standaloneRows = standaloneByLocation.get(key) ?? []
      const label = key === '' ? 'No company set' : (rows[0]?.location ?? standaloneRows[0]?.location ?? key)
      otherNodes.push({
        key,
        label,
        children: [],
        ownContracts: rows,
        allContracts: rows,
        ownStandaloneLicenses: standaloneRows,
        allStandaloneLicenses: standaloneRows,
      })
    })
    otherNodes.sort((a, b) => a.label.localeCompare(b.label))

    return [...knownNodes, ...otherNodes]
  }, [contracts, licenses])

  const licensesByContractId = useMemo(() => {
    const map = new Map<number, ContractLicense[]>()
    licenses.forEach(license => {
      if (license.contractId == null) return
      if (!map.has(license.contractId)) map.set(license.contractId, [])
      map.get(license.contractId)!.push(license)
    })
    return map
  }, [licenses])

  function licensesForContracts(rows: Contract[]) {
    return rows.flatMap(contract => licensesByContractId.get(contract.id) ?? [])
  }

  function licensesForNode(node: DepartmentNode) {
    return [...licensesForContracts(node.allContracts), ...node.allStandaloneLicenses]
  }

  function toggleExpanded(key: string) {
    setExpanded(previous => {
      const next = new Set(previous)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function findNode(nodes: DepartmentNode[], key: string): DepartmentNode | null {
    for (const node of nodes) {
      if (node.key === key) return node
      const found = findNode(node.children, key)
      if (found) return found
    }
    return null
  }

  const selectedNode = selectedKey == null ? null : findNode(tree, selectedKey)
  const selectedLicenses = selectedNode ? licensesForNode(selectedNode) : []
  const selectedTotal = selectedLicenses.reduce((sum, license) => sum + (license.price ?? 0), 0)

  function exportDeptContracts(node: DepartmentNode) {
    downloadExcel(`${node.label}-contracts.xlsx`, 'Contracts', node.allContracts.map(contract => ({
      'Contract #': contract.contractNumber,
      Vendor: contract.vendorName ?? '',
      'IT owner': contract.itOwner ?? '',
      'Business owner': contract.businessOwner ?? '',
      Department: contract.location ?? '',
      Software: contract.softwareName ?? '',
      Start: contract.startDate,
      End: contract.endDate,
      Value: contract.value ?? '',
      Status: contract.status,
    })))
  }

  function exportDeptLicenses(node: DepartmentNode) {
    downloadExcel(`${node.label}-licenses.xlsx`, 'Licenses', licensesForNode(node).map(license => ({
      'License name': license.licenseName,
      Vendor: license.vendorName,
      'IT owner': license.itOwner ?? '',
      'Business owner': license.businessOwner ?? '',
      'Software name': license.softwareName,
      Department: license.location ?? '',
      Type: license.licenseType,
      Status: license.status,
      Seats: license.seatsPurchased ?? '',
      Price: license.price ?? '',
      Start: license.startDate,
      Expiry: license.expiryDate,
    })))
  }

  const grandTotalSpend = useMemo(
    () => licenses.reduce((sum, license) => sum + (license.price ?? 0), 0),
    [licenses],
  )
  const departmentCount = tree.length

  function renderNode(node: DepartmentNode, depthLevel: number) {
    const isExpanded = expanded.has(node.key)
    const isSelected = selectedKey === node.key
    const rollupLicenses = licensesForNode(node)
    const rollupTotal = rollupLicenses.reduce((sum, license) => sum + (license.price ?? 0), 0)

    return (
      <div key={node.key}>
        <div
          role="button"
          tabIndex={0}
          className={`dept-tree-row${isSelected ? ' is-selected' : ''}`}
          style={{ paddingLeft: 12 + depthLevel * 20 }}
          onClick={() => setSelectedKey(node.key)}
          onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') setSelectedKey(node.key) }}
        >
          <div className="dept-tree-row-main">
            {node.children.length > 0 ? (
              <button
                type="button"
                className="dept-tree-toggle"
                onClick={event => { event.stopPropagation(); toggleExpanded(node.key) }}
                aria-label={isExpanded ? 'Collapse' : 'Expand'}
              >
                {isExpanded ? '▾' : '▸'}
              </button>
            ) : <span className="dept-tree-toggle-spacer" />}
            <span className="dept-tree-label">{node.label}</span>
          </div>
          <span className="dept-tree-meta">
            {node.allContracts.length} contract{node.allContracts.length === 1 ? '' : 's'} · {rollupLicenses.length} license{rollupLicenses.length === 1 ? '' : 's'} · {fmtCurrency(rollupTotal)}
          </span>
        </div>
        {node.children.length > 0 && isExpanded && (
          <div>{node.children.map(child => renderNode(child, depthLevel + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="departments-preview contracts-preview flex flex-col gap-4">
      <div className="flex items-baseline justify-between">
        <h1 className="text-lg font-semibold text-[#08060d]">Departments</h1>
      </div>
      <p className="text-sm text-[#6b6375]">Vendors, licenses and spend grouped by department. Selecting a parent department rolls up all of its subsidiaries.</p>

      {loading && <p className="px-4 py-6 text-sm text-[#6b6375]">Loading…</p>}
      {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <>
          {selectedNode && (
            <div className="dept-summary-context">
              <button type="button" className="dept-summary-reset" onClick={() => setSelectedKey(null)}>
                ← View all departments
              </button>
            </div>
          )}
          <div className="dept-summary-cards">
            <div className="dept-summary-card">
              <small>{selectedNode ? 'Department' : 'Departments'}</small>
              <strong className={selectedNode ? 'is-text' : ''}>{selectedNode ? selectedNode.label : departmentCount}</strong>
            </div>
            <div className="dept-summary-card"><small>Contracts</small><strong>{selectedNode ? selectedNode.allContracts.length : contracts.length}</strong></div>
            <div className="dept-summary-card"><small>Licenses</small><strong>{selectedNode ? selectedLicenses.length : licenses.length}</strong></div>
            <div className="dept-summary-card is-spend"><small>Total spend</small><strong>{fmtCurrency(selectedNode ? selectedTotal : grandTotalSpend)}</strong></div>
          </div>
          <div className="dept-layout">
          <div className="contracts-panel dept-tree-panel">
            {tree.map(node => renderNode(node, 0))}
          </div>

          <div className="contracts-panel dept-detail-panel">
            {!selectedNode ? (
              <p className="px-4 py-6 text-sm text-[#6b6375]">Select a department to see its licenses and spend.</p>
            ) : (
              <>
                <div className="dept-split">
                  <div className="dept-mini-panel is-contracts">
                    <div className="dept-mini-panel-head">
                      <h3>Contracts in {selectedNode.label}</h3>
                      <button type="button" className="dept-mini-export" title="Export contracts to Excel" aria-label="Export contracts to Excel" onClick={() => exportDeptContracts(selectedNode)}>⤓</button>
                    </div>
                    <div className="dept-mini-table-wrap">
                      <table className="dept-mini-table">
                        <thead>
                          <tr>
                            <th>Contract #</th>
                            <th>Vendor</th>
                            <th>Status</th>
                            <th>Value</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedNode.allContracts.map(contract => (
                            <tr key={contract.id}>
                              <td className="font-semibold">{contract.contractNumber}</td>
                              <td>{contract.vendorName || '—'}</td>
                              <td>{contract.status}</td>
                              <td>{fmtCurrency(contract.value ?? 0)}</td>
                            </tr>
                          ))}
                          {selectedNode.allContracts.length === 0 && (
                            <tr><td colSpan={4} className="dept-mini-empty">No contracts found for this department.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="dept-mini-panel is-licenses">
                    <div className="dept-mini-panel-head">
                      <h3>Licenses in {selectedNode.label}</h3>
                      <button type="button" className="dept-mini-export" title="Export licenses to Excel" aria-label="Export licenses to Excel" onClick={() => exportDeptLicenses(selectedNode)}>⤓</button>
                    </div>
                    <div className="dept-mini-table-wrap">
                      <table className="dept-mini-table">
                        <thead>
                          <tr>
                            <th>License</th>
                            <th>Vendor</th>
                            <th>Software</th>
                            <th>Seats</th>
                            <th>Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedLicenses.map(license => (
                            <tr key={license.licenseId}>
                              <td className="font-semibold">{license.licenseName}</td>
                              <td>{license.vendorName || '—'}</td>
                              <td>{license.softwareName}</td>
                              <td>{license.seatsPurchased ?? '—'}</td>
                              <td>{fmtCurrency(license.price ?? 0)}</td>
                            </tr>
                          ))}
                          {selectedLicenses.length === 0 && (
                            <tr><td colSpan={5} className="dept-mini-empty">No licenses found for this department.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
        </>
      )}
    </div>
  )
}
