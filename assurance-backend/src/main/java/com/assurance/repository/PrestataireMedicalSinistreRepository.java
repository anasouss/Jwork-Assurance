package com.assurance.repository;

import com.assurance.entity.PrestataireMedicalSinistre;
import com.assurance.enums.TypePrestataireSinistre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import java.util.Optional;

public interface PrestataireMedicalSinistreRepository extends JpaRepository<PrestataireMedicalSinistre, Long>, JpaSpecificationExecutor<PrestataireMedicalSinistre> {
    Optional<PrestataireMedicalSinistre> findByIdAndAgenceId(Long id, Long agenceId);

    @org.springframework.data.jpa.repository.EntityGraph(attributePaths = {"ville", "domaines", "specialites", "accords", "accords.compagnie"})
    java.util.List<PrestataireMedicalSinistre> findByAgenceIdAndIdIn(Long agenceId, java.util.List<Long> ids);
    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
    boolean existsBySpecialitesId(Long id);
    boolean existsByDomainesIdAndTypePrestataire(Long domaineId, TypePrestataireSinistre type);
}
