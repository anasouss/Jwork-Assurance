package com.assurance.repository;

import com.assurance.entity.CarteVerte;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface CarteVerteRepository extends JpaRepository<CarteVerte, String> {
    List<CarteVerte> findByContratIdOrderByCreatedAtDesc(String contratId);
}
