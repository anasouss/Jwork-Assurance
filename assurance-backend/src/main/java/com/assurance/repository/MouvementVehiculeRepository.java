package com.assurance.repository;

import com.assurance.entity.MouvementVehicule;
import org.springframework.data.jpa.repository.JpaRepository;

public interface MouvementVehiculeRepository extends JpaRepository<MouvementVehicule, String> {
}
