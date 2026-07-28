package com.assurance.repository;

import com.assurance.entity.CategorieClient;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface CategorieClientRepository extends JpaRepository<CategorieClient, Long> {
    Optional<CategorieClient> findByCodeIgnoreCase(String code);

    @EntityGraph(attributePaths = "usages")
    @Query("select categorie from CategorieClient categorie where categorie.id = :id")
    Optional<CategorieClient> findByIdWithUsages(@Param("id") Long id);

    @EntityGraph(attributePaths = "usages")
    List<CategorieClient> findAllByOrderByLibelleAsc();
}
