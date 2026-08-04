package com.assurance.repository;

import com.assurance.entity.ApplicationRegleFiscaleQuittance;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Optional;

public interface ApplicationRegleFiscaleQuittanceRepository extends JpaRepository<ApplicationRegleFiscaleQuittance, Long> {
    void deleteByQuittanceId(Long quittanceId);
    boolean existsByRegleFiscaleId(Long regleFiscaleId);

    @Query("select max(a.dateEffet) from ApplicationRegleFiscaleQuittance a where a.regleFiscale.id = :ruleId")
    Optional<LocalDate> findLatestApplicationDate(@Param("ruleId") Long ruleId);
}
