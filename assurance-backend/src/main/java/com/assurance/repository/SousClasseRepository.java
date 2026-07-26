package com.assurance.repository;

import com.assurance.entity.SousClasse;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SousClasseRepository extends JpaRepository<SousClasse, Long> {
    Optional<SousClasse> findByCodeIgnoreCase(String code);
}
