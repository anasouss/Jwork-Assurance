package com.assurance.repository;

import com.assurance.entity.ParametreApplication;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface ParametreApplicationRepository extends JpaRepository<ParametreApplication, Long> {
    Optional<ParametreApplication> findByAgence_IdAndCodeIgnoreCaseAndActifTrue(Long agenceId, String code);
    Optional<ParametreApplication> findByAgenceIsNullAndCodeIgnoreCaseAndActifTrue(String code);
}
