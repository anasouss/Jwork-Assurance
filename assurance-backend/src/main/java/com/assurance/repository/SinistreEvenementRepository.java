package com.assurance.repository;

import com.assurance.entity.SinistreEvenement;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface SinistreEvenementRepository extends JpaRepository<SinistreEvenement, Long> {

    @EntityGraph(attributePaths = "utilisateur")
    List<SinistreEvenement> findBySinistreIdOrderByCreatedAtDesc(Long sinistreId);
}
