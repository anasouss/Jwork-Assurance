package com.assurance.repository;

import com.assurance.entity.TarifUsage;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TarifUsageRepository extends JpaRepository<TarifUsage, Long> {

    @Override
    @EntityGraph(attributePaths = {"usage", "categorieTransport", "carburants", "sousClasse"})
    List<TarifUsage> findAll();

    @Override
    @EntityGraph(attributePaths = {"usage", "categorieTransport", "carburants", "sousClasse"})
    Optional<TarifUsage> findById(Long id);

    @EntityGraph(attributePaths = {"usage", "categorieTransport", "carburants", "sousClasse"})
    List<TarifUsage> findByUsage_IdAndActifTrue(Long usageId);
}
