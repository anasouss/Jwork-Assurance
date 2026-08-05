package com.assurance.repository;

import com.assurance.entity.SinistreGarantie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SinistreGarantieRepository extends JpaRepository<SinistreGarantie, Long> {

    @EntityGraph(attributePaths = {"garantie", "mouvementGarantieSource"})
    List<SinistreGarantie> findBySinistreIdOrderBySnapshotCode(Long sinistreId);

    Optional<SinistreGarantie> findByIdAndSinistreId(Long id, Long sinistreId);
}
