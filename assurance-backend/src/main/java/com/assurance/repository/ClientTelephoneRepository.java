package com.assurance.repository;

import com.assurance.entity.ClientTelephone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClientTelephoneRepository extends JpaRepository<ClientTelephone, String> {
    List<ClientTelephone> findByClientIdOrderByPrincipalDescCreatedAtAsc(String clientId);
}
