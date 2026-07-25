package com.assurance.repository;

import com.assurance.entity.FormuleGarantiePersonne;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface FormuleGarantiePersonneRepository extends JpaRepository<FormuleGarantiePersonne, String> {
    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndUsageIdAndActifTrue(String grilleTarifaireId, String usageId);

    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
            String grilleTarifaireId,
            String usageId,
            String garantieId
    );

    List<FormuleGarantiePersonne> findByGrilleTarifaireIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
            String grilleTarifaireId,
            String garantieId
    );
}
