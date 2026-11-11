package com.assurance.service;

import com.assurance.entity.Convention;
import com.assurance.enums.Fractionnement;
import com.assurance.enums.TypeEcheanceConvention;
import com.assurance.exception.BadRequestException;

import java.time.LocalDate;
import java.time.MonthDay;
import java.util.ArrayList;
import java.util.List;

final class ConventionBillingPeriods {
    private ConventionBillingPeriods() {
    }

    static int months(Fractionnement frequency) {
        return switch (frequency) {
            case MENSUEL -> 1;
            case TRIMESTRIEL -> 3;
            case SEMESTRIEL -> 6;
            case ANNUEL -> 12;
        };
    }

    static List<Period> cycle(Convention convention, int year) {
        if (convention.getFractionnement() == null) {
            throw new BadRequestException("Le fractionnement de la convention doit etre renseigne");
        }
        MonthDay anniversary;
        if (convention.getTypeEcheance() == TypeEcheanceConvention.A_ECHEANCE) {
            String code = convention.getEcheance();
            if (code == null || !code.matches("\\d{2}/\\d{2}")) {
                throw new BadRequestException("L'echeance annuelle de la convention doit etre renseignee (JJ/MM)");
            }
            try {
                anniversary = MonthDay.of(Integer.parseInt(code.substring(3)), Integer.parseInt(code.substring(0, 2)));
            } catch (RuntimeException exception) {
                throw new BadRequestException("Echeance annuelle de convention invalide");
            }
        } else {
            if (convention.getDateEffet() == null) {
                throw new BadRequestException("La date d'effet de la convention doit etre renseignee");
            }
            anniversary = MonthDay.from(convention.getDateEffet());
        }
        LocalDate anchor = anniversary.atYear(year);
        int step = months(convention.getFractionnement());
        List<Period> result = new ArrayList<>();
        for (int index = 0; index < 12 / step; index++) {
            result.add(new Period(year, index + 1, anchor.plusMonths((long) index * step),
                    (index == 12 / step - 1 ? anniversary.atYear(year + 1)
                            : anchor.plusMonths((long) (index + 1) * step)).minusDays(1)));
        }
        return result;
    }

    static List<Period> covering(Convention convention, LocalDate start, LocalDate end) {
        List<Period> result = new ArrayList<>();
        for (int year = start.getYear() - 1; year <= end.getYear(); year++) {
            cycle(convention, year).stream()
                    .filter(period -> !period.end().isBefore(start) && !period.start().isAfter(end))
                    .forEach(result::add);
        }
        return result;
    }

    record Period(int year, int number, LocalDate start, LocalDate end) {
    }
}
