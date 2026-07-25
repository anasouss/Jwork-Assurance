package com.assurance.repository;

import com.assurance.entity.Carrosserie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CarrosserieRepository extends JpaRepository<Carrosserie, String> {
    Optional<Carrosserie> findByLibelleIgnoreCase(String libelle);
}
