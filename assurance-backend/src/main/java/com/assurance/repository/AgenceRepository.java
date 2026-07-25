package com.assurance.repository;

import com.assurance.entity.Agence;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AgenceRepository extends JpaRepository<Agence, String> {
    Optional<Agence> findByCode(String code);
}
