package com.assurance.repository;

import com.assurance.entity.InstrumentReglementCompagnie;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Optional;

public interface InstrumentReglementCompagnieRepository
        extends JpaRepository<InstrumentReglementCompagnie, Long> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "agence",
            "reglement",
            "reglement.compagnieAssurance",
            "compteTresorerie",
            "affectations",
            "affectations.bordereau"
    })
    @Query("""
            select i
            from InstrumentReglementCompagnie i
            where i.id = :id and i.agence.id = :agenceId
            """)
    Optional<InstrumentReglementCompagnie> lockByIdAndAgenceId(
            @Param("id") Long id,
            @Param("agenceId") Long agenceId
    );
}
