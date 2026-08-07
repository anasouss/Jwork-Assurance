package com.assurance.repository;

import com.assurance.entity.InstrumentReglementClient;
import com.assurance.enums.StatutInstrumentReglement;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

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
    Optional<InstrumentReglementClient> findByIdAndAgenceId(Long id, Long agenceId);
}
