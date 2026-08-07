package com.assurance.repository;

import com.assurance.entity.MouvementTresorerie;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MouvementTresorerieRepository extends JpaRepository<MouvementTresorerie, Long> {

    @EntityGraph(attributePaths = {"compteTresorerie", "instrumentReglement", "instrumentReglement.reglement"})
    List<MouvementTresorerie> findByAgenceIdOrderByDateOperationDescIdDesc(Long agenceId);

    @EntityGraph(attributePaths = {
            "compteTresorerie",
            "instrumentReglement",
            "instrumentReglement.reglement"
    })
    @Query("""
            select m
            from MouvementTresorerie m
            where m.agence.id = :agenceId
              and (:compteId is null or m.compteTresorerie.id = :compteId)
              and (:dateDu is null or m.dateOperation >= :dateDu)
              and (:dateAu is null or m.dateOperation <= :dateAu)
              and (
                    :search is null
                    or lower(m.libelle) like concat('%', :search, '%')
                    or lower(coalesce(m.reference, '')) like concat('%', :search, '%')
                    or lower(m.compteTresorerie.libelle) like concat('%', :search, '%')
                    or lower(coalesce(m.instrumentReglement.reglement.numero, '')) like concat('%', :search, '%')
              )
            order by m.dateOperation desc, m.id desc
            """)
    Page<MouvementTresorerie> search(
            @Param("agenceId") Long agenceId,
            @Param("compteId") Long compteId,
            @Param("dateDu") LocalDate dateDu,
            @Param("dateAu") LocalDate dateAu,
            @Param("search") String search,
            Pageable pageable
    );

    boolean existsByInstrumentReglementIdAndMouvementExtourneIdIsNull(Long instrumentId);

    Optional<MouvementTresorerie> findFirstByAgenceIdAndInstrumentReglementIdAndNatureOrderByIdDesc(
            Long agenceId,
            Long instrumentId,
            com.assurance.enums.NatureMouvementTresorerie nature
    );

    boolean existsByMouvementExtourneId(Long mouvementId);

    @Query("""
            select coalesce(sum(case when m.sens = com.assurance.enums.SensMouvementTresorerie.ENTREE
                                     then m.montant else -m.montant end), 0)
            from MouvementTresorerie m
            where m.compteTresorerie.id = :compteId
            """)
    BigDecimal balanceForAccount(@Param("compteId") Long compteId);
}
