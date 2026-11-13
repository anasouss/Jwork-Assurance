package com.assurance.repository;

import com.assurance.entity.ExigenceDocumentSinistre;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;

public interface ExigenceDocumentSinistreRepository extends JpaRepository<ExigenceDocumentSinistre, Long> {

    @Query("""
            select requirement
            from ExigenceDocumentSinistre requirement
            where requirement.actif = true
              and (requirement.agence is null or requirement.agence.id = :agenceId)
            order by requirement.ordre asc, requirement.id asc
            """)
    List<ExigenceDocumentSinistre> findApplicable(
            @Param("agenceId") Long agenceId
    );
}
