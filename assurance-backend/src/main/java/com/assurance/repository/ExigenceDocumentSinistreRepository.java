package com.assurance.repository;

import com.assurance.entity.ExigenceDocumentSinistre;
import com.assurance.enums.NatureSinistre;
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
              and (requirement.nature is null or requirement.nature = :nature)
            order by requirement.ordre asc, requirement.id asc
            """)
    List<ExigenceDocumentSinistre> findApplicable(
            @Param("agenceId") Long agenceId,
            @Param("nature") NatureSinistre nature
    );
}
