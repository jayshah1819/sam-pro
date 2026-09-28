import { client } from '../api'
import type { Contract } from '../types'

// Department lives on the contract (Contract.location); vendors and licenses
// inherit it through their linked contract, so editing it here is the single
// source of truth reflected everywhere the contract/license/vendor is shown.
export async function updateContractDepartment(contract: Contract, department: string): Promise<Contract> {
  const { data } = await client.put<Contract>(`/contracts/${contract.id}`, {
    contractNumber: contract.contractNumber,
    itOwner: contract.itOwner,
    businessOwner: contract.businessOwner,
    comments: contract.comments,
    vendorId: contract.vendorId,
    location: department.trim() || null,
    softwareName: contract.softwareName,
    startDate: contract.startDate,
    endDate: contract.endDate,
    status: contract.status,
    value: contract.value,
  })
  return data
}
