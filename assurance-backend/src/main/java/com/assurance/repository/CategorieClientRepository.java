package com.assurance.repository;

import com.assurance.entity.CategorieClient;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategorieClientRepository extends JpaRepository<CategorieClient, Long> {
    Optional<CategorieClient> findByCodeIgnoreCase(String code);

    @EntityGraph(attributePaths = "usages")
    List<CategorieClient> findAllByOrderByLibelleAsc();
}
