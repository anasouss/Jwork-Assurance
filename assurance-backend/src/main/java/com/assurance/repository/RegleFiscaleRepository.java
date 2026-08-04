package com.assurance.repository;

import com.assurance.entity.RegleFiscale;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface RegleFiscaleRepository extends JpaRepository<RegleFiscale, Long> {

    @Override
    @EntityGraph(attributePaths = {"brancheAssurance", "compagnieAssurance", "categorieClient", "garantie", "usage", "groupeUsageAttestation"})
    List<RegleFiscale> findAll();

    @EntityGraph(attributePaths = {"brancheAssurance", "compagnieAssurance", "categorieClient", "garantie", "usage", "groupeUsageAttestation"})
    @Query("""
            select r from RegleFiscale r
            where r.actif = true
              and r.dateDebut <= :dateEffet
              and (r.dateFin is null or r.dateFin > :dateEffet)
            """)
    List<RegleFiscale> findActiveAt(@Param("dateEffet") LocalDate dateEffet);

    Optional<RegleFiscale> findByCodeIgnoreCaseAndDateDebut(String code, LocalDate dateDebut);
}
