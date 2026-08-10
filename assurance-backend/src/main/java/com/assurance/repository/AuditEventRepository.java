package com.assurance.repository;

import com.assurance.entity.AuditEvent;
import com.assurance.enums.AuditAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    @Query("""
            select event
            from AuditEvent event
            where (:agenceId is null or event.agenceId = :agenceId)
              and (:entityType is null or event.entityType = :entityType)
              and (:entityId is null or event.entityId = :entityId)
              and (:action is null or event.action = :action)
              and (:actorUserId is null or event.actorUserId = :actorUserId)
              and (:dateFrom is null or event.occurredAt >= :dateFrom)
              and (:dateTo is null or event.occurredAt <= :dateTo)
              and (
                    :search is null
                    or lower(coalesce(event.actorName, '')) like concat('%', :search, '%')
                    or lower(event.entityType) like concat('%', :search, '%')
                    or lower(event.entityId) like concat('%', :search, '%')
                    or lower(coalesce(event.requestId, '')) like concat('%', :search, '%')
              )
            order by event.occurredAt desc, event.id desc
            """)
    Page<AuditEvent> search(
            @Param("agenceId") Long agenceId,
            @Param("entityType") String entityType,
            @Param("entityId") String entityId,
            @Param("action") AuditAction action,
            @Param("actorUserId") Long actorUserId,
            @Param("dateFrom") LocalDateTime dateFrom,
            @Param("dateTo") LocalDateTime dateTo,
            @Param("search") String search,
            Pageable pageable
    );
}
