package com.assurance.repository;

import com.assurance.entity.LigneBordereauEspeces;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface LigneBordereauEspecesRepository extends JpaRepository<LigneBordereauEspeces, Long> {

    boolean existsByMouvementTresorerieIdIn(Collection<Long> movementIds);
}
