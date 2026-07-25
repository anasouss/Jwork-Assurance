package com.assurance.repository;

import com.assurance.entity.Client;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;

public interface ClientRepository extends JpaRepository<Client, String> {
    Optional<Client> findByAgenceIdAndId(String agenceId, String id);
    List<Client> findByAgenceIdAndClientParentId(String agenceId, String clientParentId);
}
