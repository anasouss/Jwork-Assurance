package com.assurance.service;

import com.assurance.exception.BadRequestException;

import java.math.BigDecimal;
import java.util.Collection;

final class ConventionDocumentPolarity {
    private ConventionDocumentPolarity() {
    }

    static int direction(Collection<BigDecimal> amounts) {
        boolean positive = false;
        boolean negative = false;
        for (BigDecimal amount : amounts) {
            if (amount == null) throw new BadRequestException("Montant facturable manquant");
            positive |= amount.signum() > 0;
            negative |= amount.signum() < 0;
        }
        if (positive && negative) {
            throw new BadRequestException("Les primes et les ristournes doivent être émises dans des documents séparés");
        }
        if (!positive && !negative) throw new BadRequestException("Aucun montant non nul à émettre");
        return negative ? -1 : 1;
    }
}
