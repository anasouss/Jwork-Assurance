package com.assurance.repository;

import com.assurance.entity.InstrumentReglementClient;
import com.assurance.enums.StatutInstrumentReglement;
import com.assurance.enums.ModeReglementClient;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.repository.query.Param;

import java.time.LocalDate;
import java.util.List;
import java.util.Collection;
import java.util.Optional;
import jakarta.persistence.LockModeType;

public interface InstrumentReglementClientRepository extends JpaRepository<InstrumentReglementClient, Long> {

    @EntityGraph(attributePaths = {
            "reglement",
            "compteTresorerie",
            "affectations",
            "affectations.elementFacturable",
            "affectations.documentClient"
    })
    List<InstrumentReglementClient> findByAgenceIdAndStatutOrderByDateEcheanceAscIdAsc(
            Long agenceId,
            StatutInstrumentReglement statut
    );

    @EntityGraph(attributePaths = {
            "reglement",
            "compteTresorerie",
            "affectations",
            "affectations.elementFacturable",
            "affectations.documentClient"
    })
    List<InstrumentReglementClient> findByAgenceIdAndStatutInOrderByDateEcheanceAscIdAsc(
            Long agenceId,
            Collection<StatutInstrumentReglement> statuts
    );

    @EntityGraph(attributePaths = {"reglement", "compteTresorerie"})
    @Query("""
            select instrument
            from InstrumentReglementClient instrument
            join instrument.reglement reglement
            where instrument.agence.id = :agenceId
              and instrument.statut = com.assurance.enums.StatutInstrumentReglement.EN_ATTENTE
              and instrument.mode in :modes
              and (:dateDu is null or coalesce(instrument.dateEcheance, instrument.dateInstrument) >= :dateDu)
              and (:dateAu is null or coalesce(instrument.dateEcheance, instrument.dateInstrument) <= :dateAu)
              and (:search is null
                   or lower(reglement.numero) like lower(concat('%', :search, '%'))
                   or lower(reglement.payeurNom) like lower(concat('%', :search, '%'))
                   or lower(coalesce(instrument.referenceInstrument, '')) like lower(concat('%', :search, '%'))
                   or lower(coalesce(instrument.banqueEmettrice, '')) like lower(concat('%', :search, '%')))
              and not exists (
                    select line.id
                    from LigneBordereauRemise line
                    where line.instrument = instrument
                      and line.bordereau.statut in (
                          com.assurance.enums.StatutBordereauRemise.BROUILLON,
                          com.assurance.enums.StatutBordereauRemise.DEPOSE,
                          com.assurance.enums.StatutBordereauRemise.PARTIELLEMENT_TRAITE
                      )
              )
            order by coalesce(instrument.dateEcheance, instrument.dateInstrument) asc, instrument.id asc
            """)
    Page<InstrumentReglementClient> searchEligibleForRemittance(
            @Param("agenceId") Long agenceId,
            @Param("modes") Collection<ModeReglementClient> modes,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {"reglement", "compteTresorerie"})
    @Query("""
            select instrument
            from InstrumentReglementClient instrument
            where instrument.agence.id = :agenceId and instrument.id in :ids
            """)
    List<InstrumentReglementClient> findAllByAgenceIdAndIdInForUpdate(
            @Param("agenceId") Long agenceId,
            @Param("ids") Collection<Long> ids
    );

    @EntityGraph(attributePaths = {
            "reglement",
            "compteTresorerie"
    })
    @Query("""
            select instrument
            from InstrumentReglementClient instrument
            join instrument.reglement reglement
            where instrument.agence.id = :agenceId
              and instrument.statut = :statut
              and instrument.mode <> com.assurance.enums.ModeReglementClient.ESPECES
              and (
                    :dateDu is null
                    or (:statut = com.assurance.enums.StatutInstrumentReglement.EN_ATTENTE
                        and instrument.dateInstrument >= :dateDu)
                    or (:statut <> com.assurance.enums.StatutInstrumentReglement.EN_ATTENTE
                        and instrument.dateStatut >= :dateDu)
              )
              and (
                    :dateAu is null
                    or (:statut = com.assurance.enums.StatutInstrumentReglement.EN_ATTENTE
                        and instrument.dateInstrument <= :dateAu)
                    or (:statut <> com.assurance.enums.StatutInstrumentReglement.EN_ATTENTE
                        and instrument.dateStatut <= :dateAu)
              )
              and (
                    :search is null
                    or lower(reglement.numero) like lower(concat('%', :search, '%'))
                    or lower(reglement.payeurNom) like lower(concat('%', :search, '%'))
                    or lower(coalesce(instrument.referenceInstrument, '')) like lower(concat('%', :search, '%'))
                    or lower(coalesce(instrument.banqueEmettrice, '')) like lower(concat('%', :search, '%'))
              )
            order by
              case when instrument.statut = com.assurance.enums.StatutInstrumentReglement.EN_ATTENTE
                   then coalesce(instrument.dateEcheance, instrument.dateInstrument) end asc,
              case when instrument.statut <> com.assurance.enums.StatutInstrumentReglement.EN_ATTENTE
                   then instrument.dateStatut end desc,
              instrument.id desc
            """)
    Page<InstrumentReglementClient> searchByStatus(
            @Param("agenceId") Long agenceId,
            @Param("statut") StatutInstrumentReglement statut,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    @EntityGraph(attributePaths = {
            "reglement",
            "compteTresorerie",
            "affectations",
            "affectations.elementFacturable",
            "affectations.documentClient"
    })
    Optional<InstrumentReglementClient> findByIdAndAgenceId(Long id, Long agenceId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @EntityGraph(attributePaths = {
            "reglement",
            "compteTresorerie",
            "affectations",
            "affectations.elementFacturable",
            "affectations.documentClient"
    })
    @Query("""
            select instrument
            from InstrumentReglementClient instrument
            where instrument.id = :id
              and instrument.agence.id = :agenceId
            """)
    Optional<InstrumentReglementClient> findByIdAndAgenceIdForUpdate(
            @Param("id") Long id,
            @Param("agenceId") Long agenceId
    );
}
