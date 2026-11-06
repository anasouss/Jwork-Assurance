package com.assurance.activity;

import com.assurance.security.AuditRequestContext;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class ActivitySurfaceTest {
    @AfterEach
    void clear() {
        AuditRequestContext.clear();
    }

    @Test
    void browserCannotClaimToBeAnImportOrSystemJob() {
        assertThat(ActivitySurface.browserHint("SYSTEM")).isEqualTo(ActivitySurface.API);
        assertThat(ActivitySurface.browserHint("IMPORT")).isEqualTo(ActivitySurface.API);
        assertThat(ActivitySurface.browserHint("/arbitrary/path")).isEqualTo(ActivitySurface.API);
        assertThat(ActivitySurface.browserHint("CONTRACT_AMENDMENT")).isEqualTo(ActivitySurface.CONTRACT_AMENDMENT);
    }

    @Test
    void contextDoesNotLeakAcrossRequests() {
        AuditRequestContext.set("request-1", "API");
        AuditRequestContext.setActivitySurface(ActivitySurface.CLIENT_REGISTER);
        assertThat(AuditRequestContext.getActivitySurface()).isEqualTo(ActivitySurface.CLIENT_REGISTER);
        AuditRequestContext.clear();
        AuditRequestContext.set("request-2", "API");
        assertThat(AuditRequestContext.getActivitySurface()).isEqualTo(ActivitySurface.API);
    }
}
