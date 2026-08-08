package com.assurance.repository;

import com.assurance.entity.ReglementCompagnie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ReglementCompagnieRepository extends JpaRepository<ReglementCompagnie, Long> {

    @EntityGraph(attributePaths = {
            "compagnieAssurance",
            "creePar",
            "instruments",
            "instruments.compteTresorerie"
    })
    Optional<ReglementCompagnie> findByIdAndAgenceId(Long id, Long agenceId);
}
