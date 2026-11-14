package com.assurance.security;

import com.assurance.entity.Permission;
import com.assurance.entity.Role;
import org.junit.jupiter.api.Test;

import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;

class PermissionCatalogTest {

    @Test
    void catalogueUsesExactlyTheSixBusinessModulesAndUniqueCodes() {
        var definitions = PermissionCatalog.definitions();
        assertThat(definitions).extracting(PermissionCatalog.Definition::code).doesNotHaveDuplicates();
        assertThat(definitions).extracting(PermissionCatalog.Definition::module)
                .containsOnly("production", "sinistre", "companies", "crm", "compta", "administration");
        for (var definition : definitions) {
            assertThat(definition.name().length()).isLessThanOrEqualTo(120);
            assertThat(definition.description().length()).isLessThanOrEqualTo(255);
            assertThat(PermissionDependencies.requiredFor(definition.code()))
                    .allMatch(PermissionCatalog::contains);
            assertThat(definition.actionLabel()).isNotBlank();
            assertThat(definition.resourceLabel()).isNotBlank();
        }
    }

    @Test
    void retiredBroadGrantsDoNotBecomeAuthorities() {
        Role role = Role.builder().permissions(Set.of(
                Permission.builder().code("tresorerie:manage").build(),
                Permission.builder().code("contrat:view").build())).build();
        assertThat(role.getPermissionCodes()).containsExactly("contrat:view");
        assertThat(role.hasPermission("tresorerie:manage")).isFalse();
        assertThat(role.hasPermission("operation-tresorerie:adjust")).isFalse();
    }

    @Test
    void onlyPlatformCapabilitiesArePlatformOnly() {
        assertThat(PermissionCatalog.find("agence:create").superAdminOnly()).isTrue();
        assertThat(PermissionCatalog.find("agence:manage-self").superAdminOnly()).isFalse();
        assertThat(PermissionCatalog.find("role:assign-permissions").superAdminOnly()).isFalse();
        assertThat(PermissionCatalog.find("reglement-client:refund").sensitive()).isTrue();
    }
}
