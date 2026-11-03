package com.assurance.repository;

import com.assurance.entity.MouvementRejetBancaire;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface MouvementRejetBancaireRepository extends JpaRepository<MouvementRejetBancaire, Long> {
    List<MouvementRejetBancaire> findByAgenceIdAndInstrumentIdOrderByDateOperationAscIdAsc(Long agenceId, Long instrumentId);
}
