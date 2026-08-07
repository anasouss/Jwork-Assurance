package com.assurance.repository;

import com.assurance.entity.AffectationReglementClient;
import com.assurance.enums.StatutAffectationReglement;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.Collection;
import java.util.List;
import java.util.Set;

public interface AffectationReglementClientRepository extends JpaRepository<AffectationReglementClient, Long> {

    @Query("""
            select a.elementFacturable.id, a.statut, sum(a.montant)
            from AffectationReglementClient a
            where a.elementFacturable.id in :elementIds
              and a.instrument.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
              and a.statut <> com.assurance.enums.StatutAffectationReglement.ANNULEE
            group by a.elementFacturable.id, a.statut
            """)
    List<Object[]> sumByElementIds(@Param("elementIds") Collection<Long> elementIds);

    @Query("""
            select a.documentClient.id, a.statut, sum(a.montant)
            from AffectationReglementClient a
            where a.documentClient.id in :documentIds
              and a.instrument.reglement.statut = com.assurance.enums.StatutReglementClient.VALIDE
              and a.statut <> com.assurance.enums.StatutAffectationReglement.ANNULEE
            group by a.documentClient.id, a.statut
            """)
    List<Object[]> sumByDocumentIds(@Param("documentIds") Collection<Long> documentIds);

    List<AffectationReglementClient> findByInstrumentId(Long instrumentId);

    long countByElementFacturableIdAndStatut(Long elementId, StatutAffectationReglement statut);

    boolean existsByDocumentClientIdAndStatutIn(
            Long documentClientId,
            Set<StatutAffectationReglement> statuts
    );
}
