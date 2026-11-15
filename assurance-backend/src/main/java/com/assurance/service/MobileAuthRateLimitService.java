package com.assurance.service;

import com.assurance.security.ClientPortalCredentials;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import java.time.Instant;

@Service
@RequiredArgsConstructor
public class MobileAuthRateLimitService {
    private final JdbcTemplate jdbc;

    @Value("${app.security.mobile-auth-requests-per-minute:30}")
    private int limit;

    @Transactional
    public boolean allow(String remoteAddress) {
        long slot = Instant.now().getEpochSecond() / 60;
        String key = ClientPortalCredentials.hash("mobile-auth:" + remoteAddress);
        jdbc.update("""
                INSERT INTO mobile_auth_request_limits (bucket_key, window_slot, attempts)
                VALUES (?, ?, 1)
                ON DUPLICATE KEY UPDATE
                    attempts = IF(window_slot = VALUES(window_slot), attempts + 1, 1),
                    window_slot = VALUES(window_slot)
                """, key, slot);
        Integer attempts = jdbc.queryForObject(
                "SELECT attempts FROM mobile_auth_request_limits WHERE bucket_key = ?", Integer.class, key);
        jdbc.update("DELETE FROM mobile_auth_request_limits WHERE window_slot < ? LIMIT 100", slot - 120);
        return attempts != null && attempts <= limit;
    }
}
