export interface AuthUser {
  username: string
  // role defaults to 'USER'; add a 'role' claim to the backend JWT to populate this
  role: string
  tenantId: string
}

export interface Device {
  id: string
  tenantId: string
  assetTag: string
  hostname: string
  os: string
  createdAt: string
}

export interface AppUser {
  id: string
  tenantId: string
  employeeId: string
  email: string
  department: string
}

export interface UserInstallationEntry {
  installationId: string
  deviceId: string
  assetTag: string
  hostname: string
  softwareName: string
  softwareVendor: string
  softwareVersion: string
  installDate: string | null
}

export interface CredentialView {
  id: number
  tenantId: number
  username: string
  role: string
  createdAt: string
  lastLoginAt: string | null
}

// Mirrors Spring Data's Page<T> response envelope
export interface SpringPage<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
}

export interface Vendor {
  id?: string
  vendorId?: number | null
  tenantId: string
  name: string
  vendorJDENumber: string | null
  canonicalName: string | null
  aliases: string[]
  contactEmail: string | null
  address: string | null
  website: string | null
  comments: string | null
}

export interface Contract {
  id: number
  tenantId: number
  vendor: Vendor
  vendorId: number | null
  vendorName: string | null
  vendorJDENumber: string | null
  contractNumber: string
  itOwner: string | null
  comments: string | null
  department: string | null
  softwareName: string | null
  softwareIds: number[]
  startDate: string
  endDate: string
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING_RENEWAL'
  value: number | null
}

export interface ContractLicense {
  licenseId: number
  contractId: number | null
  licenseName: string
  itOwner: string | null
  comments: string | null
  softwareId: number | null
  vendorName: string
  softwareName: string
  version: string
  licenseType: 'PER_SEAT' | 'PER_DEVICE' | 'SITE_LICENSE' | 'SUBSCRIPTION'
  status: 'ACTIVE' | 'EXPIRED' | 'PENDING'
  paymentMethod: 'PURCHASE_ORDER' | 'CREDIT_CARD'
  seatsPurchased: number | null
  price: number | null
  startDate: string
  expiryDate: string
}

export interface AppData {
  vendors: Vendor[]
  contracts: Contract[]
  licenses: ContractLicense[]
}

export interface SoftwareProduct {
  id?: number
  softwareId?: number | null
  tenantId: string
  name: string
  canonicalName: string | null
  aliases: string[]
  vendor: string
  version: string
}

export interface VendorSoftwareSummary {
  vendor: string
  count: number
}

