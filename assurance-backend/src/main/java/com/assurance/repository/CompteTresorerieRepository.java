package com.assurance.repository;

import com.assurance.entity.CompteTresorerie;
import com.assurance.enums.NatureCaisseTresorerie;
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

    Optional<CompteTresorerie> findByAgenceIdAndTypeCompteAndNatureCaisse(
            Long agenceId,
            TypeCompteTresorerie typeCompte,
            NatureCaisseTresorerie natureCaisse
    );

    Optional<CompteTresorerie> findByAgenceIdAndUtilisateurTitulaireIdAndTypeCompteAndNatureCaisseAndActifTrue(
            Long agenceId,
            Long utilisateurId,
            TypeCompteTresorerie typeCompte,
            NatureCaisseTresorerie natureCaisse
    );

    List<CompteTresorerie> findByUtilisateurTitulaireIdAndTypeCompteAndNatureCaisse(
            Long utilisateurId,
            TypeCompteTresorerie typeCompte,
            NatureCaisseTresorerie natureCaisse
    );

    boolean existsByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);

    boolean existsByAgenceIdAndUtilisateurTitulaireIdAndNatureCaisse(
            Long agenceId,
            Long utilisateurId,
            NatureCaisseTresorerie natureCaisse
    );

    boolean existsByAgenceIdAndUtilisateurTitulaireIdAndNatureCaisseAndIdNot(
            Long agenceId,
            Long utilisateurId,
            NatureCaisseTresorerie natureCaisse,
            Long id
    );

    boolean existsByAgenceIdAndTypeCompteAndNatureCaisseAndIdNot(
            Long agenceId,
            TypeCompteTresorerie typeCompte,
            NatureCaisseTresorerie natureCaisse,
            Long id
    );

    boolean existsByAgenceIdAndTypeCompteAndNatureCaisse(
            Long agenceId,
            TypeCompteTresorerie typeCompte,
            NatureCaisseTresorerie natureCaisse
    );
}
