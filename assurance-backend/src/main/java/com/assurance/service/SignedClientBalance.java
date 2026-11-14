package com.assurance.service;

import java.math.BigDecimal;

final class SignedClientBalance {
    private SignedClientBalance() {
    }

    static BigDecimal remaining(BigDecimal total, BigDecimal settled) {
        BigDecimal remaining = total.subtract(settled);
        return total.signum() < 0 ? remaining.min(BigDecimal.ZERO) : remaining.max(BigDecimal.ZERO);
    }

    static boolean covered(BigDecimal total, BigDecimal settled) {
        return remaining(total, settled).signum() == 0;
    }

    static void requireExactNet(BigDecimal net, BigDecimal instrumentTotal) {
        if (net.signum() == 0 || net.abs().compareTo(instrumentTotal) != 0) {
            throw new com.assurance.exception.BadRequestException(
                    "Le moyen de règlement doit correspondre exactement au montant net. Un solde nul nécessite une compensation distincte");
        }
    }
}
