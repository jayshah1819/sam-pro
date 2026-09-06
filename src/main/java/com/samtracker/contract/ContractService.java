package com.samtracker.contract;

import com.samtracker.entitlement.Entitlement;
import com.samtracker.entitlement.EntitlementRepository;
import com.samtracker.tenant.TenantContext;
import com.samtracker.software.SoftwareProduct;
import com.samtracker.software.SoftwareProductRepository;
import com.samtracker.vendor.Vendor;
import com.samtracker.vendor.VendorRepository;
import jakarta.persistence.EntityManager;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;

import java.math.BigDecimal;
import java.sql.ResultSet;
import java.sql.SQLException;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.function.Supplier;

@Service
public class ContractService {

    private final ContractRepository contractRepository;
    private final VendorRepository vendorRepository;
    private final EntitlementRepository entitlementRepository;
    private final SoftwareProductRepository softwareProductRepository;
    private final JdbcTemplate jdbcTemplate;
    private final EntityManager entityManager;

    public ContractService(ContractRepository contractRepository,
            VendorRepository vendorRepository,
            EntitlementRepository entitlementRepository,
            SoftwareProductRepository softwareProductRepository,
            JdbcTemplate jdbcTemplate,
            EntityManager entityManager) {
        this.contractRepository = contractRepository;
        this.vendorRepository = vendorRepository;
        this.entitlementRepository = entitlementRepository;
        this.softwareProductRepository = softwareProductRepository;
        this.jdbcTemplate = jdbcTemplate;
        this.entityManager = entityManager;
    }

