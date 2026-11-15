package com.assurance.security;

import com.assurance.entity.Permission;
import com.assurance.entity.Role;
import com.assurance.entity.Utilisateur;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;

import java.util.Set;
import java.util.stream.Collectors;

import static org.assertj.core.api.Assertions.assertThat;

class JwtTokenProviderTest {
    @Test
    void portalTokensHaveAnExplicitPrincipalTypeAndNoEmployeeRole() {
        JwtTokenProvider provider = new JwtTokenProvider();
        ReflectionTestUtils.setField(provider, "jwtSecret", "test-secret-with-at-least-sixty-four-characters-for-token-signing-1234");
        ReflectionTestUtils.setField(provider, "accessTokenExpiration", 900_000L);
        provider.init();
        String token = provider.generateClientPortalToken(12L, 7L, 42L);
        assertThat(provider.isClientPortalToken(token)).isTrue();
        assertThat(provider.getClaims(token)).doesNotContainKeys("role", "permissions", "platformAdmin");
        assertThat(provider.getAgenceIdFromToken(token)).isEqualTo(7L);
        assertThat(provider.getSessionIdFromToken(token)).isEqualTo(42L);
    }

    @Test
    void largePermissionCatalogueDoesNotIncreaseAccessTokenSize() {
        JwtTokenProvider provider = new JwtTokenProvider();
        ReflectionTestUtils.setField(provider, "jwtSecret", "test-secret-with-at-least-sixty-four-characters-for-token-signing-1234");
        ReflectionTestUtils.setField(provider, "accessTokenExpiration", 900_000L);
        provider.init();
        Set<Permission> permissions = PermissionCatalog.definitions().stream()
                .map(definition -> Permission.builder().code(definition.code()).build())
                .collect(Collectors.toSet());
        Role role = Role.builder().code("AGENCY_ADMIN").permissions(permissions).build();
        Utilisateur user = Utilisateur.builder().email("admin@example.test").role(role).build();
        user.setId(12L);

        String token = provider.generateAccessToken(user, 7L, 42L);

        assertThat(token.length()).isLessThan(1_024);
        assertThat(provider.validateToken(token)).isTrue();
        assertThat(provider.getClaims(token)).doesNotContainKey("permissions");
        assertThat(provider.getUserIdFromToken(token)).isEqualTo(12L);
        assertThat(provider.getAgenceIdFromToken(token)).isEqualTo(7L);
        assertThat(provider.getSessionIdFromToken(token)).isEqualTo(42L);
        assertThat(user.getPermissions()).hasSize(permissions.size());

        role.setPermissions(Set.of());
        assertThat(provider.generateAccessToken(user, 7L, 42L).length()).isEqualTo(token.length());
    }
}
