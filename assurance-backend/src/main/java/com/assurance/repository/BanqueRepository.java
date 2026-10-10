package com.assurance.repository;

import com.assurance.entity.Banque;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface BanqueRepository extends JpaRepository<Banque, Long> {
    List<Banque> findByAgenceIdOrderByOrdreAscLibelleAsc(Long agenceId);

    Optional<Banque> findByAgenceIdAndId(Long agenceId, Long id);

    Optional<Banque> findByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
