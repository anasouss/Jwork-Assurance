package com.assurance.enums;

public enum NiveauAccesCompteTresorerie {
    CONSULTATION(10),
    UTILISATION(20),
    GESTION(30),
    SUPERVISION(40);

    private final int rank;

    NiveauAccesCompteTresorerie(int rank) {
        this.rank = rank;
    }

    public boolean allows(NiveauAccesCompteTresorerie required) {
        return rank >= required.rank;
    }
}
