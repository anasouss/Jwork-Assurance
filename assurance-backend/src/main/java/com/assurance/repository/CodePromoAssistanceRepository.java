package com.assurance.repository;

import com.assurance.entity.CodePromoAssistance;
import com.assurance.entity.ProduitAssistance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface CodePromoAssistanceRepository extends JpaRepository<CodePromoAssistance, Long> {
    List<CodePromoAssistance> findByProduitAssistanceOrderByDateDebutDescCreatedAtDesc(ProduitAssistance produit);

    List<CodePromoAssistance> findByProduitAssistanceAndCodeIgnoreCaseAndActifTrueAndDateDebutLessThanEqualOrderByDateDebutDescCreatedAtDesc(
            ProduitAssistance produit,
            String code,
            LocalDate date
    );
}
