package com.assurance.repository;

import com.assurance.entity.DocumentClient;
import com.assurance.enums.StatutDocumentClient;
import com.assurance.enums.TypeDocumentClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DocumentClientRepository extends JpaRepository<DocumentClient, Long> {

    @EntityGraph(attributePaths = {
            "clientPayeur",
            "groupePayeur"
    })
    @Query("""
            select distinct d
            from DocumentClient d
            where d.agence.id = :agenceId
              and (:type is null or d.typeDocument = :type)
              and (:statut is null or d.statut = :statut)
              and (:dateDu is null or d.dateEmission >= :dateDu)
              and (:dateAu is null or d.dateEmission <= :dateAu)
              and (:payeurId is null or (
                    (:payeurType = 'CLIENT' and d.clientPayeur.id = :payeurId and d.groupePayeur is null)
                    or (:payeurType = 'GROUPE' and d.groupePayeur.id = :payeurId)
              ))
              and (
                    :search is null
                    or lower(d.numero) like concat('%', :search, '%')
                    or lower(d.payeurNom) like concat('%', :search, '%')
                    or lower(coalesce(d.payeurIdentifiant, '')) like concat('%', :search, '%')
              )
            order by d.dateEmission desc, d.id desc
            """)
    Page<DocumentClient> search(
            @Param("agenceId") Long agenceId,
            @Param("type") TypeDocumentClient type,
            @Param("statut") StatutDocumentClient statut,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("payeurType") String payeurType,
            @Param("payeurId") Long payeurId,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "agence",
            "clientPayeur",
            "clientPayeur.ville",
            "groupePayeur",
            "lignes",
            "lignes.quittance",
            "lignes.elementFacturable",
            "lignes.elementFacturable.contrat",
            "lignes.echeanceFacturationConvention"
    })
    Optional<DocumentClient> findByAgenceIdAndId(Long agenceId, Long id);

    @Lock(jakarta.persistence.LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "clientPayeur",
            "groupePayeur",
            "lignes",
            "lignes.elementFacturable"
    })
    @Query("""
            select distinct d
            from DocumentClient d
            where d.agence.id = :agenceId
              and d.id in :documentIds
              and d.typeDocument = com.assurance.enums.TypeDocumentClient.FACTURE
              and d.statut = com.assurance.enums.StatutDocumentClient.EMIS
            """)
    List<DocumentClient> findIssuedInvoicesForUpdate(
            @Param("agenceId") Long agenceId,
            @Param("documentIds") Collection<Long> documentIds
    );
}
