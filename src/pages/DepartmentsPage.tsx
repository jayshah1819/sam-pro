import { useEffect, useMemo, useState } from 'react'
import { client } from '../api'
import type { Contract, ContractLicense } from '../types'
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

    function buildNode(name: string, children: string[]): DepartmentNode {
      const key = normalize(name)
      const ownContracts = byLocation.get(key) ?? []
      const childNodes = children.map(childName => buildNode(childName, []))
      const allContracts = [...ownContracts, ...childNodes.flatMap(child => child.allContracts)]
      return { key, label: name, children: childNodes, ownContracts, allContracts }
    }

    const knownNodes = DEPARTMENT_TREE.map(node => buildNode(node.name, node.children))

    // Anything not under a known department/subsidiary still gets its own top-level node
    // (e.g. "IT", blank company) so no contract data is silently dropped.
    const otherNodes: DepartmentNode[] = []
    byLocation.forEach((rows, key) => {
      if (KNOWN_DEPARTMENTS.has(key)) return
      otherNodes.push({
        key,
        label: key === '' ? 'No company set' : rows[0]?.location ?? key,
        children: [],
        ownContracts: rows,
        allContracts: rows,
      })
    })
    otherNodes.sort((a, b) => a.label.localeCompare(b.label))

    return [...knownNodes, ...otherNodes]
  }, [contracts])

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
  const selectedLicenses = selectedNode ? licensesForContracts(selectedNode.allContracts) : []
  const selectedTotal = selectedLicenses.reduce((sum, license) => sum + (license.price ?? 0), 0)

  function renderNode(node: DepartmentNode, depthLevel: number) {
    const isExpanded = expanded.has(node.key)
    const isSelected = selectedKey === node.key
    const rollupLicenses = licensesForContracts(node.allContracts)
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
          <span className="dept-tree-meta">{node.allContracts.length} contracts · {rollupLicenses.length} licenses · {fmtCurrency(rollupTotal)}</span>
        </div>
        {node.children.length > 0 && isExpanded && (
          <div>{node.children.map(child => renderNode(child, depthLevel + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="contracts-page">
      <div className="contracts-header">
        <h1>Departments</h1>
        <p className="contracts-subtitle">Vendors, licenses and spend grouped by department. Selecting a parent department (e.g. FD) rolls up all of its subsidiaries.</p>
      </div>

      {loading && <p className="px-4 py-6 text-sm text-[#6b6375]">Loading…</p>}
      {error && <p className="px-4 py-6 text-sm text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="dept-layout">
          <div className="contracts-panel dept-tree-panel">
            {tree.map(node => renderNode(node, 0))}
          </div>

          <div className="contracts-panel dept-detail-panel">
            {!selectedNode ? (
              <p className="px-4 py-6 text-sm text-[#6b6375]">Select a department to see its licenses and spend.</p>
            ) : (
              <>
                <div className="dept-detail-head">
                  <h2>{selectedNode.label}</h2>
                  <span>{selectedNode.allContracts.length} contracts · {selectedLicenses.length} licenses · {fmtCurrency(selectedTotal)} total</span>
                </div>
                <div className="contracts-table-wrap">
                  <table className="contracts-table licenses-table">
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
                        <tr key={license.licenseId} className="contract-row">
                          <td className="font-semibold">{license.licenseName}</td>
                          <td>{license.vendorName || '—'}</td>
                          <td>{license.softwareName}</td>
                          <td>{license.seatsPurchased ?? '—'}</td>
                          <td>{fmtCurrency(license.price ?? 0)}</td>
                        </tr>
                      ))}
                      {selectedLicenses.length === 0 && (
                        <tr><td colSpan={5} className="py-10 text-center text-[#6b6375]">No licenses found for this department.</td></tr>
                      )}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
