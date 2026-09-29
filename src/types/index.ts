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
  lastSeenAt: string | null
  online: boolean
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
  businessOwner: string | null
  comments: string | null
  location: string | null
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
  location: string | null
  licenseName: string
  itOwner: string | null
  businessOwner: string | null
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
  softwareCode: string | null
  vendorId: number | null
  functionalGrouping: string | null
  functionalOwner: string | null
  confidenceLevel: string | null
  manufacturerName: string | null
  systemCategory: string | null
  systemCategorization: string | null
  businessCriticality: string | null
  systemStrategy: string | null
  erpSystem: string | null
  annualInfrastructureCost: number | null
  annualCostNonLicense: number | null
  annualLicenseCost: number | null
  annualCostTotal: number | null
  acsBudget: number | null
  numberOfActiveUsers: number | null
  numberOfLicensesOwned: number | null
  proposedFunctionGroupOwner: string | null
  billingVendor: string | null
  billingVendorId: number | null
  businessFunction: string | null
  numberOfUsers: number | null
  budgetOwner: string | null
  primaryItGroup: string | null
  primaryItGroupLeadership: string | null
  contractDuration: string | null
  paymentSchedule: string | null
  currency: string | null
  criticalityLevels: string | null
  description: string | null
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

export interface FinanceRow {
  id: number
  softwareCode: string
  tenantId: number
  sourceBudget: string | null
  primaryCategory: string | null
  subCategory: string | null
  businessCriticality: string | null
  strategy: string | null
  erp: string | null
  costCode: string | null
  location: string | null
  vendorId: number | null
  softwareName: string | null
  baselineBudget: number | null
  softwareSpend: number | null
  actuals: number | null
  remaining: number | null
  managedServiceProviders: number | null
  itStaffInternalLabour: number | null
  itStaffExternalLabour: number | null
  depreciationAmortisation: number | null
  cloudSolutions: number | null
  consultingOutsideServices: number | null
  totalTco: number | null
  costRecoveries: number | null
}

export interface FinanceCategory {
  id: number
  primaryCategory: string
  subCategory: string
}

export interface FinanceViewOptions {
  businessCriticality: string[]
  strategy: string[]
}

export interface InventoryRow {
  id: number
  companyGroup: string | null
  companyNameDivision: string | null
  systemFunctionality: string | null
  manufacturerName: string | null
  vendorName: string | null
  softwareName: string | null
  totalSoftwareSpend: number | null
  currency: string | null
  softwareCode: string
  comments: string | null
}


