package com.assurance.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;

/** Authorization for operations whose capability depends on persisted business state. */
public final class BusinessPermission {
    private BusinessPermission() {
    }

    public static boolean has(String code) {
        if (!PermissionCatalog.contains(code)) {
            return false;
        }
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        return authentication != null && authentication.isAuthenticated()
                && authentication.getAuthorities().stream()
                .anyMatch(authority -> authority.getAuthority().equals("PERM_" + code));
    }

    public static void require(String code) {
        if (!has(code)) {
            throw new AccessDeniedException("Permission requise : " + code);
        }
    }
}
