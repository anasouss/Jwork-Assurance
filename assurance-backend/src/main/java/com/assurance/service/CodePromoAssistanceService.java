package com.assurance.service;

import com.assurance.entity.CodePromoAssistance;
import com.assurance.entity.ProduitAssistance;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.CodePromoAssistanceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.List;
import java.util.Locale;

@Service
@RequiredArgsConstructor
public class CodePromoAssistanceService {

    private final CodePromoAssistanceRepository repository;

    @Transactional(readOnly = true)
    public CodePromoAssistance resolve(ProduitAssistance produit, String submittedCode, LocalDate referenceDate) {
        if (submittedCode == null || submittedCode.isBlank()) {
            return null;
        }
        String code = submittedCode.trim().toUpperCase(Locale.ROOT);
        List<CodePromoAssistance> candidates = repository
                .findByProduitAssistanceAndCodeIgnoreCaseAndActifTrueAndDateDebutLessThanEqualOrderByDateDebutDescCreatedAtDesc(
                        produit,
                        code,
                        referenceDate
                );
        return candidates.stream()
                .filter(promo -> promo.getDateFin() == null || !promo.getDateFin().isBefore(referenceDate))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Code promo invalide ou hors période pour ce produit"));
    }
}
