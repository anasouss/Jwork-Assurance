package com.assurance.repository;

import com.assurance.entity.Garantie;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GarantieRepository extends JpaRepository<Garantie, Long> {
    @Override
    @EntityGraph(attributePaths = {
            "groupeExclusion",
            "modesTarificationMultiple",
            "modesAutorises",
            "sourcesValeurAutorisees"
    })
    List<Garantie> findAll(Sort sort);

    Optional<Garantie> findByCode(String code);
}
