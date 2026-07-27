package com.assurance.repository;

import com.assurance.entity.Contrat;
import com.assurance.enums.TypeContrat;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ContratRepository extends JpaRepository<Contrat, Long> {
    List<Contrat> findByAgenceIdOrderByCreatedAtDesc(Long agenceId);

    List<Contrat> findByAgenceIdAndProspectionFalseOrderByCreatedAtDesc(Long agenceId);

    List<Contrat> findByAgenceIdAndProspectionTrueOrderByCreatedAtDesc(Long agenceId);

    List<Contrat> findByAgenceIdAndProspectionTrueAndTypeContratOrderByCreatedAtDesc(Long agenceId, TypeContrat typeContrat);

    @EntityGraph(attributePaths = {
            "agence",
            "compagnieAssurance",
            "convention"
    })
    Optional<Contrat> findByAgenceIdAndId(Long agenceId, Long id);

    boolean existsByAgenceIdAndNumeroContrat(Long agenceId, String numeroContrat);

    boolean existsByAgenceIdAndNumeroContratAndIdNot(Long agenceId, String numeroContrat, Long id);

    boolean existsByAgenceIdAndNumeroDossier(Long agenceId, String numeroDossier);

    boolean existsByAgenceIdAndNumeroDevis(Long agenceId, String numeroDevis);

    @Query("""
            select c.numeroDevis
            from Contrat c
            where c.agence.id = :agenceId
              and c.numeroDevis is not null
              and upper(c.numeroDevis) like concat(:prefix, '%')
            """)
    List<String> findNumeroDevisByAgenceIdAndPrefix(@Param("agenceId") Long agenceId, @Param("prefix") String prefix);

    @EntityGraph(attributePaths = {
            "compagnieAssurance",
            "clients",
            "clients.client",
            "clients.client.telephones",
            "vehicules",
            "vehicules.marque"
    })
    @Query("""
            select distinct c
            from Contrat c
            where c.agence.id = :agenceId
              and c.prospection = false
              and c.brouillon = false
              and c.dateEcheance between :dateDu and :dateAu
              and (:compagnieId is null or c.compagnieAssurance.id = :compagnieId)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
            order by c.dateEcheance asc, c.numeroDossier asc, c.id asc
            """)
    List<Contrat> findAutomobileEcheances(
            @Param("agenceId") Long agenceId,
            @Param("dateDu") java.time.LocalDate dateDu,
            @Param("dateAu") java.time.LocalDate dateAu,
            @Param("compagnieId") Long compagnieId,
            @Param("typeContrat") TypeContrat typeContrat
    );
}