    // Admin-only listing (see ContractController @PreAuthorize) — intentionally not
    // tenant-filtered
    // so admins can see contracts across all tenants.
    public Page<Contract> findAll(Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100));
        return contractRepository.findAll(capped);
    }

    public Page<Contract> findAllForCurrentUser(Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100));
        if (isCurrentUserAdmin()) {
            List<Contract> contracts = fetchContractsForAdmin(null);
            attachSoftwareIds(contracts, null);
            return pageContracts(contracts, capped);
        }
        Page<Contract> contracts = contractRepository.findByTenantId(TenantContext.get(), capped);
        contracts.getContent().forEach(this::attachVendorSnapshot);
        attachSoftwareIds(contracts.getContent(), TenantContext.get());
        return contracts;
    }

    public Page<Contract> findYtd(Pageable pageable, Integer vendorId) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100));
        LocalDate yearStart = LocalDate.of(LocalDate.now().getYear(), 1, 1);
        if (vendorId != null) {
            return contractRepository.findYtdByVendor(TenantContext.get(), vendorId, yearStart, capped);
        }
        return contractRepository.findYtd(TenantContext.get(), yearStart, capped);
    }

    public long countAll() {
        if (isCurrentUserAdmin()) {
            Long total = jdbcTemplate.queryForObject("SELECT COUNT(*) FROM contracts", Long.class);
            return total == null ? 0L : total;
        }
        return contractRepository.countByTenantId(TenantContext.get());
    }

    public Page<Contract> findByVendorId(Integer vendorId, Pageable pageable) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 100));
        return contractRepository.findByTenantIdAndVendorId(TenantContext.get(), vendorId, capped);
    }

    public Page<Contract> findFiltered(Pageable pageable, String q, Integer vendorId, ContractStatus status,
            LocalDate startDate, LocalDate endDate, BigDecimal minValue, BigDecimal maxValue) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 200));
        Page<Contract> contracts = contractRepository.findFiltered(TenantContext.get(), q, vendorId, status,
                startDate, endDate, minValue, maxValue, capped);
        attachSoftwareIds(contracts.getContent(), TenantContext.get());
        return contracts;
    }

    public Page<Contract> findFilteredForCurrentUser(Pageable pageable, String q, Integer vendorId,
            ContractStatus status,
            LocalDate startDate, LocalDate endDate, BigDecimal minValue, BigDecimal maxValue) {
        Pageable capped = PageRequest.of(pageable.getPageNumber(), Math.min(pageable.getPageSize(), 200));
        if (isCurrentUserAdmin()) {
            List<Contract> filtered = fetchContractsForAdmin(null).stream()
                    .filter(c -> matchesFilters(c, q, vendorId, status, startDate, endDate, minValue, maxValue))
                    .sorted(Comparator.comparing(Contract::getStartDate,
                            Comparator.nullsLast(Comparator.reverseOrder())))
                    .toList();
            attachSoftwareIds(filtered, null);
            return pageContracts(filtered, capped);
        }
        Page<Contract> contracts = contractRepository.findFiltered(TenantContext.get(), q, vendorId, status,
                startDate, endDate, minValue, maxValue, capped);
        attachSoftwareIds(contracts.getContent(), TenantContext.get());
        return contracts;
    }

    public Contract findByIdForCurrentUser(Integer id) {
        if (isCurrentUserAdmin()) {
            return fetchContractByIdForAdmin(id)
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));
        }
        Contract contract = contractRepository.findByIdAndTenantId(id, TenantContext.get())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));
        attachVendorSnapshot(contract);
        attachSoftwareIds(List.of(contract), TenantContext.get());
        return contract;
    }

    public List<Contract> exportFiltered(String q, Integer vendorId, ContractStatus status, LocalDate startDate,
            LocalDate endDate, BigDecimal minValue, BigDecimal maxValue) {
        return contractRepository.findFilteredForExport(TenantContext.get(), q, vendorId, status, startDate, endDate,
                minValue, maxValue);
    }

    public Contract create(CreateContractRequest request) {
        String contractNumber = request.contractNumber().strip();
        if (contractNumber.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contractNumber is required");
        }

        if (request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate must be on or after startDate");
        }

        var vendor = findVendorByPublicId(TenantContext.get(), request.vendorId());

        Contract contract = new Contract();
        contract.setContractNumber(contractNumber);
        contract.setVendor(vendor);
        contract.setVendorId(vendor.getVendorId());
        contract.setVendorName(vendor.getName());
        contract.setVendorJDENumber(vendor.getVendorJDENumber());
        contract.setDepartment(request.department() == null ? null : request.department().strip());
        contract.setItOwner(request.itOwner() == null ? null : request.itOwner().strip());
        contract.setComments(request.comments() == null ? null : request.comments().strip());
        contract.setSoftwareName(request.softwareName() == null ? null : request.softwareName().strip());
        contract.setStartDate(request.startDate());
        contract.setEndDate(request.endDate());
        contract.setStatus(request.status() == null ? ContractStatus.ACTIVE : request.status());
        contract.setValue(request.value());
        Contract saved = contractRepository.save(contract);
        if (request.licenses() != null) {
            request.licenses().forEach(license -> addLicense(saved.getId(), license));
        }
        attachVendorSnapshot(saved);
        attachSoftwareIds(List.of(saved), TenantContext.get());
        return saved;
    }

    public Contract update(Integer id, UpdateContractRequest request) {
        if (isCurrentUserAdmin()) {
            return updateForAdmin(id, request);
        }
        return updateInTenant(id, request, TenantContext.get());
    }

    private Contract updateForAdmin(Integer id, UpdateContractRequest request) {
        Long tenantId = resolveTenantIdForContract(id);
        validateContractInput(request);
        var vendor = runInTenant(tenantId, () -> findVendorByPublicId(tenantId, request.vendorId()));

        int updated = jdbcTemplate.update(
                """
                                        UPDATE contracts
                        SET vendor_id = ?, vendor_name = ?, vendor_jde_number = ?, contract_number = ?, department = ?, software_name = ?, start_date = ?, end_date = ?, status = ?, value = ?
                                        WHERE contract_id = ? AND tenant_id = ?
                                        """,
                vendor.getVendorId(),
                vendor.getName(),
                vendor.getVendorJDENumber(),
                request.contractNumber().strip(),
                request.department() == null ? null : request.department().strip(),
                request.softwareName() == null ? null : request.softwareName().strip(),
                request.startDate(),
                request.endDate(),
                (request.status() == null ? ContractStatus.ACTIVE : request.status()).name(),
                request.value(),
                id,
                tenantId);
        if (updated == 0) {
            throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found");
        }

        syncContractLicenseDates(id, tenantId, request.startDate(), request.endDate());

        return fetchContractByIdForAdmin(id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));
    }

    private Contract updateInTenant(Integer id, UpdateContractRequest request, Long tenantId) {
        Contract contract = contractRepository.findByIdAndTenantId(id, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));

        String contractNumber = request.contractNumber().strip();
        if (contractNumber.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contractNumber is required");
        }
        if (request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate must be on or after startDate");
        }

        var vendor = findVendorByPublicId(tenantId, request.vendorId());

        contract.setContractNumber(contractNumber);
        contract.setVendor(vendor);
        contract.setVendorId(vendor.getVendorId());
        contract.setVendorName(vendor.getName());
        contract.setVendorJDENumber(vendor.getVendorJDENumber());
        contract.setDepartment(request.department() == null ? null : request.department().strip());
        contract.setItOwner(request.itOwner() == null ? null : request.itOwner().strip());
        contract.setComments(request.comments() == null ? null : request.comments().strip());
        contract.setSoftwareName(request.softwareName() == null ? null : request.softwareName().strip());
        contract.setStartDate(request.startDate());
        contract.setEndDate(request.endDate());
        contract.setStatus(request.status() == null ? ContractStatus.ACTIVE : request.status());
        contract.setValue(request.value());
        Contract saved = contractRepository.save(contract);
        syncContractLicenseDates(id, tenantId, saved.getStartDate(), saved.getEndDate());
        attachVendorSnapshot(saved);
        attachSoftwareIds(List.of(saved), tenantId);
        return saved;
    }

    public void delete(Integer id) {
        if (isCurrentUserAdmin()) {
            Long tenantId = resolveTenantIdForContract(id);
            int deleted = jdbcTemplate.update("DELETE FROM contracts WHERE contract_id = ? AND tenant_id = ?", id,
                    tenantId);
            if (deleted == 0) {
                throw new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found");
            }
            return;
        }

        Contract contract = contractRepository.findByIdAndTenantId(id, TenantContext.get())
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));
        contractRepository.delete(contract);
    }

    public List<ContractLicenseView> findLicenses(Integer contractId) {
        Long tenantId = resolveAccessibleContractTenant(contractId);
        return runInTenant(tenantId, () -> {
            requireContract(contractId, tenantId);
            return entitlementRepository.findByTenantIdAndContract_Id(tenantId, contractId).stream()
                    .map(this::toLicenseView)
                    .toList();
        });
    }

    public List<ContractLicenseView> findAllLicensesForCurrentUser() {
        Long tenantId = TenantContext.get();
        return entitlementRepository.findByTenantId(tenantId, PageRequest.of(0, 10000)).getContent().stream()
                .map(this::toLicenseView)
                .toList();
    }

    public ContractLicenseView addLicense(Integer contractId, CreateContractLicenseRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        String softwareName = request.softwareName() == null ? "" : request.softwareName().strip();
        String licenseName = request.licenseName() == null ? "" : request.licenseName().strip();
        if (licenseName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "licenseName is required");
        }
        if (softwareName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "softwareName is required");
        }
        if (request.licenseType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "licenseType is required");
        }

        Long tenantId = resolveAccessibleContractTenant(contractId);
        return runInTenant(tenantId, () -> {
            Contract contract = requireContract(contractId, tenantId);
            String vendorName = contract.getVendorName() == null || contract.getVendorName().isBlank()
                    ? contract.getVendor().getName()
                    : contract.getVendorName();
            SoftwareProduct software = findOrCreateSoftware(tenantId, softwareName, vendorName, request.version());

            if (contract.getSoftwareName() == null || contract.getSoftwareName().isBlank()) {
                contract.setSoftwareName(softwareName);
                contractRepository.save(contract);
            }

            Entitlement entitlement = new Entitlement();
            entitlement.setContract(contract);
            entitlement.setLicenseName(licenseName);
            entitlement.setItOwner(contract.getItOwner());
            entitlement.setComments(request.comments() == null ? null : request.comments().strip());
            entitlement.setSoftwareProduct(software);
            entitlement.setLicenseType(request.licenseType());
            entitlement.setStatus(
                    request.status() == null ? com.samtracker.entitlement.LicenseStatus.ACTIVE : request.status());
            entitlement.setPaymentMethod(
                    request.paymentMethod() == null ? com.samtracker.entitlement.PaymentMethod.PURCHASE_ORDER
                            : request.paymentMethod());
            entitlement.setSeatsPurchased(request.seatsPurchased());
            entitlement.setPrice(request.price());
            entitlement.setStartDate(contract.getStartDate());
            entitlement.setExpiryDate(contract.getEndDate());
            Entitlement saved = entitlementRepository.saveAndFlush(entitlement);
            entityManager.clear();
            return toLicenseView(entitlementRepository.findById(saved.getId()).orElse(saved));
        });
    }

    public ContractLicenseView updateLicense(Integer contractId, Integer licenseId,
            UpdateContractLicenseRequest request) {
        if (request == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Request body is required");
        }
        String softwareName = request.softwareName() == null ? "" : request.softwareName().strip();
        String licenseName = request.licenseName() == null ? "" : request.licenseName().strip();
        if (licenseName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "licenseName is required");
        }
        if (softwareName.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "softwareName is required");
        }
        if (request.licenseType() == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "licenseType is required");
        }

        Long tenantId = resolveAccessibleContractTenant(contractId);
        return runInTenant(tenantId, () -> {
            Contract contract = requireContract(contractId, tenantId);
            Entitlement entitlement = entitlementRepository.findByTenantIdAndId(tenantId, licenseId)
                    .filter(existing -> existing.getContract().getId().equals(contract.getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License not found"));
            String vendorName = contract.getVendorName() == null || contract.getVendorName().isBlank()
                    ? contract.getVendor().getName()
                    : contract.getVendorName();
            SoftwareProduct software = findOrCreateSoftware(tenantId, softwareName, vendorName, request.version());
            entitlement.setSoftwareProduct(software);
            entitlement.setLicenseName(licenseName);
            entitlement.setItOwner(contract.getItOwner());
            entitlement.setComments(request.comments() == null ? null : request.comments().strip());
            entitlement.setLicenseType(request.licenseType());
            entitlement.setStatus(
                    request.status() == null ? com.samtracker.entitlement.LicenseStatus.ACTIVE : request.status());
            entitlement.setPaymentMethod(
                    request.paymentMethod() == null ? com.samtracker.entitlement.PaymentMethod.PURCHASE_ORDER
                            : request.paymentMethod());
            entitlement.setSeatsPurchased(request.seatsPurchased());
            entitlement.setPrice(request.price());
            entitlement.setStartDate(contract.getStartDate());
            entitlement.setExpiryDate(contract.getEndDate());
            Entitlement saved = entitlementRepository.saveAndFlush(entitlement);
            entityManager.clear();
            return toLicenseView(entitlementRepository.findById(saved.getId()).orElse(saved));
        });
    }

    public void deleteLicense(Integer contractId, Integer licenseId) {
        Long tenantId = resolveAccessibleContractTenant(contractId);
        runInTenant(tenantId, () -> {
            Contract contract = requireContract(contractId, tenantId);
            Entitlement entitlement = entitlementRepository.findByTenantIdAndId(tenantId, licenseId)
                    .filter(existing -> existing.getContract().getId().equals(contract.getId()))
                    .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License not found"));
            entitlementRepository.delete(entitlement);
            return null;
        });
    }

    public List<ContractLicenseView> findVendorLicenses(Integer vendorId) {
        Long tenantId = TenantContext.get();
        Vendor vendor = findVendorByPublicId(tenantId, vendorId);
        return entitlementRepository.findByTenantIdAndSoftwareProduct_VendorIgnoreCase(tenantId, vendor.getName())
                .stream().map(this::toLicenseView).toList();
    }

    public ContractLicenseView addVendorLicense(Integer vendorId, CreateContractLicenseRequest request) {
        if (request == null || request.licenseName() == null || request.licenseName().isBlank()
                || request.softwareName() == null || request.softwareName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST,
                    "vendor, licenseName and softwareName are required");
        }
        Long tenantId = TenantContext.get();
        Vendor vendor = findVendorByPublicId(tenantId, vendorId);
        SoftwareProduct software = findOrCreateSoftware(tenantId, request.softwareName().strip(), vendor.getName(),
                request.version());
        Entitlement entitlement = new Entitlement();
        if (request.contractId() != null) {
            Contract contract = requireContract(request.contractId(), tenantId);
            if (!vendorId.equals(contract.getVendorId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Contract does not belong to vendor");
            }
            entitlement.setContract(contract);
            LocalDate startDate = request.startDate() == null ? contract.getStartDate() : request.startDate();
            LocalDate expiryDate = request.expiryDate() == null ? contract.getEndDate() : request.expiryDate();
            if (expiryDate.isBefore(startDate)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "expiryDate must be on or after startDate");
            }
            contract.setStartDate(startDate);
            contract.setEndDate(expiryDate);
            contractRepository.save(contract);
            entitlement.setStartDate(startDate);
            entitlement.setExpiryDate(expiryDate);
        } else {
            entitlement.setStartDate(request.startDate() == null ? LocalDate.now() : request.startDate());
            entitlement.setExpiryDate(request.expiryDate() == null ? LocalDate.of(9999, 12, 31) : request.expiryDate());
        }
        entitlement.setSoftwareProduct(software);
        entitlement.setLicenseName(request.licenseName().strip());
        entitlement.setItOwner(request.itOwner() == null ? null : request.itOwner().strip());
        entitlement.setComments(request.comments() == null ? null : request.comments().strip());
        entitlement.setLicenseType(request.licenseType());
        entitlement.setStatus(
                request.status() == null ? com.samtracker.entitlement.LicenseStatus.ACTIVE : request.status());
        entitlement.setPaymentMethod(
                request.paymentMethod() == null ? com.samtracker.entitlement.PaymentMethod.PURCHASE_ORDER
                        : request.paymentMethod());
        entitlement.setSeatsPurchased(request.seatsPurchased());
        entitlement.setPrice(request.price());
        Entitlement saved = entitlementRepository.saveAndFlush(entitlement);
        return toLicenseView(entitlementRepository.findById(saved.getId()).orElse(saved));
    }

    public ContractLicenseView updateVendorLicense(Integer vendorId, Integer licenseId,
            UpdateContractLicenseRequest request) {
        if (request == null || request.licenseName() == null || request.licenseName().isBlank()
                || request.softwareName() == null || request.softwareName().isBlank()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "licenseName and softwareName are required");
        }
        Long tenantId = TenantContext.get();
        Vendor vendor = findVendorByPublicId(tenantId, vendorId);
        Entitlement entitlement = entitlementRepository.findByTenantIdAndId(tenantId, licenseId)
                .filter(existing -> existing.getSoftwareProduct().getVendor().equalsIgnoreCase(vendor.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License not found"));
        SoftwareProduct software = findOrCreateSoftware(tenantId, request.softwareName().strip(), vendor.getName(),
                request.version());
        entitlement.setSoftwareProduct(software);
        entitlement.setLicenseName(request.licenseName().strip());
        entitlement.setComments(request.comments() == null ? null : request.comments().strip());
        entitlement.setLicenseType(request.licenseType());
        entitlement.setStatus(
                request.status() == null ? com.samtracker.entitlement.LicenseStatus.ACTIVE : request.status());
        entitlement.setPaymentMethod(
                request.paymentMethod() == null ? com.samtracker.entitlement.PaymentMethod.PURCHASE_ORDER
                        : request.paymentMethod());
        entitlement.setSeatsPurchased(request.seatsPurchased());
        entitlement.setPrice(request.price());
        if (request.contractId() != null) {
            Contract contract = requireContract(request.contractId(), tenantId);
            if (!vendorId.equals(contract.getVendorId())) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Contract does not belong to vendor");
            }
            entitlement.setContract(contract);
            LocalDate startDate = request.startDate() == null ? contract.getStartDate() : request.startDate();
            LocalDate expiryDate = request.expiryDate() == null ? contract.getEndDate() : request.expiryDate();
            if (Boolean.TRUE.equals(request.renew())) {
                startDate = contract.getEndDate();
                expiryDate = startDate.plusYears(1);
                entitlement.setStatus(com.samtracker.entitlement.LicenseStatus.ACTIVE);
            }
            if (expiryDate.isBefore(startDate)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "expiryDate must be on or after startDate");
            }
            contract.setStartDate(startDate);
            contract.setEndDate(expiryDate);
            contractRepository.save(contract);
            entitlement.setStartDate(startDate);
            entitlement.setExpiryDate(expiryDate);
        } else {
            entitlement.setContract(null);
            LocalDate startDate = request.startDate() == null ? entitlement.getStartDate() : request.startDate();
            LocalDate expiryDate = request.expiryDate() == null ? entitlement.getExpiryDate() : request.expiryDate();
            if (Boolean.TRUE.equals(request.renew())) {
                startDate = entitlement.getExpiryDate();
                expiryDate = startDate.plusYears(1);
                entitlement.setStatus(com.samtracker.entitlement.LicenseStatus.ACTIVE);
            }
            entitlement.setStartDate(startDate);
            entitlement.setExpiryDate(expiryDate);
        }
        Entitlement saved = entitlementRepository.saveAndFlush(entitlement);
        return toLicenseView(entitlementRepository.findById(saved.getId()).orElse(saved));
    }

    public void deleteVendorLicense(Integer vendorId, Integer licenseId) {
        Long tenantId = TenantContext.get();
        Vendor vendor = findVendorByPublicId(tenantId, vendorId);
        Entitlement entitlement = entitlementRepository.findByTenantIdAndId(tenantId, licenseId)
                .filter(existing -> existing.getSoftwareProduct().getVendor().equalsIgnoreCase(vendor.getName()))
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "License not found"));
        entitlementRepository.delete(entitlement);
    }

    private void validateContractInput(UpdateContractRequest request) {
        String contractNumber = request.contractNumber().strip();
        if (contractNumber.isEmpty()) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "contractNumber is required");
        }
        if (request.endDate().isBefore(request.startDate())) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "endDate must be on or after startDate");
        }
    }

    private void syncContractLicenseDates(Integer contractId, Long tenantId, LocalDate startDate, LocalDate endDate) {
        Contract contract = contractRepository.findByIdAndTenantId(contractId, tenantId).orElse(null);
        entitlementRepository.findByTenantIdAndContract_Id(tenantId, contractId).forEach(entitlement -> {
            entitlement.setStartDate(startDate);
            entitlement.setExpiryDate(endDate);
            if (contract != null) {
                entitlement.setItOwner(contract.getItOwner());
            }
        });
        entitlementRepository.flush();
    }

    private Vendor findVendorByPublicId(Long tenantId, Integer vendorId) {
        if (vendorId == null) {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "vendorId is required");
        }
        return vendorRepository.findByTenantIdAndVendorId(tenantId, vendorId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.BAD_REQUEST, "Vendor not found"));
    }

    private void attachVendorSnapshot(Contract contract) {
        if (contract.getVendorId() == null && contract.getVendorName() == null) {
            return;
        }
        Vendor vendor = new Vendor();
        vendor.setVendorId(contract.getVendorId());
        vendor.setName(contract.getVendorName());
        vendor.setVendorJDENumber(contract.getVendorJDENumber());
        contract.setVendor(vendor);
    }

    private void attachSoftwareIds(List<Contract> contracts, Long tenantId) {
        if (contracts.isEmpty()) {
            return;
        }
        Long effectiveTenantId = tenantId == null ? contracts.get(0).getTenantId() : tenantId;
        List<Integer> contractIds = contracts.stream().map(Contract::getId).toList();
        Map<Integer, List<Integer>> softwareIdsByContract = new HashMap<>();
        runInTenant(effectiveTenantId, () -> {
            entitlementRepository.findSoftwareIdsByContractIds(effectiveTenantId, contractIds).forEach(row -> {
                Integer contractId = (Integer) row[0];
                Integer softwareId = (Integer) row[1];
                if (softwareId != null) {
                    softwareIdsByContract.computeIfAbsent(contractId, ignored -> new ArrayList<>()).add(softwareId);
                }
            });
            return null;
        });
        contracts.forEach(contract -> contract.setSoftwareIds(
                softwareIdsByContract.getOrDefault(contract.getId(), List.of()).stream().distinct().sorted().toList()));
    }

    private Long resolveAccessibleContractTenant(Integer contractId) {
        if (isCurrentUserAdmin()) {
            return resolveTenantIdForContract(contractId);
        }
        return TenantContext.get();
    }

    private Contract requireContract(Integer contractId, Long tenantId) {
        return contractRepository.findByIdAndTenantId(contractId, tenantId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));
    }

    private SoftwareProduct findOrCreateSoftware(Long tenantId, String softwareName, String vendorName,
            String version) {
        String safeVersion = version == null || version.isBlank() ? "default" : version.strip();
        return softwareProductRepository.findByTenantIdAndNameAndVersion(tenantId, softwareName, safeVersion).stream()
                .filter(s -> s.getVendor().equalsIgnoreCase(vendorName))
                .findFirst()
                .orElseGet(() -> {
                    SoftwareProduct product = new SoftwareProduct();
                    product.setName(softwareName);
                    product.setVendor(vendorName);
                    product.setVersion(safeVersion);
                    SoftwareProduct saved = softwareProductRepository.saveAndFlush(product);
                    entityManager.clear();
                    return softwareProductRepository.findById(saved.getId()).orElse(saved);
                });
    }

    private ContractLicenseView toLicenseView(Entitlement entitlement) {
        SoftwareProduct software = entitlement.getSoftwareProduct();
        return new ContractLicenseView(
                entitlement.getLicenseId(),
                entitlement.getContract() == null ? null : entitlement.getContract().getId(),
                entitlement.getLicenseName(),
                entitlement.getItOwner(),
                entitlement.getComments(),
                software.getSoftwareId(),
                software.getVendor(),
                software.getName(),
                software.getVersion(),
                entitlement.getLicenseType(),
                entitlement.getStatus(),
                entitlement.getPaymentMethod(),
                entitlement.getSeatsPurchased(),
                entitlement.getPrice(),
                entitlement.getStartDate(),
                entitlement.getExpiryDate());
    }

    private <T> T runInTenant(Long tenantId, Supplier<T> action) {
        Long previousTenant = TenantContext.get();
        try {
            TenantContext.set(tenantId);
            return action.get();
        } finally {
            if (previousTenant == null) {
                TenantContext.clear();
            } else {
                TenantContext.set(previousTenant);
            }
        }
    }

    private String currentUsername() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getName() == null || auth.getName().isBlank()) {
            return "unknown";
        }
        return auth.getName();
    }

    private List<Contract> fetchContractsForAdmin(Integer contractId) {
        String sql = """
                    SELECT c.contract_id, c.tenant_id, c.contract_number, c.department, c.start_date, c.end_date, c.status, c.value,
                                        c.vendor_id AS contract_vendor_id, c.vendor_name, c.vendor_jde_number, c.software_name,
                                    v.name AS vendor_entity_name, v.vendor_id AS vendor_display_id, v.vendor_jde_number AS vendor_entity_jde_number, v.canonical_name, v.contact_email, v.website
                    FROM contracts c
                LEFT JOIN vendors v ON v.tenant_id = c.tenant_id AND v.vendor_id = c.vendor_id
                    WHERE (? IS NULL OR c.contract_id = ?)
                    ORDER BY c.start_date DESC
                    """;
        List<Contract> contracts = jdbcTemplate.query(sql, this::mapContractRow, contractId, contractId);
        attachSoftwareIds(contracts, null);
        return contracts;
    }

    private Optional<Contract> fetchContractByIdForAdmin(Integer contractId) {
        List<Contract> rows = fetchContractsForAdmin(contractId);
        if (rows.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(rows.get(0));
    }

    private Contract mapContractRow(ResultSet rs, int rowNum) throws SQLException {
        Contract contract = new Contract();
        contract.setId((Integer) rs.getObject("contract_id"));
        contract.assignTenantId(rs.getLong("tenant_id"));
        contract.setContractNumber(rs.getString("contract_number"));
        contract.setDepartment(rs.getString("department"));
        contract.setItOwner(rs.getString("it_owner"));
        contract.setVendorId((Integer) rs.getObject("contract_vendor_id"));
        contract.setVendorName(rs.getString("vendor_name"));
        contract.setVendorJDENumber(rs.getString("vendor_jde_number"));
        contract.setSoftwareName(rs.getString("software_name"));
        contract.setStartDate(rs.getObject("start_date", LocalDate.class));
        contract.setEndDate(rs.getObject("end_date", LocalDate.class));
        contract.setStatus(parseStatus(rs.getString("status")));
        contract.setValue(rs.getBigDecimal("value"));

        Integer vendorDisplayId = (Integer) rs.getObject("vendor_display_id");
        if (vendorDisplayId == null) {
            vendorDisplayId = contract.getVendorId();
        }
        if (vendorDisplayId != null) {
            Vendor vendor = new Vendor();
            vendor.setVendorId(vendorDisplayId);
            String vendorJDENumber = rs.getString("vendor_entity_jde_number");
            if (vendorJDENumber == null || vendorJDENumber.isBlank()) {
                vendorJDENumber = contract.getVendorJDENumber();
            }
            vendor.setVendorJDENumber(vendorJDENumber);
            String vendorName = rs.getString("vendor_entity_name");
            if (vendorName == null || vendorName.isBlank()) {
                vendorName = contract.getVendorName();
            }
            vendor.setName(vendorName);
            vendor.setCanonicalName(rs.getString("canonical_name"));
            vendor.setContactEmail(rs.getString("contact_email"));
            vendor.setWebsite(rs.getString("website"));
            contract.setVendor(vendor);
        }
        return contract;
    }

    private Page<Contract> pageContracts(List<Contract> contracts, Pageable pageable) {
        int from = (int) pageable.getOffset();
        if (from >= contracts.size()) {
            return new PageImpl<>(List.of(), pageable, contracts.size());
        }
        int to = Math.min(from + pageable.getPageSize(), contracts.size());
        return new PageImpl<>(contracts.subList(from, to), pageable, contracts.size());
    }

    private boolean matchesFilters(Contract contract, String q, Integer vendorId, ContractStatus status,
            LocalDate startDate, LocalDate endDate, BigDecimal minValue, BigDecimal maxValue) {
        if (q != null && !q.isBlank()) {
            String needle = q.toLowerCase(Locale.ROOT);
            String haystack = String.join(" ",
                    String.valueOf(contract.getId()),
                    String.valueOf(contract.getVendorId()),
                    safeSearch(contract.getContractNumber()),
                    safeSearch(contract.getVendorName()),
                    safeSearch(contract.getVendorJDENumber()),
                    safeSearch(contract.getSoftwareName()),
                    safeSearch(contract.getDepartment()),
                    safeSearch(contract.getStatus() == null ? null : contract.getStatus().name()),
                    safeSearch(contract.getStartDate() == null ? null : contract.getStartDate().toString()),
                    safeSearch(contract.getEndDate() == null ? null : contract.getEndDate().toString()),
                    safeSearch(contract.getValue() == null ? null : contract.getValue().toString()))
                    .toLowerCase(Locale.ROOT);
            if (!haystack.contains(needle) && !matchesLicenseSearch(contract.getId(), contract.getTenantId(), needle)) {
                return false;
            }
        }
        if (vendorId != null && !vendorId.equals(contract.getVendorId())) {
            return false;
        }
        if (status != null && contract.getStatus() != status) {
            return false;
        }
        if (startDate != null && contract.getStartDate() != null && contract.getStartDate().isBefore(startDate)) {
            return false;
        }
        if (endDate != null && contract.getStartDate() != null && contract.getStartDate().isAfter(endDate)) {
            return false;
        }
        if (minValue != null && contract.getValue() != null && contract.getValue().compareTo(minValue) < 0) {
            return false;
        }
        if (maxValue != null && contract.getValue() != null && contract.getValue().compareTo(maxValue) > 0) {
            return false;
        }
        return true;
    }

    private boolean matchesLicenseSearch(Integer contractId, Long tenantId, String needle) {
        Integer count = jdbcTemplate.queryForObject(
                """
                        SELECT COUNT(*)
                        FROM entitlements e
                        JOIN software_products s ON s.software_id = e.software_id
                        WHERE e.contract_id = ?
                          AND e.tenant_id = ?
                          AND (LOWER(COALESCE(e.license_id, '')) LIKE ?
                            OR LOWER(COALESCE(s.software_id, '')) LIKE ?
                            OR LOWER(COALESCE(e.license_name, '')) LIKE ?
                            OR LOWER(COALESCE(s.name, '')) LIKE ?
                            OR LOWER(COALESCE(s.version, '')) LIKE ?)
                        """,
                Integer.class,
                contractId,
                tenantId,
                "%" + needle + "%",
                "%" + needle + "%",
                "%" + needle + "%",
                "%" + needle + "%",
                "%" + needle + "%");
        return count != null && count > 0;
    }

    private String safeSearch(String value) {
        return value == null ? "" : value;
    }

    private Long resolveTenantIdForContract(Integer contractId) {
        return contractRepository.findTenantIdByContractId(contractId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Contract not found"));
    }

    private boolean isCurrentUserAdmin() {
        Authentication auth = SecurityContextHolder.getContext().getAuthentication();
        if (auth == null || auth.getAuthorities() == null) {
            return false;
        }
        return auth.getAuthorities().stream()
                .map(GrantedAuthority::getAuthority)
                .anyMatch("ROLE_ADMIN"::equals);
    }

    /*
     * raw import mapping removed
     * private Map<String, Integer> mapContractColumns(List<String> headers) {
     * int contractNumberCol = -1;
     * int vendorCol = -1;
     * int startDateCol = -1;
     * int endDateCol = -1;
     * int valueCol = -1;
     * int statusCol = -1;
     * 
     * for (int i = 0; i < headers.size(); i++) {
     * String h = normalize(headers.get(i));
     * if (contractNumberCol < 0 && (h.contains("contract") ||
     * h.contains("agreement"))) {
     * contractNumberCol = i;
     * }
     * if (vendorCol < 0 && (h.contains("vendor") || h.contains("supplier") ||
     * h.contains("company"))) {
     * vendorCol = i;
     * }
     * if (startDateCol < 0 && (h.contains("start date") ||
     * h.contains("effective date") || h.equals("start"))) {
     * startDateCol = i;
     * }
     * if (endDateCol < 0 && (h.contains("end date") || h.contains("expiry") ||
     * h.contains("expiration"))) {
     * endDateCol = i;
     * }
     * if (valueCol < 0
     * && (h.contains("value") || h.contains("amount") || h.contains("price") ||
     * h.contains("cost"))) {
     * valueCol = i;
     * }
     * if (statusCol < 0 && h.contains("status")) {
     * statusCol = i;
     * }
     * }
     * 
     * // Fallback positions used by import mapping defaults.
     * if (contractNumberCol < 0)
     * contractNumberCol = 0;
     * if (vendorCol < 0)
     * vendorCol = 1;
     * if (startDateCol < 0)
     * startDateCol = 2;
     * if (endDateCol < 0)
     * endDateCol = 3;
     * if (valueCol < 0)
     * valueCol = 4;
     * if (statusCol < 0)
     * statusCol = 5;
     * 
     * return Map.of(
     * "contractNumber", contractNumberCol,
     * "vendor", vendorCol,
     * "startDate", startDateCol,
     * "endDate", endDateCol,
     * "value", valueCol,
     * "status", statusCol);
     * }
     * 
     * private ContractImportedRow parseImportedContractRow(RawImportRow row,
     * Map<String, Integer> cols,
     * List<String> selectedSourceHeaders, List<String> allHeaders) {
     * Map<String, String> sourceValues = buildSourceValues(row, allHeaders,
     * selectedSourceHeaders);
     * String contractNumber = cellValue(row, cols.get("contractNumber"));
     * String vendorName = cellValue(row, cols.get("vendor"));
     * LocalDate startDate = parseDate(cellValue(row, cols.get("startDate")));
     * LocalDate endDate = parseDate(cellValue(row, cols.get("endDate")));
     * BigDecimal value = parseMoney(cellValue(row, cols.get("value")));
     * ContractStatus status = parseStatus(cellValue(row, cols.get("status")));
     * 
     * if (contractNumber.isBlank() && vendorName.isBlank() && startDate == null &&
     * endDate == null && value == null
     * && sourceValues.values().stream().allMatch(v -> v == null || v.isBlank() ||
     * "—".equals(v.trim()))) {
     * return null;
     * }
     * 
     * if (contractNumber.isBlank()) {
     * contractNumber = firstNonBlank(sourceValues.values());
     * }
     * if (contractNumber == null || contractNumber.isBlank()) {
     * contractNumber = "ROW-" + row.getRowNumber();
     * }
     * 
     * String safeVendor = vendorName.isBlank() ?
     * firstNonBlank(sourceValues.values()) : vendorName;
     * if (safeVendor == null || safeVendor.isBlank()) {
     * safeVendor = "Unknown Vendor";
     * }
     * Long effectiveTenantId = row.getTenantId() != null ? row.getTenantId() :
     * TenantContext.get();
     * return new ContractImportedRow(
     * row.getId(),
     * effectiveTenantId,
     * new ContractImportedRow.ImportedVendor(row.getId().toString(), safeVendor),
     * contractNumber,
     * startDate,
     * endDate,
     * status,
     * value,
     * sourceValues);
     * }
     * 
     * private String cellValue(RawImportRow row, Integer col) {
     * if (col == null || col < 0 || row.getValues() == null || col >=
     * row.getValues().size()) {
     * return "";
     * }
     * String value = row.getValues().get(col);
     * return value == null ? "" : value.trim();
     * }
     * 
     * private String normalize(String s) {
     * return s == null ? "" : s.toLowerCase(Locale.ROOT).replaceAll("[^a-z0-9]+",
     * " ").trim();
     * }
     * 
     * private List<Integer> resolveSourceFilterIndexes(List<String> headers,
     * List<String> selectedSourceColumns) {
     * if (headers == null || headers.isEmpty()) {
     * return List.of();
     * }
     * if (selectedSourceColumns == null || selectedSourceColumns.isEmpty()) {
     * return java.util.stream.IntStream.range(0, headers.size()).boxed().toList();
     * }
     * 
     * Map<String, Integer> normalizedHeaderToIndex = headers.stream()
     * .collect(Collectors.toMap(this::normalize, headers::indexOf, (a, b) -> a));
     * 
     * return selectedSourceColumns.stream()
     * .map(this::normalize)
     * .map(normalizedHeaderToIndex::get)
     * .filter(idx -> idx != null && idx >= 0)
     * .distinct()
     * .toList();
     * }
     * 
     * private boolean matchesSourceQuery(RawImportRow row, List<Integer> indexes,
     * String query) {
     * List<String> values = row.getValues();
     * if (values == null || values.isEmpty()) {
     * return false;
     * }
     * for (Integer idx : indexes) {
     * if (idx == null || idx < 0 || idx >= values.size()) {
     * continue;
     * }
     * String value = values.get(idx);
     * if (value != null && value.toLowerCase(Locale.ROOT).contains(query)) {
     * return true;
     * }
     * }
     * return false;
     * }
     * 
     * private List<String> resolveSelectedSourceHeaders(List<String> headers,
     * List<String> selectedSourceColumns) {
     * if (headers == null || headers.isEmpty()) {
     * return List.of();
     * }
     * if (selectedSourceColumns == null || selectedSourceColumns.isEmpty()) {
     * return headers;
     * }
     * 
     * Map<String, String> normalizedToHeader = headers.stream()
     * .collect(Collectors.toMap(this::normalize, h -> h, (a, b) -> a));
     * 
     * return selectedSourceColumns.stream()
     * .map(this::normalize)
     * .map(normalizedToHeader::get)
     * .filter(h -> h != null && !h.isBlank())
     * .distinct()
     * .toList();
     * }
     * 
     * private Map<String, String> buildSourceValues(RawImportRow row, List<String>
     * allHeaders,
     * List<String> selectedHeaders) {
     * if (selectedHeaders == null || selectedHeaders.isEmpty() || allHeaders ==
     * null || allHeaders.isEmpty()) {
     * return Map.of();
     * }
     * List<String> values = row.getValues();
     * if (values == null || values.isEmpty()) {
     * return Map.of();
     * }
     * 
     * Map<String, Integer> indexByHeader = new java.util.HashMap<>();
     * for (int i = 0; i < allHeaders.size(); i++) {
     * indexByHeader.putIfAbsent(allHeaders.get(i), i);
     * }
     * 
     * Map<String, String> out = new java.util.LinkedHashMap<>();
     * for (String header : selectedHeaders) {
     * Integer idx = indexByHeader.get(header);
     * if (idx == null || idx < 0 || idx >= values.size()) {
     * out.put(header, "");
     * continue;
     * }
     * String value = values.get(idx);
     * out.put(header, value == null ? "" : value);
     * }
     * return out;
     * }
     * 
     * private String firstNonBlank(Iterable<String> values) {
     * if (values == null) {
     * return null;
     * }
     * for (String value : values) {
     * if (value != null && !value.isBlank() && !"—".equals(value.trim())) {
     * return value;
     * }
     * }
     * return null;
     * }
     * 
     * private LocalDate parseDate(String input) {
     * if (input == null || input.isBlank()) {
     * return null;
     * }
     * String value = input.trim();
     * for (DateTimeFormatter formatter : DATE_FORMATS) {
     * try {
     * return LocalDate.parse(value, formatter);
     * } catch (DateTimeParseException ignored) {
     * }
     * }
     * return null;
     * }
     * 
     */
    private BigDecimal parseMoney(String input) {
        if (input == null || input.isBlank()) {
            return null;
        }
        String cleaned = input.replace(",", "").replace("$", "").trim();
        if (cleaned.isEmpty()) {
            return null;
        }
        try {
            return new BigDecimal(cleaned);
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private ContractStatus parseStatus(String input) {
        if (input == null || input.isBlank()) {
            return ContractStatus.ACTIVE;
        }
        String normalized = input.trim().toUpperCase(Locale.ROOT).replace('-', '_').replace(' ', '_');
        try {
            return ContractStatus.valueOf(normalized);
        } catch (IllegalArgumentException ex) {
            return ContractStatus.ACTIVE;
        }
    }
}
