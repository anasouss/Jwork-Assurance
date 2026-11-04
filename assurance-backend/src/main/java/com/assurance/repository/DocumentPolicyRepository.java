package com.assurance.repository;

import com.assurance.entity.DocumentPolicy;
import org.springframework.data.jpa.repository.JpaRepository;
import java.util.Optional;

public interface DocumentPolicyRepository extends JpaRepository<DocumentPolicy, Long> {
    Optional<DocumentPolicy> findByAgenceIdAndNatureId(Long agenceId, Long natureId);
}
