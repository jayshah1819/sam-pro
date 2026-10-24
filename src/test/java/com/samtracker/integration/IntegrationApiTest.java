package com.samtracker.integration;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.samtracker.contract.ContractService;
import com.samtracker.vendor.Vendor;
import com.samtracker.vendor.VendorService;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import org.springframework.web.server.ResponseStatusException;

import java.util.ArrayList;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class IntegrationApiTest {

    private static final String KEY = "test-key-test-key-test-key-1234";

    private VendorService vendorService;
    private ContractService contractService;
    private MockMvc mvc;

    @BeforeEach
    void setUp() {
        vendorService = mock(VendorService.class);
        contractService = mock(ContractService.class);
        mvc = MockMvcBuilders
                .standaloneSetup(new IntegrationVendorController(vendorService, contractService))
                .setControllerAdvice(new IntegrationExceptionHandler())
                .addFilters(new IntegrationApiKeyFilter(KEY, 1L, new ObjectMapper()))
                .build();
    }

    @Test
    void rejectsMissingOrWrongKey() throws Exception {
        mvc.perform(get("/api/v1/vendors")).andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("UNAUTHORIZED"));
        mvc.perform(get("/api/v1/vendors").header("X-API-Key", "wrong")).andExpect(status().isUnauthorized());
    }

    @Test
    void rejectsEverythingWhenKeyNotConfigured() throws Exception {
        MockMvc unconfigured = MockMvcBuilders
                .standaloneSetup(new IntegrationVendorController(vendorService, contractService))
                .addFilters(new IntegrationApiKeyFilter("", 1L, new ObjectMapper())).build();
        unconfigured.perform(get("/api/v1/vendors").header("X-API-Key", "")).andExpect(status().isUnauthorized());
    }

    @Test
    void listsVendorsWithKey() throws Exception {
        Vendor v = new Vendor();
        v.setVendorId(7);
        v.setName("Acme");
        when(vendorService.findByNameContains(anyString(), any(Pageable.class)))
                .thenReturn(new PageImpl<>(List.of(v)));
        mvc.perform(get("/api/v1/vendors").header("X-API-Key", KEY)).andExpect(status().isOk())
                .andExpect(jsonPath("$.items[0].id").value(7))
                .andExpect(jsonPath("$.items[0].name").value("Acme"))
                .andExpect(jsonPath("$.hasMore").value(false));
    }

    @Test
    void capsLimitAtFifty() throws Exception {
        List<Vendor> many = new ArrayList<>();
        for (int i = 0; i < 51; i++) {
            Vendor v = new Vendor();
            v.setVendorId(i);
            v.setName("V" + i);
            many.add(v);
        }
        Page<Vendor> page = new PageImpl<>(many);
        when(vendorService.findByNameContains(anyString(), any(Pageable.class))).thenReturn(page);
        mvc.perform(get("/api/v1/vendors").param("limit", "500").header("X-API-Key", KEY))
                .andExpect(status().isOk()).andExpect(jsonPath("$.limit").value(50))
                .andExpect(jsonPath("$.items.length()").value(50)).andExpect(jsonPath("$.hasMore").value(true));
        ArgumentCaptor<Pageable> captor = ArgumentCaptor.forClass(Pageable.class);
        verify(vendorService).findByNameContains(anyString(), captor.capture());
        assertEquals(51, captor.getValue().getPageSize());
    }

    @Test
    void unknownVendorReturnsNotFoundShape() throws Exception {
        when(vendorService.findById(anyInt()))
                .thenThrow(new ResponseStatusException(HttpStatus.NOT_FOUND, "Vendor not found"));
        mvc.perform(get("/api/v1/vendors/99").header("X-API-Key", KEY)).andExpect(status().isNotFound())
                .andExpect(jsonPath("$.error").value("NOT_FOUND"))
                .andExpect(jsonPath("$.message").value("Vendor not found"));
    }
}
