package com.samtracker.auth;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

// Tracks who is currently signed in. JWTs are stateless, so "online" is derived from
// recent authenticated activity rather than a server-side session.
@Service
public class SessionActivityService {

    private static final Logger log = LoggerFactory.getLogger(SessionActivityService.class);

    private final CredentialRepository credentialRepository;
    private final Duration writeInterval;
    private final Duration onlineWindow;
    private final Map<String, Instant> lastWriteByUsername = new ConcurrentHashMap<>();

    public SessionActivityService(CredentialRepository credentialRepository,
            @Value("${app.auth.activity-write-interval-seconds:60}") long writeIntervalSeconds,
            @Value("${app.auth.online-window-seconds:300}") long onlineWindowSeconds) {
        this.credentialRepository = credentialRepository;
        this.writeInterval = Duration.ofSeconds(writeIntervalSeconds);
        this.onlineWindow = Duration.ofSeconds(onlineWindowSeconds);
    }

    // Called on every authenticated request, so the DB write is throttled per user
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordActivity(String username) {
        Instant now = Instant.now();
        Instant previous = lastWriteByUsername.get(username);
        if (previous != null && previous.plus(writeInterval).isAfter(now)) {
            return;
        }
        lastWriteByUsername.put(username, now);
        try {
            credentialRepository.touchLastSeen(username, now);
        } catch (RuntimeException ex) {
            // Activity tracking must never break the request it is piggybacking on
            lastWriteByUsername.remove(username);
            log.debug("Could not record activity for '{}'", username, ex);
        }
    }

    public void forget(String username) {
        lastWriteByUsername.remove(username);
    }

    public boolean isOnline(Instant lastSeenAt) {
        return lastSeenAt != null && lastSeenAt.isAfter(Instant.now().minus(onlineWindow));
    }

    public long onlineWindowSeconds() {
        return onlineWindow.toSeconds();
    }
}
