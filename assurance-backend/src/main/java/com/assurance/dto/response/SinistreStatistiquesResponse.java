package com.assurance.dto.response;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

public record SinistreStatistiquesResponse(
        int annee,
        LocalDate dateSituation,
        List<Integer> anneesDisponibles,
        long declares,
        long ouverts,
        long clotures,
        long rejetes,
        long actionsEnRetard,
        BigDecimal delaiMoyenClotureJours,
        BigDecimal provisionsOuvertes,
        BigDecimal reglementsCumules,
        BigDecimal recoursCumules,
        BigDecimal fraisCumules,
        List<Mois> evolution,
        List<Repartition> parEtape,
        List<Repartition> parBranche,
        List<Compagnie> parCompagnie
) {
    public record Mois(int mois, long declarations) {
    }

    public record Repartition(String code, String libelle, long nombre) {
    }

    public record Compagnie(Long id, String nom, long dossiers, BigDecimal provisions,
                            BigDecimal reglements, BigDecimal recours, BigDecimal frais) {
    }
}
