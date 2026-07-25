package com.assurance.repository;

import com.assurance.entity.CategorieClient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface CategorieClientRepository extends JpaRepository<CategorieClient, String> {
    Optional<CategorieClient> findByCodeIgnoreCase(String code);
}
