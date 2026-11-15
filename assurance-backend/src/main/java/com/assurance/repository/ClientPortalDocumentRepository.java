package com.assurance.repository;

import com.assurance.entity.ClientPortalDocument;
import org.springframework.data.domain.*;
import org.springframework.data.jpa.repository.*;
import org.springframework.data.repository.query.Param;
import java.util.Optional;

public interface ClientPortalDocumentRepository extends JpaRepository<ClientPortalDocument, Long> {
    String VISIBLE = " d.published = true and " + ClientPortalAccessRepository.SCOPE
            + " and ((c.id is not null and c.agence.id = :agency and c.brouillon = false and c.prospection = false"
            + " and piece.contrat = c and (piece.archived = false or piece.archived is null))"
            + " or (s.id is not null and s.agence.id = :agency and s.statut <> com.assurance.enums.StatutSinistre.BROUILLON and source.sinistre = s)) ";

    @Query("select d from ClientPortalDocument d join d.access a left join a.contrat c left join a.sinistre s left join d.pieceJointe piece left join d.sinistreDocument source where " + VISIBLE + " order by d.id desc")
    Page<ClientPortalDocument> visible(@Param("agency") Long agency, @Param("account") Long account, Pageable pageable);

    @Query("select d from ClientPortalDocument d join d.access a left join a.contrat c left join a.sinistre s left join d.pieceJointe piece left join d.sinistreDocument source where "
            + VISIBLE + " and (:contract is null or c.id = :contract) and (:claim is null or s.id = :claim) order by d.id desc")
    Page<ClientPortalDocument> visibleForDossier(@Param("agency") Long agency, @Param("account") Long account,
                                               @Param("contract") Long contract, @Param("claim") Long claim,
                                               Pageable pageable);

    @Query("select d from ClientPortalDocument d join d.access a left join a.contrat c left join a.sinistre s left join d.pieceJointe piece left join d.sinistreDocument source where " + VISIBLE + " and d.id = :id")
    Optional<ClientPortalDocument> visible(@Param("agency") Long agency, @Param("account") Long account, @Param("id") Long id);

    @Query("select d from ClientPortalDocument d where d.id = :id and d.access.account.agence.id = :agency")
    Optional<ClientPortalDocument> findForStaff(@Param("agency") Long agency, @Param("id") Long id);

    @Query("select d from ClientPortalDocument d where d.access.id = :access and d.access.account.agence.id = :agency order by d.id desc")
    Page<ClientPortalDocument> findForStaff(@Param("agency") Long agency, @Param("access") Long access, Pageable pageable);
}
