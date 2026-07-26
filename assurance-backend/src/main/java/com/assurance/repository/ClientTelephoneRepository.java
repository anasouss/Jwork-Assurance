package com.assurance.repository;

import com.assurance.entity.ClientTelephone;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface ClientTelephoneRepository extends JpaRepository<ClientTelephone, Long> {
    List<ClientTelephone> findByClientIdOrderByPrincipalDescCreatedAtAsc(Long clientId);
}
