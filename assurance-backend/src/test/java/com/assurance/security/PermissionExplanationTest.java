package com.assurance.security;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class PermissionExplanationTest {
    @Test
    void everyAssignablePermissionHasACompleteExplanation() {
        for (var permission : PermissionCatalog.definitions()) {
            var details = PermissionExplanation.forPermission(permission);
            assertThat(details).as(permission.code()).isNotNull();
            assertThat(details.page()).as(permission.code()).isNotBlank();
            assertThat(details.allows()).as(permission.code()).isNotBlank();
            assertThat(details.example()).as(permission.code()).isNotBlank();
            assertThat(details.restrictions()).as(permission.code()).isNotEmpty();
        }
    }

    @Test
    void explanationsDistinguishSensitiveWorkflows() {
        assertThat(PermissionExplanation.forPermission(PermissionCatalog.find("contrat:create")).restrictions())
                .anyMatch(text -> text.contains("contrat actif"));
        assertThat(PermissionExplanation.forPermission(PermissionCatalog.find("facture-convention:issue")).allows())
                .contains("n'enregistre ni encaissement");
        assertThat(PermissionExplanation.forPermission(PermissionCatalog.find("sinistre-provision:create")).allows())
                .contains("ne constitue pas une opération de paiement");
        assertThat(PermissionExplanation.forPermission(PermissionCatalog.find("role:assign-permissions")).restrictions())
                .anyMatch(text -> text.contains("doivent être détenues"));
    }
}
