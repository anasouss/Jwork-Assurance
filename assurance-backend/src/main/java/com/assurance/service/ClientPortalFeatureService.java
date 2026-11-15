package com.assurance.service;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.AccessDeniedException;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class ClientPortalFeatureService {
    public static final String PARAMETER = "ENABLE_CLIENT_PORTAL";
    private final ParametreApplicationService parameters;

    public boolean isEnabled(Long agenceId) {
        return agenceId != null && parameters.getBoolean(agenceId, PARAMETER, false);
    }

    public void requireEnabled(Long agenceId) {
        if (!isEnabled(agenceId)) {
            throw new AccessDeniedException("Le portail client est désactivé pour cette agence");
        }
    }
}
