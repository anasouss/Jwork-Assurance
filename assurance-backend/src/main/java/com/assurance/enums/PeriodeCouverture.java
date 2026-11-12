package com.assurance.enums;

import java.time.LocalDate;

public enum PeriodeCouverture {
    J5(5, 0),
    J10(10, 0),
    M1(0, 1),
    M3(0, 3),
    M6(0, 6),
    M12(0, 12);

    private final int jours;
    private final int mois;

    PeriodeCouverture(int jours, int mois) {
        this.jours = jours;
        this.mois = mois;
    }

    public LocalDate dateExpiration(LocalDate dateEffet) {
        return dateEffet.plusMonths(mois).plusDays(jours).minusDays(1);
    }

    public String getLibelle() {
        return jours > 0 ? jours + " jours" : mois + " mois";
    }
}
