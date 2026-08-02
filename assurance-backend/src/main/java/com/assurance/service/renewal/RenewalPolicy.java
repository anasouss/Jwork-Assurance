package com.assurance.service.renewal;

import com.assurance.entity.Contrat;
import org.springframework.stereotype.Component;

import java.time.LocalDate;

@Component
public class RenewalPolicy {

    public boolean isCompanyTermEligible(Contrat contrat) {
        if (contrat == null
                || !"renouvelable".equalsIgnoreCase(normalize(contrat.getTypeRenouvellement()))
                || contrat.getDateEcheance() == null) {
            return false;
        }
        LocalDate echeance = contrat.getDateEcheance();
        int month = echeance.getMonthValue();
        return (month == 3 || month == 6 || month == 9 || month == 12)
                && echeance.getDayOfMonth() == echeance.lengthOfMonth();
    }

    private String normalize(String value) {
        return value == null ? "" : value.trim();
    }
}
