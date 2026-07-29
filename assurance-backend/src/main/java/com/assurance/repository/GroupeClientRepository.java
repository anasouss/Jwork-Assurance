package com.assurance.repository;

import com.assurance.entity.GroupeClient;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface GroupeClientRepository extends JpaRepository<GroupeClient, Long> {
    Optional<GroupeClient> findByAgenceIdAndId(Long agenceId, Long id);
    boolean existsByAgenceIdAndCodeIgnoreCase(Long agenceId, String code);
    boolean existsByAgenceIdAndCodeIgnoreCaseAndIdNot(Long agenceId, String code, Long id);
    List<GroupeClient> findByAgenceIdOrderByLibelleAsc(Long agenceId);
}
