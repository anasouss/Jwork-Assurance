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
import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface DocumentClientRepository extends JpaRepository<DocumentClient, Long> {

    @EntityGraph(attributePaths = {
            "clientPayeur",
            "groupePayeur",
            "documentOrigine",
            "documentRemplacement"
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
              and ((:clientPortefeuilleId is null and :contratId is null and :brancheId is null) or exists (
                    select 1 from LigneDocumentClient documentLine
                    join documentLine.elementFacturable element
                    join element.contrat contract
                    left join contract.payeurPrime portfolioPayer
                    where documentLine.document = d
                      and element.agence.id = :agenceId
                      and (:contratId is null or contract.id = :contratId)
                      and (:brancheId is null or contract.brancheAssurance.id = :brancheId)
                      and (:clientPortefeuilleId is null
                            or portfolioPayer.id = :clientPortefeuilleId
                            or exists (
                                select 1 from ContratClient portfolioCc
                                where portfolioCc.contrat = contract
                                  and portfolioCc.client.id = :clientPortefeuilleId
                            ))
              ))
              and (
                    :search is null
                    or lower(d.numero) like concat('%', :search, '%')
                    or lower(d.payeurNom) like concat('%', :search, '%')
                    or lower(coalesce(d.payeurIdentifiant, '')) like concat('%', :search, '%')
              )
            """)
    Page<DocumentClient> search(
            @Param("agenceId") Long agenceId,
            @Param("type") TypeDocumentClient type,
            @Param("statut") StatutDocumentClient statut,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("payeurType") String payeurType,
            @Param("payeurId") Long payeurId,
            @Param("clientPortefeuilleId") Long clientPortefeuilleId,
            @Param("contratId") Long contratId,
            @Param("brancheId") Long brancheId,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "clientPayeur",
            "groupePayeur"
    })
    @Query(value = """
            select distinct d
            from DocumentClient d
            where d.agence.id = :agenceId
              and d.typeDocument = com.assurance.enums.TypeDocumentClient.FACTURE
              and d.statut = com.assurance.enums.StatutDocumentClient.EMIS
              and (:conventionsOnly = false or exists (
                    select 1 from LigneDocumentClient conventionLine
                    join conventionLine.echeanceFacturationConvention schedule
                    where conventionLine.document = d
                      and schedule.agence.id = :agenceId
                      and schedule.contrat.agence.id = :agenceId
                      and (:conventionId is null or schedule.contrat.convention.id = :conventionId)
              ))
              and (:includeSettled = true or coalesce((
                    select sum(paymentAllocation.montant)
                    from AffectationReglementClient paymentAllocation
                    where paymentAllocation.documentClient = d
                      and paymentAllocation.statut = com.assurance.enums.StatutAffectationReglement.CONFIRMEE
                      and paymentAllocation.instrument.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
              ), 0) + coalesce((
                    select sum(adjustment.montant) from EcartReglementClient adjustment
                    where adjustment.agence.id = :agenceId
                      and adjustment.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
                      and exists (select 1 from LigneDocumentClient adjustedLine
                                  where adjustedLine.document = d and adjustedLine.elementFacturable = adjustment.elementFacturable)
              ), 0) < d.totalDocument)
              and (:dateDu is null or d.dateEmission >= :dateDu)
              and (:dateAu is null or d.dateEmission <= :dateAu)
              and (:saisieDu is null or d.createdAt >= :saisieDu)
              and (:saisieAuExclusive is null or d.createdAt < :saisieAuExclusive)
              and (:brancheId is null or exists (
                    select 1 from LigneDocumentClient branchLine
                    join branchLine.elementFacturable branchElement
                    where branchLine.document = d
                      and ((branchElement.nature <> com.assurance.enums.NatureElementFacturable.ASSISTANCE
                            and branchElement.contrat.brancheAssurance.id = :brancheId)
                           or (branchElement.nature = com.assurance.enums.NatureElementFacturable.ASSISTANCE and exists (
                            select 1 from AssistanceContrat branchAssistance
                            where branchAssistance.elementFacturable = branchElement
                              and branchAssistance.actif = true
                              and branchAssistance.brancheAssurance.id = :brancheId
                      )))
              ))
              and (:compagnieId is null or exists (
                    select 1 from LigneDocumentClient companyLine
                    where companyLine.document = d
                      and companyLine.elementFacturable.nature <> com.assurance.enums.NatureElementFacturable.ASSISTANCE
                      and companyLine.elementFacturable.contrat.compagnieAssurance.id = :compagnieId
              ))
              and (:compagnieAssistanceId is null or exists (
                    select 1 from LigneDocumentClient assistanceLine
                    join assistanceLine.elementFacturable assistanceElement
                    where assistanceLine.document = d
                      and exists (
                            select 1 from AssistanceContrat companyAssistance
                            where companyAssistance.elementFacturable = assistanceElement
                              and companyAssistance.actif = true
                              and companyAssistance.compagnieAssistance.id = :compagnieAssistanceId
                      )
              ))
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
            """, countQuery = """
            select count(d.id)
            from DocumentClient d
            where d.agence.id = :agenceId
              and d.typeDocument = com.assurance.enums.TypeDocumentClient.FACTURE
              and d.statut = com.assurance.enums.StatutDocumentClient.EMIS
              and (:conventionsOnly = false or exists (
                    select 1 from LigneDocumentClient conventionLine
                    join conventionLine.echeanceFacturationConvention schedule
                    where conventionLine.document = d
                      and schedule.agence.id = :agenceId
                      and schedule.contrat.agence.id = :agenceId
                      and (:conventionId is null or schedule.contrat.convention.id = :conventionId)
              ))
              and (:includeSettled = true or coalesce((
                    select sum(paymentAllocation.montant)
                    from AffectationReglementClient paymentAllocation
                    where paymentAllocation.documentClient = d
                      and paymentAllocation.statut = com.assurance.enums.StatutAffectationReglement.CONFIRMEE
                      and paymentAllocation.instrument.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
              ), 0) + coalesce((
                    select sum(adjustment.montant) from EcartReglementClient adjustment
                    where adjustment.agence.id = :agenceId
                      and adjustment.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
                      and exists (select 1 from LigneDocumentClient adjustedLine
                                  where adjustedLine.document = d and adjustedLine.elementFacturable = adjustment.elementFacturable)
              ), 0) < d.totalDocument)
              and (:dateDu is null or d.dateEmission >= :dateDu)
              and (:dateAu is null or d.dateEmission <= :dateAu)
              and (:saisieDu is null or d.createdAt >= :saisieDu)
              and (:saisieAuExclusive is null or d.createdAt < :saisieAuExclusive)
              and (:brancheId is null or exists (
                    select 1 from LigneDocumentClient branchLine
                    join branchLine.elementFacturable branchElement
                    where branchLine.document = d
                      and ((branchElement.nature <> com.assurance.enums.NatureElementFacturable.ASSISTANCE
                            and branchElement.contrat.brancheAssurance.id = :brancheId)
                           or (branchElement.nature = com.assurance.enums.NatureElementFacturable.ASSISTANCE and exists (
                            select 1 from AssistanceContrat branchAssistance
                            where branchAssistance.elementFacturable = branchElement
                              and branchAssistance.actif = true
                              and branchAssistance.brancheAssurance.id = :brancheId
                      )))
              ))
              and (:compagnieId is null or exists (
                    select 1 from LigneDocumentClient companyLine
                    where companyLine.document = d
                      and companyLine.elementFacturable.nature <> com.assurance.enums.NatureElementFacturable.ASSISTANCE
                      and companyLine.elementFacturable.contrat.compagnieAssurance.id = :compagnieId
              ))
              and (:compagnieAssistanceId is null or exists (
                    select 1 from LigneDocumentClient assistanceLine
                    join assistanceLine.elementFacturable assistanceElement
                    where assistanceLine.document = d
                      and exists (
                            select 1 from AssistanceContrat companyAssistance
                            where companyAssistance.elementFacturable = assistanceElement
                              and companyAssistance.actif = true
                              and companyAssistance.compagnieAssistance.id = :compagnieAssistanceId
                      )
              ))
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
            """)
    Page<DocumentClient> searchOpenInvoices(
            @Param("agenceId") Long agenceId,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("saisieDu") LocalDateTime saisieDu,
            @Param("saisieAuExclusive") LocalDateTime saisieAuExclusive,
            @Param("brancheId") Long brancheId,
            @Param("compagnieId") Long compagnieId,
            @Param("compagnieAssistanceId") Long compagnieAssistanceId,
            @Param("payeurType") String payeurType,
            @Param("payeurId") Long payeurId,
            @Param("search") String search,
            @Param("conventionsOnly") boolean conventionsOnly,
            @Param("conventionId") Long conventionId,
            @Param("includeSettled") boolean includeSettled,
            Pageable pageable
    );

    default Page<DocumentClient> searchOpenInvoices(
            Long agenceId, LocalDate dateDu, LocalDate dateAu, LocalDateTime saisieDu,
            LocalDateTime saisieAuExclusive, Long brancheId, Long compagnieId,
            Long compagnieAssistanceId, String payeurType, Long payeurId, String search,
            Pageable pageable
    ) {
        return searchOpenInvoices(agenceId, dateDu, dateAu, saisieDu, saisieAuExclusive,
                brancheId, compagnieId, compagnieAssistanceId, payeurType, payeurId, search,
                false, null, false, pageable);
    }

    @EntityGraph(attributePaths = {
            "agence",
            "clientPayeur",
            "clientPayeur.ville",
            "groupePayeur",
            "documentOrigine",
            "documentRemplacement",
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
            "documentOrigine",
            "documentRemplacement",
            "lignes",
            "lignes.elementFacturable",
            "lignes.echeanceFacturationConvention"
    })
    @Query("""
            select distinct d
            from DocumentClient d
            where d.agence.id = :agenceId
              and d.id = :documentId
            """)
    Optional<DocumentClient> findByAgenceIdAndIdForUpdate(
            @Param("agenceId") Long agenceId,
            @Param("documentId") Long documentId
    );

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

    @EntityGraph(attributePaths = {
            "clientPayeur",
            "groupePayeur"
    })
    @Query("""
            select distinct d
            from DocumentClient d
            where d.agence.id = :agenceId
              and d.id in :documentIds
              and d.typeDocument = com.assurance.enums.TypeDocumentClient.FACTURE
              and d.statut = com.assurance.enums.StatutDocumentClient.EMIS
            """)
    List<DocumentClient> findIssuedInvoices(
            @Param("agenceId") Long agenceId,
            @Param("documentIds") Collection<Long> documentIds
    );
}
