package com.assurance.repository;

import com.assurance.entity.FormuleGarantiePersonne;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FormuleGarantiePersonneRepository extends JpaRepository<FormuleGarantiePersonne, Long> {
    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndUsageIdAndActifTrue(Long grilleTarifaireId, Long usageId);

    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
            Long grilleTarifaireId,
            Long usageId,
            Long garantieId
    );

    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
            Long grilleTarifaireId,
            Long garantieId
    );
}
