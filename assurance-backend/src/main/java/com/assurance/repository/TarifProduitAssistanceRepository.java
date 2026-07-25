package com.assurance.repository;

import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.LocalDate;
import java.util.List;

public interface TarifProduitAssistanceRepository extends JpaRepository<TarifProduitAssistance, String> {
    List<TarifProduitAssistance> findByProduitAssistanceAndActifTrueOrderByDateDebutDescCreatedAtDesc(ProduitAssistance produitAssistance);

    List<TarifProduitAssistance> findByProduitAssistanceAndActifTrueAndDateDebutLessThanEqualOrderByDateDebutDescCreatedAtDesc(
            ProduitAssistance produitAssistance,
            LocalDate referenceDate
    );
}
