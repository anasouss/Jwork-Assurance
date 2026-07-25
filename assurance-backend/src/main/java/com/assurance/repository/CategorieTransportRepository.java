package com.assurance.repository;

import com.assurance.entity.CategorieTransport;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface CategorieTransportRepository extends JpaRepository<CategorieTransport, String> {
    Optional<CategorieTransport> findByCodeIgnoreCase(String code);

    List<CategorieTransport> findByActifTrueOrderByLibelleAsc();
}
