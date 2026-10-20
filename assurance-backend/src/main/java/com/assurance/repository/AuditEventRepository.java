package com.assurance.repository;

import com.assurance.entity.AuditEvent;
import com.assurance.enums.AuditAction;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.time.LocalDateTime;
import java.util.Collection;
import java.util.List;

public interface AuditEventRepository extends JpaRepository<AuditEvent, Long> {

    @Query(value = """
            select case
                       when event.request_id is null or trim(event.request_id) = ''
                           then concat('event:', event.id)
                       else concat('request:', event.request_id)
                   end as operation_key
            from audit_events event
            left join users actor on actor.id = event.actor_user_id
            where (:agenceId is null or event.agence_id = :agenceId)
              and (:entityType is null or event.entity_type = :entityType)
              and (:entityId is null or event.entity_id = :entityId)
              and (:action is null or event.event_action = :action)
              and (:actorUserId is null or event.actor_user_id = :actorUserId)
              and (:dateFrom is null or event.occurred_at >= :dateFrom)
              and (:dateTo is null or event.occurred_at <= :dateTo)
              and (
                    :search is null
                    or lower(coalesce(event.actor_name, '')) like concat('%', :search, '%')
                    or lower(coalesce(actor.email, '')) like concat('%', :search, '%')
                    or lower(concat(coalesce(actor.prenom, ''), ' ', coalesce(actor.nom, ''))) like concat('%', :search, '%')
                    or lower(event.entity_type) like concat('%', :search, '%')
                    or lower(event.entity_id) like concat('%', :search, '%')
                    or lower(coalesce(event.operation_code, '')) like concat('%', :search, '%')
                    or lower(coalesce(event.request_id, '')) like concat('%', :search, '%')
                    or lower(coalesce(event.before_data, '')) like concat('%', :search, '%')
                    or lower(coalesce(event.after_data, '')) like concat('%', :search, '%')
              )
            group by operation_key
            order by max(event.occurred_at) desc, max(event.id) desc
            """,
            countQuery = """
                    select count(*)
                    from (
                        select case
                                   when event.request_id is null or trim(event.request_id) = ''
                                       then concat('event:', event.id)
                                   else concat('request:', event.request_id)
                               end as operation_key
                        from audit_events event
                        left join users actor on actor.id = event.actor_user_id
                        where (:agenceId is null or event.agence_id = :agenceId)
                          and (:entityType is null or event.entity_type = :entityType)
                          and (:entityId is null or event.entity_id = :entityId)
                          and (:action is null or event.event_action = :action)
                          and (:actorUserId is null or event.actor_user_id = :actorUserId)
                          and (:dateFrom is null or event.occurred_at >= :dateFrom)
                          and (:dateTo is null or event.occurred_at <= :dateTo)
                          and (
                                :search is null
                                or lower(coalesce(event.actor_name, '')) like concat('%', :search, '%')
                                or lower(coalesce(actor.email, '')) like concat('%', :search, '%')
                                or lower(concat(coalesce(actor.prenom, ''), ' ', coalesce(actor.nom, ''))) like concat('%', :search, '%')
                                or lower(event.entity_type) like concat('%', :search, '%')
                                or lower(event.entity_id) like concat('%', :search, '%')
                                or lower(coalesce(event.operation_code, '')) like concat('%', :search, '%')
                                or lower(coalesce(event.request_id, '')) like concat('%', :search, '%')
                                or lower(coalesce(event.before_data, '')) like concat('%', :search, '%')
                                or lower(coalesce(event.after_data, '')) like concat('%', :search, '%')
                          )
                        group by operation_key
                    ) grouped_operations
                    """,
            nativeQuery = true)
    Page<String> searchOperationKeys(
            @Param("agenceId") Long agenceId,
            @Param("entityType") String entityType,
            @Param("entityId") String entityId,
            @Param("action") String action,
            @Param("actorUserId") Long actorUserId,
            @Param("dateFrom") LocalDateTime dateFrom,
            @Param("dateTo") LocalDateTime dateTo,
            @Param("search") String search,
            Pageable pageable
    );

    @Query("""
            select event
            from AuditEvent event
            where (:agenceId is null or event.agenceId = :agenceId)
              and (event.requestId in :requestIds or event.id in :eventIds)
            order by event.occurredAt asc, event.id asc
            """)
    List<AuditEvent> findAllForOperations(
            @Param("agenceId") Long agenceId,
            @Param("requestIds") Collection<String> requestIds,
            @Param("eventIds") Collection<Long> eventIds
    );

    @Query("""
            select event
            from AuditEvent event
            left join Utilisateur actor on actor.id = event.actorUserId
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
                    or lower(coalesce(actor.email, '')) like concat('%', :search, '%')
                    or lower(concat(coalesce(actor.prenom, ''), ' ', coalesce(actor.nom, ''))) like concat('%', :search, '%')
                    or lower(event.entityType) like concat('%', :search, '%')
                    or lower(event.entityId) like concat('%', :search, '%')
                    or lower(coalesce(event.operationCode, '')) like concat('%', :search, '%')
                    or lower(coalesce(event.requestId, '')) like concat('%', :search, '%')
                    or lower(coalesce(event.beforeData, '')) like concat('%', :search, '%')
                    or lower(coalesce(event.afterData, '')) like concat('%', :search, '%')
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
