package com.assurance.repository;

import com.assurance.entity.OrigineCommerciale;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface OrigineCommercialeRepository extends JpaRepository<OrigineCommerciale, Long> {
    List<OrigineCommerciale> findByAgenceIdOrderByOrdreAscLibelleAsc(Long agenceId);

    Optional<OrigineCommerciale> findByAgenceIdAndId(Long agenceId, Long id);

    Optional<OrigineCommerciale> findByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);

    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
}
