package com.assurance.repository;

import com.assurance.entity.SinistreDocument;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SinistreDocumentRepository extends JpaRepository<SinistreDocument, Long> {

    @EntityGraph(attributePaths = {"deposePar", "validePar"})
    List<SinistreDocument> findBySinistreIdOrderByCreatedAtDesc(Long sinistreId);

    Optional<SinistreDocument> findByIdAndSinistreId(Long id, Long sinistreId);
}
