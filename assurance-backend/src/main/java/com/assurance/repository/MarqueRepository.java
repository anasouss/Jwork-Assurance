package com.assurance.repository;

import com.assurance.entity.Marque;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface MarqueRepository extends JpaRepository<Marque, String> {
    Optional<Marque> findByLibelleIgnoreCase(String libelle);
}
