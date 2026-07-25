package com.assurance.repository;

import com.assurance.entity.Carburant;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CarburantRepository extends JpaRepository<Carburant, String> {
    Optional<Carburant> findByCodeIgnoreCase(String code);
    Optional<Carburant> findByLibelleIgnoreCase(String libelle);
}
