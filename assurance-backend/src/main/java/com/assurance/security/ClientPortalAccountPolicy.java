package com.assurance.security;

import com.assurance.entity.ClientPortalAccount;
import com.assurance.enums.StatutAgence;

public final class ClientPortalAccountPolicy {
    private ClientPortalAccountPolicy() {
    }

    public static boolean isAvailable(ClientPortalAccount account, boolean featureEnabled) {
        return featureEnabled && account != null && account.isActif()
                && account.getAgence() != null && account.getAgence().getId() != null
                && account.getAgence().getStatut() == StatutAgence.ACTIVE
                && account.getClient() != null && Boolean.TRUE.equals(account.getClient().getActif())
                && account.getClient().getAgence() != null
                && account.getAgence().getId().equals(account.getClient().getAgence().getId());
    }
}
