package com.assurance.security;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.authentication.TestingAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class BusinessPermissionTest {
    @AfterEach
    void clearContext() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void requiresTheExactActiveCapabilityAndAuthenticatedActor() {
        assertThat(BusinessPermission.has("contrat:view")).isFalse();
        SecurityContextHolder.getContext().setAuthentication(new TestingAuthenticationToken(
                "actor", "unused", "PERM_contrat:update", "PERM_tresorerie:manage"));
        assertThat(BusinessPermission.has("contrat:update")).isTrue();
        assertThat(BusinessPermission.has("contrat:delete")).isFalse();
        assertThat(BusinessPermission.has("tresorerie:manage")).isFalse();
        assertThatThrownBy(() -> BusinessPermission.require("contrat:delete"))
                .isInstanceOf(AccessDeniedException.class);
    }
}
