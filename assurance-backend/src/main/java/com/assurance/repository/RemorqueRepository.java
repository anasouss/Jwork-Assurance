package com.assurance.repository;

import com.assurance.entity.Remorque;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface RemorqueRepository extends JpaRepository<Remorque, Long> {
    void deleteByContratId(Long contratId);

    List<Remorque> findByContratIdOrderByCreatedAtAsc(Long contratId);
}
