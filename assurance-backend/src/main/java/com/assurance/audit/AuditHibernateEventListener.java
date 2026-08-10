package com.assurance.audit;

import com.assurance.entity.Agence;
import com.assurance.entity.AuditedEntity;
import com.assurance.entity.BaseEntity;
import com.assurance.enums.AuditAction;
import com.assurance.enums.AuditActorType;
import com.assurance.security.AuditRequestContext;
import com.assurance.security.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.collection.spi.PersistentCollection;
import org.hibernate.event.spi.PostDeleteEvent;
import org.hibernate.event.spi.PostDeleteEventListener;
import org.hibernate.event.spi.PostInsertEvent;
import org.hibernate.event.spi.PostInsertEventListener;
import org.hibernate.event.spi.PostUpdateEvent;
import org.hibernate.event.spi.PostUpdateEventListener;
import org.hibernate.persister.entity.EntityPersister;

import java.math.BigDecimal;
import java.sql.PreparedStatement;
import java.sql.Timestamp;
import java.time.LocalDateTime;
import java.time.temporal.TemporalAccessor;
import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

public class AuditHibernateEventListener implements
        PostInsertEventListener,
        PostUpdateEventListener,
        PostDeleteEventListener {

    private static final String INSERT_SQL = """
            insert into audit_events (
                agence_id,
                actor_user_id,
                actor_name,
                actor_type,
                entity_type,
                entity_id,
                event_action,
                occurred_at,
                before_data,
                after_data,
                request_id,
                source
            ) values (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """;
    private static final Set<String> TECHNICAL_PROPERTIES = Set.of(
            "createdAt",
            "updatedAt",
            "createdByUserId",
            "updatedByUserId"
    );
    private static final Set<String> REDACTED_FRAGMENTS = Set.of(
            "password",
            "motdepasse",
            "token",
            "secret",
            "authorization"
    );

    private final ObjectMapper objectMapper;

    public AuditHibernateEventListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        if (!(event.getEntity() instanceof AuditedEntity)) {
            return;
        }
        Map<String, Object> after = snapshot(
                event.getPersister().getPropertyNames(),
                event.getState(),
                null
        );
        write(event.getSession(), event.getEntity(), event.getId(), AuditAction.CREATED, null, after,
                event.getPersister().getPropertyNames(), event.getState());
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        if (!(event.getEntity() instanceof AuditedEntity)) {
            return;
        }
        int[] dirtyProperties = event.getDirtyProperties();
        Map<String, Object> before = snapshot(
                event.getPersister().getPropertyNames(),
                event.getOldState(),
                dirtyProperties
        );
        Map<String, Object> after = snapshot(
                event.getPersister().getPropertyNames(),
                event.getState(),
                dirtyProperties
        );
        removeUnchangedValues(before, after);
        if (before.isEmpty() && after.isEmpty()) {
            return;
        }
        write(event.getSession(), event.getEntity(), event.getId(), AuditAction.UPDATED, before, after,
                event.getPersister().getPropertyNames(), event.getState());
    }

    @Override
    public void onPostDelete(PostDeleteEvent event) {
        if (!(event.getEntity() instanceof AuditedEntity)) {
            return;
        }
        Map<String, Object> before = snapshot(
                event.getPersister().getPropertyNames(),
                event.getDeletedState(),
                null
        );
        write(event.getSession(), event.getEntity(), event.getId(), AuditAction.DELETED, before, null,
                event.getPersister().getPropertyNames(), event.getDeletedState());
    }

    @Override
    public boolean requiresPostCommitHandling(EntityPersister persister) {
        return false;
    }

    private void write(
            org.hibernate.engine.spi.SharedSessionContractImplementor session,
            Object entity,
            Object entityId,
            AuditAction action,
            Map<String, Object> before,
            Map<String, Object> after,
            String[] propertyNames,
            Object[] state
    ) {
        Long agencyId = resolveAgencyId(entity, propertyNames, state);
        Long userId = TenantContext.getCurrentUser();
        String source = AuditRequestContext.getSource();
        AuditActorType actorType = userId != null
                ? AuditActorType.USER
                : "IMPORT".equalsIgnoreCase(source) ? AuditActorType.IMPORT : AuditActorType.SYSTEM;
        LocalDateTime occurredAt = LocalDateTime.now();
        String entityType = entity.getClass().getSimpleName();
        String beforeJson = toJson(before);
        String afterJson = toJson(after);

        session.doWork(connection -> {
            try (PreparedStatement statement = connection.prepareStatement(INSERT_SQL)) {
                setNullableLong(statement, 1, agencyId);
                setNullableLong(statement, 2, userId);
                statement.setString(3, TenantContext.getCurrentUsername());
                statement.setString(4, actorType.name());
                statement.setString(5, entityType);
                statement.setString(6, String.valueOf(entityId));
                statement.setString(7, action.name());
                statement.setTimestamp(8, Timestamp.valueOf(occurredAt));
                statement.setString(9, beforeJson);
                statement.setString(10, afterJson);
                statement.setString(11, AuditRequestContext.getRequestId());
                statement.setString(12, source);
                statement.executeUpdate();
            }
        });
    }

    private Map<String, Object> snapshot(String[] names, Object[] state, int[] includedIndexes) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (state == null) {
            return values;
        }
        if (includedIndexes == null) {
            for (int index = 0; index < names.length; index++) {
                addValue(values, names[index], state[index]);
            }
            return values;
        }
        for (int index : includedIndexes) {
            if (index >= 0 && index < names.length && index < state.length) {
                addValue(values, names[index], state[index]);
            }
        }
        return values;
    }

    private void addValue(Map<String, Object> values, String property, Object value) {
        if (TECHNICAL_PROPERTIES.contains(property)
                || value instanceof Collection<?>
                || value instanceof PersistentCollection<?>) {
            return;
        }
        if (isSensitive(property)) {
            values.put(property, "[REDACTED]");
            return;
        }
        values.put(property, normalize(value));
    }

    private Object normalize(Object value) {
        if (value == null
                || value instanceof String
                || value instanceof Number
                || value instanceof Boolean
                || value instanceof BigDecimal) {
            return value;
        }
        if (value instanceof Enum<?> enumValue) {
            return enumValue.name();
        }
        if (value instanceof TemporalAccessor || value instanceof UUID) {
            return value.toString();
        }
        if (value instanceof BaseEntity entity) {
            Map<String, Object> reference = new LinkedHashMap<>();
            reference.put("type", value.getClass().getSimpleName());
            reference.put("id", entity.getId());
            return reference;
        }
        if (value instanceof byte[]) {
            return "[BINARY]";
        }
        return String.valueOf(value);
    }

    private void removeUnchangedValues(Map<String, Object> before, Map<String, Object> after) {
        Set<String> properties = Set.copyOf(after.keySet());
        for (String property : properties) {
            if (Objects.deepEquals(before.get(property), after.get(property))) {
                before.remove(property);
                after.remove(property);
            }
        }
    }

    private Long resolveAgencyId(Object entity, String[] propertyNames, Object[] state) {
        Long currentAgencyId = TenantContext.getCurrentAgence();
        if (currentAgencyId != null) {
            return currentAgencyId;
        }
        if (entity instanceof Agence agence && agence.getId() != null) {
            return agence.getId();
        }
        if (state == null) {
            return null;
        }
        for (int index = 0; index < propertyNames.length; index++) {
            if ("agence".equals(propertyNames[index]) && state[index] instanceof Agence agence) {
                return agence.getId();
            }
            if ("agenceId".equals(propertyNames[index]) && state[index] instanceof Number number) {
                return number.longValue();
            }
        }
        return null;
    }

    private boolean isSensitive(String property) {
        String normalized = property.toLowerCase(Locale.ROOT).replace("_", "");
        return REDACTED_FRAGMENTS.stream().anyMatch(normalized::contains);
    }

    private String toJson(Map<String, Object> values) {
        if (values == null || values.isEmpty()) {
            return null;
        }
        try {
            return objectMapper.writeValueAsString(values);
        } catch (JsonProcessingException exception) {
            throw new IllegalStateException("Impossible de sérialiser une trace d'audit", exception);
        }
    }

    private void setNullableLong(PreparedStatement statement, int index, Long value) throws java.sql.SQLException {
        if (value == null) {
            statement.setNull(index, java.sql.Types.BIGINT);
        } else {
            statement.setLong(index, value);
        }
    }
}
