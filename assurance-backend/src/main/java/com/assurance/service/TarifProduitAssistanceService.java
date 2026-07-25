package com.assurance.service;

import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.repository.TarifProduitAssistanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
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
                .or(() -> candidates.stream().findFirst())
                .or(() -> tarifProduitAssistanceRepository
                        .findByProduitAssistanceAndActifTrueOrderByDateDebutDescCreatedAtDesc(produitAssistance)
                        .stream()
                        .findFirst())
                .orElse(null);
    }
}
