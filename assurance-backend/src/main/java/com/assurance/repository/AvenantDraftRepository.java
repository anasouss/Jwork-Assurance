package com.assurance.repository;

import com.assurance.entity.AvenantDraft;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface AvenantDraftRepository extends JpaRepository<AvenantDraft, Long> {

    Optional<AvenantDraft> findByAgenceIdAndContratIdAndTypeMouvementCodeIgnoreCase(
            Long agenceId,
            Long contratId,
            String codeTypeMouvement
    );

    void deleteByContratIdAndTypeMouvementCodeIgnoreCase(Long contratId, String codeTypeMouvement);
}
