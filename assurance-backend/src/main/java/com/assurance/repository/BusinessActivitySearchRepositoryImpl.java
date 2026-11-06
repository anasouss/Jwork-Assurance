package com.assurance.repository;

import com.assurance.entity.BusinessActivity;
import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageImpl;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.domain.Specification;

@RequiredArgsConstructor
public class BusinessActivitySearchRepositoryImpl implements BusinessActivitySearchRepository {
    private final EntityManager entityManager;

    @Override
    public Page<BusinessActivitySummary> searchSummaries(Specification<BusinessActivity> specification, Pageable pageable) {
        var builder = entityManager.getCriteriaBuilder();
        var query = builder.createQuery(BusinessActivitySummary.class);
        var root = query.from(BusinessActivity.class);
        query.select(builder.construct(BusinessActivitySummary.class,
                root.get("id"), root.get("agence").get("id"), root.get("actor").get("id"),
                root.get("actorName"), root.get("occurredAt"), root.get("module"), root.get("action"),
                root.get("title"), root.get("origin"), root.get("surface"), root.get("subjectType"),
                root.get("subjectId"), root.get("subjectLabel"), root.get("referencesJson")));
        query.where(specification.toPredicate(root, query, builder));
        query.orderBy(builder.desc(root.get("occurredAt")), builder.desc(root.get("id")));
        var rows = entityManager.createQuery(query).setFirstResult(Math.toIntExact(pageable.getOffset()))
                .setMaxResults(pageable.getPageSize()).getResultList();

        var count = builder.createQuery(Long.class);
        var countRoot = count.from(BusinessActivity.class);
        count.select(builder.count(countRoot));
        count.where(specification.toPredicate(countRoot, count, builder));
        return new PageImpl<>(rows, pageable, entityManager.createQuery(count).getSingleResult());
    }
}
