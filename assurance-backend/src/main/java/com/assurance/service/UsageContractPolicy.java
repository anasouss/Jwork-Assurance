package com.assurance.service;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.entity.Usage;
import com.assurance.enums.PeriodeCouverture;
import com.assurance.exception.BadRequestException;

import java.time.LocalDate;

final class UsageContractPolicy {
    private UsageContractPolicy() {
    }

    static LocalDate resolveExpiration(Usage usage, CreateContratRequest request, LocalDate fallback) {
        if (usage == null) {
            return fallback;
        }
        if (Boolean.TRUE.equals(usage.getFermeUniquement())
                && !"ferme".equalsIgnoreCase(request.getTypeRenouvellement())) {
            throw new BadRequestException("Cet usage autorise uniquement les contrats fermes");
        }
        if (usage.getPeriodesAutorisees().isEmpty()) {
            return fallback;
        }
        if (request.getDateEffet() == null && request.getPeriodicite() == null) {
            return fallback;
        }
        PeriodeCouverture periode;
        try {
            periode = PeriodeCouverture.valueOf(request.getPeriodicite() == null ? "" : request.getPeriodicite());
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Selectionnez une periode de couverture autorisee pour cet usage");
        }
        if (!usage.getPeriodesAutorisees().contains(periode)) {
            throw new BadRequestException("Cette periode de couverture n'est pas autorisee pour cet usage");
        }
        return request.getDateEffet() == null ? fallback : periode.dateExpiration(request.getDateEffet());
    }
}
