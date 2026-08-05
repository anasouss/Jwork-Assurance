package com.assurance.repository;

import com.assurance.entity.SinistrePartie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SinistrePartieRepository extends JpaRepository<SinistrePartie, Long> {

    List<SinistrePartie> findBySinistreIdOrderByCreatedAt(Long sinistreId);

    Optional<SinistrePartie> findByIdAndSinistreId(Long id, Long sinistreId);
}
