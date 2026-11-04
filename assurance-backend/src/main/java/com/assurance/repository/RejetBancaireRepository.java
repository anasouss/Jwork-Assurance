package com.assurance.repository;

import com.assurance.entity.RejetBancaire;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface RejetBancaireRepository extends JpaRepository<RejetBancaire, Long> {
    Optional<RejetBancaire> findByIdAndAgenceId(Long id, Long agenceId);

    List<RejetBancaire> findByAgenceIdAndInstrumentIdOrderByIdAsc(Long agenceId, Long instrumentId);

    @Modifying
    @Query(value = """
            INSERT INTO sequences_rejets_bancaires (agence_id, annee, valeur)
            VALUES (:agenceId, :annee, 1)
            ON DUPLICATE KEY UPDATE valeur = valeur + 1
            """, nativeQuery = true)
    void incrementSequence(@Param("agenceId") Long agenceId, @Param("annee") int annee);

    @Query(value = "SELECT valeur FROM sequences_rejets_bancaires WHERE agence_id = :agenceId AND annee = :annee", nativeQuery = true)
    long currentSequence(@Param("agenceId") Long agenceId, @Param("annee") int annee);
}
