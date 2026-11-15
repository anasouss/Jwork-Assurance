package com.assurance.security;

import org.springframework.security.access.AccessDeniedException;
import org.springframework.security.core.context.SecurityContextHolder;

public record ClientPortalPrincipal(Long accountId, Long agenceId, Long clientId) {
    public static ClientPortalPrincipal current() {
        var authentication = SecurityContextHolder.getContext().getAuthentication();
        if (authentication == null || !(authentication.getPrincipal() instanceof ClientPortalPrincipal principal)) {
            throw new AccessDeniedException("Accès réservé au portail client");
        }
        return principal;
    }
}
