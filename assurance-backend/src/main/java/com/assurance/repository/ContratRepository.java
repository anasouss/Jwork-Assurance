package com.assurance.repository;

import com.assurance.entity.Contrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.StatutContrat;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface ContratRepository extends JpaRepository<Contrat, Long> {
    List<Contrat> findByAgenceIdOrderByCreatedAtDesc(Long agenceId);

    List<Contrat> findByAgenceIdAndProspectionFalseOrderByCreatedAtDesc(Long agenceId);

    List<Contrat> findByAgenceIdAndProspectionTrueOrderByCreatedAtDesc(Long agenceId);

    List<Contrat> findByAgenceIdAndProspectionTrueAndTypeContratOrderByCreatedAtDesc(Long agenceId, TypeContrat typeContrat);

    @EntityGraph(attributePaths = {
            "agence",
            "compagnieAssurance",
            "convention"
    })
    Optional<Contrat> findByAgenceIdAndId(Long agenceId, Long id);

    Optional<Contrat> findFirstByAgenceIdAndContratOrigineIdAndStatutAndBrouillonTrueOrderByCreatedAtDesc(
            Long agenceId,
            Long contratOrigineId,
            StatutContrat statut
    );

    boolean existsByAgenceIdAndNumeroContrat(Long agenceId, String numeroContrat);

    boolean existsByAgenceIdAndNumeroContratAndIdNot(Long agenceId, String numeroContrat, Long id);

    boolean existsByAgenceIdAndNumeroDossier(Long agenceId, String numeroDossier);

    boolean existsByAgenceIdAndNumeroDevis(Long agenceId, String numeroDevis);

    @Query("""
            select c.numeroDevis
            from Contrat c
            where c.agence.id = :agenceId
              and c.numeroDevis is not null
              and upper(c.numeroDevis) like concat(:prefix, '%')
            """)
    List<String> findNumeroDevisByAgenceIdAndPrefix(@Param("agenceId") Long agenceId, @Param("prefix") String prefix);

    @Query(value = """
            select c.id
            from Contrat c
            left join c.compagnieAssurance ca
            where c.agence.id = :agenceId
              and c.prospection = false
              and c.brouillon = false
              and c.dateEcheance between :dateDu and :dateAu
              and (:compagnieId is null or ca.id = :compagnieId)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.code, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from ContratClient cc
                        join cc.client cl
                        where cc.contrat = c
                          and (
                                lower(coalesce(cl.codeClient, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.rc, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.cin, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.ice, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.telephone, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
                    or exists (
                        select 1
                        from Vehicule v
                        left join v.marque m
                        where v.contrat = c
                          and (
                                lower(coalesce(v.immatriculation, '')) like concat('%', :search, '%')
                                or lower(coalesce(m.libelle, '')) like concat('%', :search, '%')
                          )
                    )
              )
            order by c.dateEcheance asc, c.numeroDossier asc, c.id asc
            """, countQuery = """
            select count(c.id)
            from Contrat c
            left join c.compagnieAssurance ca
            where c.agence.id = :agenceId
              and c.prospection = false
              and c.brouillon = false
              and c.dateEcheance between :dateDu and :dateAu
              and (:compagnieId is null or ca.id = :compagnieId)
              and (:typeContrat is null or c.typeContrat = :typeContrat)
              and (
                    :search is null
                    or lower(coalesce(c.numeroDossier, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroContrat, '')) like concat('%', :search, '%')
                    or lower(coalesce(c.numeroPolice, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.nom, '')) like concat('%', :search, '%')
                    or lower(coalesce(ca.code, '')) like concat('%', :search, '%')
                    or exists (
                        select 1
                        from ContratClient cc
                        join cc.client cl
                        where cc.contrat = c
                          and (
                                lower(coalesce(cl.codeClient, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.rc, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.cin, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.ice, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.telephone, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.raisonSociale, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.nom, '')) like concat('%', :search, '%')
                                or lower(coalesce(cl.prenom, '')) like concat('%', :search, '%')
                          )
                    )
                    or exists (
                        select 1
                        from Vehicule v
                        left join v.marque m
                        where v.contrat = c
                          and (
                                lower(coalesce(v.immatriculation, '')) like concat('%', :search, '%')
                                or lower(coalesce(m.libelle, '')) like concat('%', :search, '%')
                          )
                    )
              )
            """)
    Page<Long> findAutomobileEcheanceIds(
            @Param("agenceId") Long agenceId,
            @Param("dateDu") java.time.LocalDate dateDu,
            @Param("dateAu") java.time.LocalDate dateAu,
            @Param("compagnieId") Long compagnieId,
            @Param("typeContrat") TypeContrat typeContrat,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "compagnieAssurance"
    })
    List<Contrat> findByAgenceIdAndIdIn(Long agenceId, List<Long> ids);

    @EntityGraph(attributePaths = {
            "compagnieAssurance",
            "payeurPrime",
            "groupeFacturation",
            "clients",
            "clients.client"
    })
    @Query("""
            select distinct contrat
            from Contrat contrat
            left join contrat.clients lien
            where contrat.agence.id = :agenceId
              and (
                    lien.client.id = :clientId
                    or contrat.payeurPrime.id = :clientId
              )
            order by contrat.createdAt desc, contrat.id desc
            """)
    List<Contrat> findForClientCrm(
            @Param("agenceId") Long agenceId,
            @Param("clientId") Long clientId
    );
}
