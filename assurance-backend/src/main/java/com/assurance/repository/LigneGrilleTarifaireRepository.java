package com.assurance.repository;

import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.enums.ModeTarificationGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface LigneGrilleTarifaireRepository extends JpaRepository<LigneGrilleTarifaire, Long> {
    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndActifTrue(Long grilleTarifaireId);

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndActifTrue(Long grilleTarifaireId, Long usageId);

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAsc(
            Long grilleTarifaireId,
            Long usageId,
            Long garantieId
    );

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieResponsabiliteCivileTrueAndActifTrueOrderByOrdreAffichageAsc(
            Long grilleTarifaireId,
            Long usageId
    );

    List<LigneGrilleTarifaire> findByGrilleTarifaireIdAndUsageIdAndGarantieIdAndModeTarificationAndActifTrueOrderByOrdreAffichageAsc(
            Long grilleTarifaireId,
            Long usageId,
            Long garantieId,
            ModeTarificationGarantie modeTarification
    );
}
