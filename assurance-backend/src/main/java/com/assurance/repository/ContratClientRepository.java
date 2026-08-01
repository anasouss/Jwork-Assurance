package com.assurance.repository;

import com.assurance.entity.ContratClient;
import com.assurance.enums.RoleClientContrat;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;

import java.util.Collection;
import java.util.List;

public interface ContratClientRepository extends JpaRepository<ContratClient, Long> {
    void deleteByContratId(Long contratId);

    @EntityGraph(attributePaths = {"client"})
    List<ContratClient> findByContratIdInAndRole(Collection<Long> contratIds, RoleClientContrat role);

    @EntityGraph(attributePaths = {"client"})
    List<ContratClient> findByContratIdIn(Collection<Long> contratIds);
}
