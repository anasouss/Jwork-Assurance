package com.assurance.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PermissionDependenciesTest {

    @Test
    void actionRequiresItsReadPermission() {
        assertThat(PermissionDependencies.requiredFor("sinistre:manage"))
                .containsExactly("sinistre:view");
    }

    @Test
    void contractSubresourcesRequireContractReadAccess() {
        assertThat(PermissionDependencies.requiredFor("avenant:view"))
                .containsExactly("contrat:view");
        assertThat(PermissionDependencies.requiredFor("piece-jointe:manage"))
                .containsExactly("piece-jointe:view");
    }

    @Test
    void userManagementAlsoRequiresRoleReadAccess() {
        assertThat(PermissionDependencies.requiredFor("user:manage"))
                .containsExactlyInAnyOrder("user:view", "role:view");
    }

    @Test
    void selfAgencyManagementRemainsStandalone() {
        assertThat(PermissionDependencies.requiredFor("agence:manage-self")).isEmpty();
    }
}
