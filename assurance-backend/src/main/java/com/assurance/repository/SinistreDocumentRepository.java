package com.assurance.repository;

import com.assurance.entity.SinistreDocument;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface SinistreDocumentRepository extends JpaRepository<SinistreDocument, Long> {
    @org.springframework.data.jpa.repository.Query("select d from SinistreDocument d where d.sinistre.id = :claim and d.sinistre.agence.id = :agency order by d.id desc")
    org.springframework.data.domain.Page<SinistreDocument> findPortalSources(
            @org.springframework.data.repository.query.Param("agency") Long agency,
            @org.springframework.data.repository.query.Param("claim") Long claim,
            org.springframework.data.domain.Pageable pageable);

    @EntityGraph(attributePaths = {
            "deposePar",
            "validePar",
            "sinistreGarantie",
            "missionExpertise",
            "garage",
            "sourcePieceJointe"
    })
    List<SinistreDocument> findBySinistreIdOrderByCreatedAtDesc(Long sinistreId);

    Optional<SinistreDocument> findByIdAndSinistreId(Long id, Long sinistreId);

    boolean existsBySinistreId(Long sinistreId);

    boolean existsBySinistreIdAndType(Long sinistreId, com.assurance.enums.TypeDocumentSinistre type);

    boolean existsBySinistreIdAndTypeAndSourcePieceJointeIsNotNullAndStatutNot(
            Long sinistreId, com.assurance.enums.TypeDocumentSinistre type,
            com.assurance.enums.StatutDocumentSinistre statut);
}
