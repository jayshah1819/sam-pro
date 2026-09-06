package com.samtracker.security;

import jakarta.servlet.http.HttpServletRequest;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.lang.NonNull;
import org.springframework.web.server.ResponseStatusException;

import static org.junit.jupiter.api.Assertions.assertThrows;

class AuthRateLimiterTest {

    @Test
    void limitsRepeatedLoginAttemptsByClientAndUsername() {
        AuthRateLimiter limiter = new AuthRateLimiter();
        HttpServletRequest request = requestFrom("203.0.113.10");

        for (int attempt = 0; attempt < 5; attempt++) {
            limiter.checkLogin(request, "admin");
        }

        assertThrows(ResponseStatusException.class, () -> limiter.checkLogin(request, "admin"));
    }

    private HttpServletRequest requestFrom(@NonNull String address) {
        MockHttpServletRequest request = new MockHttpServletRequest();
        request.setRemoteAddr(address);
        return request;
    }
}