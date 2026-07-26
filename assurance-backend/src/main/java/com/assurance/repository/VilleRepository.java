package com.assurance.repository;

import com.assurance.entity.Ville;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface VilleRepository extends JpaRepository<Ville, Long> {
    Optional<Ville> findByNomIgnoreCase(String nom);
}
