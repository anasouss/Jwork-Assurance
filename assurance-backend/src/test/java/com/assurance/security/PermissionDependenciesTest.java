package com.assurance.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PermissionDependenciesTest {

    @Test
    void actionRequiresItsReadPermission() {
        assertThat(PermissionDependencies.requiredFor("sinistre:update"))
                .containsExactly("sinistre:view");
    }

    @Test
    void contractSubresourcesRequireContractReadAccess() {
        assertThat(PermissionDependencies.requiredFor("avenant:view"))
                .containsExactly("contrat:view");
        assertThat(PermissionDependencies.requiredFor("piece-jointe:upload"))
                .containsExactly("piece-jointe:view");
    }

    @Test
    void roleAssignmentAlsoRequiresRoleReadAccess() {
        assertThat(PermissionDependencies.requiredFor("user:assign-role"))
                .containsExactlyInAnyOrder("user:view", "role:view");
    }

    @Test
    void readAndEditNeverImplyDestructiveOrFinancialActions() {
        assertThat(PermissionDependencies.requiredFor("contrat:update"))
                .containsExactly("contrat:view");
        assertThat(PermissionDependencies.requiredFor("reglement-client:view")).isEmpty();
        assertThat(PermissionDependencies.requiredFor("sinistre-operation:create"))
                .containsExactly("sinistre:view");
        assertThat(PermissionDependencies.requiredFor("sinistre:manage")).isEmpty();
    }

    @Test
    void selfAgencyManagementRemainsStandalone() {
        assertThat(PermissionDependencies.requiredFor("agence:manage-self")).isEmpty();
    }
}
