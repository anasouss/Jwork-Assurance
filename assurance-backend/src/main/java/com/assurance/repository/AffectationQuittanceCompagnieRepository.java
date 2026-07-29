package com.assurance.repository;

import com.assurance.entity.AffectationQuittanceCompagnie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;
import java.util.List;

public interface AffectationQuittanceCompagnieRepository extends JpaRepository<AffectationQuittanceCompagnie, Long> {

    @EntityGraph(attributePaths = {"compagnieAssurance"})
    List<AffectationQuittanceCompagnie> findByQuittanceIdOrderByDateEffetAscNumeroQuittanceCompagnieAsc(Long quittanceId);

    List<AffectationQuittanceCompagnie> findByQuittanceIdIn(Collection<Long> quittanceIds);

    void deleteByQuittanceId(Long quittanceId);

    boolean existsByAgenceIdAndCompagnieAssuranceIdAndNumeroQuittanceCompagnieIgnoreCaseAndQuittanceIdNot(
            Long agenceId,
            Long compagnieId,
            String numeroQuittanceCompagnie,
            Long quittanceId
    );
}
