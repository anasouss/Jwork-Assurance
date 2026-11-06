package com.assurance.repository;

import com.assurance.entity.BusinessActivity;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

public interface BusinessActivitySearchRepository {
    Page<BusinessActivitySummary> searchSummaries(Specification<BusinessActivity> specification, Pageable pageable);
}
