package com.assurance.repository;

import com.assurance.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, Long> {
    Optional<Client> findByAgenceIdAndId(Long agenceId, Long id);
    Optional<Client> findFirstByAgenceIdAndCinIgnoreCase(Long agenceId, String cin);
    Optional<Client> findFirstByAgenceIdAndRcIgnoreCase(Long agenceId, String rc);
    List<Client> findByAgenceIdAndClientParentId(Long agenceId, Long clientParentId);
}
