package com.samtracker.security;

import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ResponseStatusException;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class AuthRateLimiter {

    private static final int LOGIN_LIMIT = 5;
    private static final Duration LOGIN_WINDOW = Duration.ofMinutes(15);
    private static final int REGISTRATION_LIMIT = 3;
    private static final Duration REGISTRATION_WINDOW = Duration.ofHours(1);

    private final Map<String, Window> windows = new ConcurrentHashMap<>();

    public void checkLogin(HttpServletRequest request, String username) {
        check("login:" + clientKey(request) + ":" + username.trim().toLowerCase(), LOGIN_LIMIT, LOGIN_WINDOW);
    }

    public void checkRegistration(HttpServletRequest request, String username) {
        check("register:" + clientKey(request) + ":" + username.trim().toLowerCase(), REGISTRATION_LIMIT,
                REGISTRATION_WINDOW);
    }

    public void clearLogin(HttpServletRequest request, String username) {
        windows.remove("login:" + clientKey(request) + ":" + username.trim().toLowerCase());
    }

    private void check(String key, int limit, Duration window) {
        Instant now = Instant.now();
        Window current = windows.compute(key, (ignored, existing) -> {
            if (existing == null || existing.startedAt.plus(window).isBefore(now)) {
                return new Window(now, 1);
            }
            return new Window(existing.startedAt, existing.attempts + 1);
        });
        if (current.attempts > limit) {
            throw new ResponseStatusException(HttpStatus.TOO_MANY_REQUESTS, "Too many authentication attempts");
        }
    }

    private String clientKey(HttpServletRequest request) {
        return request.getRemoteAddr();
    }

    private record Window(Instant startedAt, int attempts) {
    }
}
