package com.assurance.repository;

import com.assurance.entity.Sinistre;
import com.assurance.enums.StatutSinistre;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface SinistreRepository extends JpaRepository<Sinistre, Long>, JpaSpecificationExecutor<Sinistre> {

    @EntityGraph(attributePaths = {
            "contrat",
            "client",
            "vehicule",
            "compagnieAssurance",
            "gestionnaire",
            "mouvementCouverture",
            "couverture"
    })
    Optional<Sinistre> findByIdAndAgenceId(Long id, Long agenceId);

    @org.springframework.data.jpa.repository.Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Sinistre s where s.id = :id and s.agence.id = :agenceId")
    Optional<Sinistre> findByIdAndAgenceIdForUpdate(@Param("id") Long id, @Param("agenceId") Long agenceId);

    long countByAgenceIdAndStatutIn(Long agenceId, List<StatutSinistre> statuts);

    long countByAgenceIdAndEtapeSuiviInAndStatutIn(
            Long agenceId,
            List<com.assurance.enums.EtapeSuiviSinistre> etapes,
            List<StatutSinistre> statuts
    );

    long countByAgenceIdAndDateDeclarationBetween(Long agenceId, LocalDate dateDu, LocalDate dateAu);

    long countByAgenceIdAndDateEcheanceActionLessThanEqualAndStatutIn(
            Long agenceId,
            LocalDate date,
            List<StatutSinistre> statuts
    );

    List<Sinistre> findTop8ByAgenceIdOrderByUpdatedAtDesc(Long agenceId);

    boolean existsByAgenceIdAndNumeroSinistreIgnoreCase(Long agenceId, String numeroSinistre);

    @Query("""
            select s from Sinistre s
            where s.agence.id = :agenceId
              and s.contrat.id = :contratId
              and s.dateSinistre = :dateSinistre
              and ((:vehiculeId is null and s.vehicule is null) or s.vehicule.id = :vehiculeId)
            order by s.createdAt desc
            """)
    List<Sinistre> findPossibleDuplicates(
            @Param("agenceId") Long agenceId,
            @Param("contratId") Long contratId,
            @Param("vehiculeId") Long vehiculeId,
            @Param("dateSinistre") LocalDate dateSinistre
    );
}
