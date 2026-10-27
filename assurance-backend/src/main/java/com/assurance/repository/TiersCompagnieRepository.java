package com.assurance.repository;

import com.assurance.entity.TiersCompagnie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TiersCompagnieRepository extends JpaRepository<TiersCompagnie, Long> {

    @EntityGraph(attributePaths = {"compagnieAssurance", "compagnieAssistance"})
    Optional<TiersCompagnie> findByCompagnieAssuranceId(Long compagnieAssuranceId);

    @EntityGraph(attributePaths = {"compagnieAssurance", "compagnieAssistance"})
    Optional<TiersCompagnie> findByCompagnieAssistanceId(Long compagnieAssistanceId);

    @EntityGraph(attributePaths = {"compagnieAssurance", "compagnieAssistance"})
    List<TiersCompagnie> findAllByOrderByTypeAscIdAsc();
}
