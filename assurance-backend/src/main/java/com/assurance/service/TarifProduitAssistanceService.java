package com.assurance.service;

import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.repository.TarifProduitAssistanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class TarifProduitAssistanceService {

    private final TarifProduitAssistanceRepository tarifProduitAssistanceRepository;

    @Transactional(readOnly = true)
    public TarifProduitAssistance resolveTarifForDate(ProduitAssistance produitAssistance, LocalDate referenceDate) {
        if (produitAssistance == null) {
            return null;
        }
        LocalDate reference = referenceDate == null ? LocalDate.now() : referenceDate;
        List<TarifProduitAssistance> candidates = tarifProduitAssistanceRepository
                .findByProduitAssistanceAndActifTrueAndDateDebutLessThanEqualOrderByDateDebutDescCreatedAtDesc(produitAssistance, reference);
        return candidates.stream()
                .filter(tarif -> tarif.getDateFin() == null || !tarif.getDateFin().isBefore(reference))
                .findFirst()
                .orElse(null);
    }

    @Transactional(readOnly = true)
    public TarifProduitAssistance resolveTravelTarif(
            ProduitAssistance produitAssistance,
            LocalDate referenceDate,
            int requestedDurationMonths,
            int age
    ) {
        int tariffDuration = requestedDurationMonths == 6 ? 6 : 12;
        List<TarifProduitAssistance> candidates = tarifProduitAssistanceRepository
                .findByProduitAssistanceAndActifTrueAndDateDebutLessThanEqualOrderByDateDebutDescCreatedAtDesc(
                        produitAssistance,
                        referenceDate
                );
        return candidates.stream()
                .filter(tarif -> tarif.getDateFin() == null || !tarif.getDateFin().isBefore(referenceDate))
                .filter(tarif -> tarif.getDureeMois() == null || tarif.getDureeMois() == tariffDuration)
                .filter(tarif -> tarif.getAgeMin() == null || age >= tarif.getAgeMin())
                .filter(tarif -> tarif.getAgeMax() == null || age <= tarif.getAgeMax())
                .min(Comparator
                        .comparingInt((TarifProduitAssistance tarif) -> tarif.getDureeMois() == null ? 1 : 0)
                        .thenComparingInt(this::ageRangeWidth)
                        .thenComparing(TarifProduitAssistance::getDateDebut, Comparator.reverseOrder())
                        .thenComparing(TarifProduitAssistance::getId, Comparator.nullsLast(Comparator.reverseOrder())))
                .orElse(null);
    }

    private int ageRangeWidth(TarifProduitAssistance tarif) {
        int min = tarif.getAgeMin() == null ? 0 : tarif.getAgeMin();
        int max = tarif.getAgeMax() == null ? 200 : tarif.getAgeMax();
        return max - min;
    }
}
