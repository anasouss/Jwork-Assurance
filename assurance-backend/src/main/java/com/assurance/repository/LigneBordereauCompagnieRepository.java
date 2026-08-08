package com.assurance.repository;

import com.assurance.entity.LigneBordereauCompagnie;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Collection;

public interface LigneBordereauCompagnieRepository extends JpaRepository<LigneBordereauCompagnie, Long> {
    boolean existsByAffectationReserveeId(Long affectationId);
    boolean existsByAffectationReserveeIdIn(Collection<Long> affectationIds);
}
