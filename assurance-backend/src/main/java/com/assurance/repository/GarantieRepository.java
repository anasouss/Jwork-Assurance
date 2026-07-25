package com.assurance.repository;

import com.assurance.entity.Garantie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GarantieRepository extends JpaRepository<Garantie, String> {
    Optional<Garantie> findByCode(String code);
}
