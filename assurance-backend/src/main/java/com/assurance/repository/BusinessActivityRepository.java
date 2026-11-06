package com.assurance.repository;

import com.assurance.entity.BusinessActivity;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;

public interface BusinessActivityRepository extends JpaRepository<BusinessActivity, Long>, JpaSpecificationExecutor<BusinessActivity>, BusinessActivitySearchRepository {
    java.util.Optional<BusinessActivity> findByIdAndAgenceId(Long id, Long agenceId);
}
