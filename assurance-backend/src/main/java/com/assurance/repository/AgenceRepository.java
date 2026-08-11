package com.assurance.repository;

import com.assurance.entity.Agence;
import com.assurance.enums.StatutAgence;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Optional;

public interface AgenceRepository extends JpaRepository<Agence, Long> {
    List<Agence> findAllByOrderByNomAsc();

    List<Agence> findByStatutOrderByNomAsc(StatutAgence statut);

    boolean existsByIdAndStatut(Long id, StatutAgence statut);

    long countByStatut(StatutAgence statut);

    Optional<Agence> findByCode(String code);

    boolean existsByCodeIgnoreCase(String code);

    boolean existsByCodeIgnoreCaseAndIdNot(String code, Long id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select a from Agence a where a.id = :id")
    Optional<Agence> findByIdForUpdate(@Param("id") Long id);
}
