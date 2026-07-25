package com.assurance.repository;

import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.enums.ModeTarificationGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LigneGrilleTarifaireRepository extends JpaRepository<LigneGrilleTarifaire, String> {
    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndActifTrue(String grilleTarifaireId);

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAsc(
            String grilleTarifaireId,
            String usageId,
            String garantieId
    );

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndModeTarificationAndActifTrueOrderByOrdreAffichageAsc(
            String grilleTarifaireId,
            String usageId,
            String garantieId,
            ModeTarificationGarantie modeTarification
    );
}
