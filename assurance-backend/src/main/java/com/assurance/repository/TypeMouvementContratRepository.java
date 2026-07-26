package com.assurance.repository;

import com.assurance.entity.TypeMouvementContrat;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface TypeMouvementContratRepository extends JpaRepository<TypeMouvementContrat, Long> {
    Optional<TypeMouvementContrat> findByCodeIgnoreCase(String code);

    List<TypeMouvementContrat> findByActifTrueOrderByOrdreAffichageAsc();
}
