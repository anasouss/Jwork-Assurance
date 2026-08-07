package com.assurance.repository;

import com.assurance.entity.CompteTresorerie;
import com.assurance.enums.TypeCompteTresorerie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CompteTresorerieRepository extends JpaRepository<CompteTresorerie, Long> {
    List<CompteTresorerie> findByAgenceIdOrderByTypeCompteAscLibelleAsc(Long agenceId);

    List<CompteTresorerie> findByAgenceIdAndTypeCompteAndActifTrueOrderByLibelleAsc(
            Long agenceId,
            TypeCompteTresorerie typeCompte
    );

    Optional<CompteTresorerie> findByIdAndAgenceId(Long id, Long agenceId);

    boolean existsByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
