package com.assurance.repository;

import com.assurance.entity.GroupeExclusionGarantie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface GroupeExclusionGarantieRepository extends JpaRepository<GroupeExclusionGarantie, Long> {
    Optional<GroupeExclusionGarantie> findByCodeIgnoreCase(String code);
}
