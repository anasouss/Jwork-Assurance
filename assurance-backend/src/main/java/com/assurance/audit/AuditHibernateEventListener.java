package com.assurance.audit;

import com.assurance.entity.Agence;
import com.assurance.entity.Banque;
import com.assurance.entity.BaseEntity;
import com.assurance.entity.BordereauCompagnie;
import com.assurance.entity.BordereauRemise;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.CategorieTransport;
import com.assurance.entity.Carburant;
import com.assurance.entity.Carrosserie;
import com.assurance.entity.Client;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.CompteTresorerie;
import com.assurance.entity.ConditionPaiementClient;
import com.assurance.entity.Contrat;
import com.assurance.entity.Convention;
import com.assurance.entity.DocumentClient;
import com.assurance.entity.Garantie;
import com.assurance.entity.GrilleTarifaire;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.ImportReleveBancaire;
import com.assurance.entity.InstrumentReglementClient;
import com.assurance.entity.InstrumentReglementCompagnie;
import com.assurance.entity.LigneReleveBancaire;
import com.assurance.entity.Marque;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementTresorerie;
import com.assurance.entity.OperationTresorerie;
import com.assurance.entity.ParametreApplication;
import com.assurance.entity.Permission;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.ProfilImportReleveBancaire;
import com.assurance.entity.ReglementClient;
import com.assurance.entity.ReglementCompagnie;
import com.assurance.entity.Remorque;
import com.assurance.entity.Role;
import com.assurance.entity.SousClasse;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Usage;
import com.assurance.entity.Utilisateur;
import com.assurance.entity.Vehicule;
import com.assurance.entity.Ville;
import com.assurance.entity.Sinistre;
import com.assurance.enums.AuditAction;
import com.assurance.enums.AuditActorType;
import com.assurance.security.AuditRequestContext;
import com.assurance.security.TenantContext;
import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.Hibernate;
import org.hibernate.collection.spi.PersistentCollection;
import org.hibernate.event.spi.AbstractCollectionEvent;
import org.hibernate.event.spi.PostCollectionRecreateEvent;
import org.hibernate.event.spi.PostCollectionRecreateEventListener;
import org.hibernate.event.spi.PostCollectionRemoveEvent;
import org.hibernate.event.spi.PostCollectionRemoveEventListener;
import org.hibernate.event.spi.PostCollectionUpdateEvent;
import org.hibernate.event.spi.PostCollectionUpdateEventListener;
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
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.UUID;

public class AuditHibernateEventListener implements
        PostInsertEventListener,
        PostUpdateEventListener,
        PostDeleteEventListener,
        PostCollectionRecreateEventListener,
        PostCollectionUpdateEventListener,
        PostCollectionRemoveEventListener {

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
            "updatedByUserId",
            "lastLogin",
            "version"
    );
    private static final Set<String> REDACTED_FRAGMENTS = Set.of(
            "password",
            "motdepasse",
            "token",
            "secret",
            "authorization",
            "cheminstockage",
            "clestockage",
            "sha256",
            "donneesbrutesjson",
            "configurationjson",
            "entetesjson",
            "payloadjson"
    );
    private static final Map<String, Set<String>> DERIVED_PROPERTIES = Map.of(
            "Contrat", Set.of("nombreVehicules", "nombreRemorques")
    );
    private static final Set<String> UNTRACKED_ENTITY_TYPES = Set.of(
            "Permission",
            "NumeroDossierSequence",
            "SequenceBordereauCompagnie",
            "SequenceBordereauRemise",
            "SequenceDocumentClient",
            "SequenceOperationTresorerie",
            "SequenceReglementClient",
            "SequenceReglementCompagnie",
            "SequenceSinistre"
    );
    private static final Set<String> TRACKED_COLLECTIONS = Set.of(
            "Banque.aliases",
            "CategorieClient.usages",
            "Convention.usages",
            "Garantie.modesAutorises",
            "Garantie.modesTarificationMultiple",
            "Garantie.sourcesValeurAutorisees",
            "GroupeUsageAttestation.compagniesRestreintes",
            "ProduitAssistance.usages",
            "Role.permissions",
            "TarifUsage.carburants",
            "TypeMouvementContrat.typesContratAutorises",
            "Usage.carrosseries"
    );

    private final ObjectMapper objectMapper;

    public AuditHibernateEventListener(ObjectMapper objectMapper) {
        this.objectMapper = objectMapper;
    }

    @Override
    public void onPostInsert(PostInsertEvent event) {
        if (!isTracked(event.getEntity())) {
            return;
        }
        Map<String, Object> after = snapshot(
                event.getEntity(),
                event.getPersister().getPropertyNames(),
                event.getState(),
                null
        );
        write(event.getSession(), event.getEntity(), event.getId(), AuditAction.CREATED, null, after,
                event.getPersister().getPropertyNames(), event.getState());
    }

    @Override
    public void onPostUpdate(PostUpdateEvent event) {
        if (!isTracked(event.getEntity())) {
            return;
        }
        int[] dirtyProperties = event.getDirtyProperties();
        Map<String, Object> before = snapshot(
                event.getEntity(),
                event.getPersister().getPropertyNames(),
                event.getOldState(),
                dirtyProperties
        );
        Map<String, Object> after = snapshot(
                event.getEntity(),
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
        if (!isTracked(event.getEntity())) {
            return;
        }
        Map<String, Object> before = snapshot(
                event.getEntity(),
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

    @Override
    public void onPostRecreateCollection(PostCollectionRecreateEvent event) {
        writeCollectionChange(event, null, event.getCollection().getValue());
    }

    @Override
    public void onPostUpdateCollection(PostCollectionUpdateEvent event) {
        writeCollectionChange(
                event,
                event.getCollection().getStoredSnapshot(),
                event.getCollection().getValue()
        );
    }

    @Override
    public void onPostRemoveCollection(PostCollectionRemoveEvent event) {
        writeCollectionChange(event, event.getCollection().getStoredSnapshot(), null);
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
        String requestSource = AuditRequestContext.getSource();
        String source = requestSource == null || requestSource.isBlank() ? "SYSTEM" : requestSource;
        AuditActorType actorType = userId != null
                ? AuditActorType.USER
                : "IMPORT".equalsIgnoreCase(source) ? AuditActorType.IMPORT : AuditActorType.SYSTEM;
        LocalDateTime occurredAt = LocalDateTime.now();
        String entityType = entityType(entity);
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

    private Map<String, Object> snapshot(
            Object entity,
            String[] names,
            Object[] state,
            int[] includedIndexes
    ) {
        Map<String, Object> values = new LinkedHashMap<>();
        if (state == null) {
            return values;
        }
        if (includedIndexes == null) {
            for (int index = 0; index < names.length; index++) {
                addValue(values, entity, names[index], state[index]);
            }
            return values;
        }
        for (int index : includedIndexes) {
            if (index >= 0 && index < names.length && index < state.length) {
                addValue(values, entity, names[index], state[index]);
            }
        }
        return values;
    }

    private void addValue(Map<String, Object> values, Object entity, String property, Object value) {
        if (TECHNICAL_PROPERTIES.contains(property)
                || DERIVED_PROPERTIES.getOrDefault(entityType(entity), Set.of()).contains(property)) {
            return;
        }
        if (value instanceof Collection<?> || value instanceof PersistentCollection<?>) {
            return;
        }
        if (isSensitive(property)
                || entity instanceof ParametreApplication && "valeur".equals(property)) {
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
            reference.put("type", Hibernate.getClass(value).getSimpleName());
            reference.put("id", entity.getId());
            String label = referenceLabel(entity);
            if (label != null && !label.isBlank()) {
                reference.put("label", label);
            }
            return reference;
        }
        if (value instanceof byte[]) {
            return "[BINARY]";
        }
        return String.valueOf(value);
    }

    private boolean isTracked(Object entity) {
        return entity instanceof BaseEntity
                && !UNTRACKED_ENTITY_TYPES.contains(entityType(entity));
    }

    private String entityType(Object entity) {
        return Hibernate.getClass(entity).getSimpleName();
    }

    private void writeCollectionChange(AbstractCollectionEvent event, Object beforeValue, Object afterValue) {
        Object owner = event.getAffectedOwnerOrNull();
        if (!(owner instanceof BaseEntity) || !isTracked(owner)) {
            return;
        }
        String role = event.getCollection().getRole();
        String property = role == null || !role.contains(".")
                ? role
                : role.substring(role.lastIndexOf('.') + 1);
        if (property == null || !TRACKED_COLLECTIONS.contains(entityType(owner) + "." + property)) {
            return;
        }
        List<Object> before = normalizeCollection(beforeValue);
        List<Object> after = normalizeCollection(afterValue);
        if (Objects.equals(before, after)) {
            return;
        }
        write(
                event.getSession(),
                owner,
                event.getAffectedOwnerIdOrNull(),
                AuditAction.UPDATED,
                Map.of(property, before),
                Map.of(property, after),
                new String[0],
                new Object[0]
        );
    }

    private List<Object> normalizeCollection(Object value) {
        Collection<?> collection;
        if (value instanceof Map<?, ?> map) {
            collection = map.keySet();
        } else if (value instanceof Collection<?> values) {
            collection = values;
        } else {
            return List.of();
        }
        return collection.stream()
                .map(this::normalize)
                .sorted(Comparator.comparing(String::valueOf))
                .toList();
    }

    private String referenceLabel(BaseEntity entity) {
        if (entity instanceof Agence agence) {
            return joinReference(agence.getCode(), agence.getNom());
        }
        if (entity instanceof Contrat contrat) {
            return firstNotBlank(contrat.getNumeroPolice(), contrat.getNumeroDossier());
        }
        if (entity instanceof GrilleTarifaire grille) {
            return grille.getLibelle();
        }
        if (entity instanceof CompagnieAssurance compagnie) {
            return joinReference(compagnie.getCode(), compagnie.getNom());
        }
        if (entity instanceof CompagnieAssistance compagnie) {
            return joinReference(compagnie.getCode(), compagnie.getNom());
        }
        if (entity instanceof Convention convention) {
            return joinReference(convention.getCode(), convention.getIntitule());
        }
        if (entity instanceof CategorieClient categorie) {
            return joinReference(categorie.getCode(), categorie.getLibelle());
        }
        if (entity instanceof CategorieTransport categorie) {
            return joinReference(categorie.getCode(), categorie.getLibelle());
        }
        if (entity instanceof Carburant carburant) {
            return joinReference(carburant.getCode(), carburant.getLibelle());
        }
        if (entity instanceof Client client) {
            return joinReference(client.getCodeClient(), client.getNomAffichage());
        }
        if (entity instanceof GroupeClient groupe) {
            return joinReference(groupe.getCode(), groupe.getLibelle());
        }
        if (entity instanceof GroupeUsageAttestation groupe) {
            return joinReference(groupe.getCode(), groupe.getLibelle());
        }
        if (entity instanceof Usage usage) {
            return joinReference(usage.getCode(), usage.getLibelle());
        }
        if (entity instanceof Marque marque) {
            return marque.getLibelle();
        }
        if (entity instanceof Carrosserie carrosserie) {
            return carrosserie.getLibelle();
        }
        if (entity instanceof Garantie garantie) {
            return joinReference(garantie.getCode(), garantie.getLibelle());
        }
        if (entity instanceof BrancheAssurance branche) {
            return joinReference(branche.getCode(), branche.getLibelle());
        }
        if (entity instanceof Banque banque) {
            return joinReference(banque.getCode(), banque.getLibelle());
        }
        if (entity instanceof ProduitAssistance produit) {
            return produit.getLibelle();
        }
        if (entity instanceof CompteTresorerie compte) {
            return joinReference(compte.getCode(), compte.getLibelle());
        }
        if (entity instanceof DocumentClient document) {
            return document.getNumero();
        }
        if (entity instanceof BordereauCompagnie bordereau) {
            return bordereau.getNumero();
        }
        if (entity instanceof BordereauRemise bordereau) {
            return bordereau.getNumero();
        }
        if (entity instanceof OperationTresorerie operation) {
            return firstNotBlank(operation.getNumero(), operation.getReference());
        }
        if (entity instanceof ReglementClient reglement) {
            return reglement.getNumero();
        }
        if (entity instanceof ReglementCompagnie reglement) {
            return reglement.getNumero();
        }
        if (entity instanceof Sinistre sinistre) {
            return firstNotBlank(sinistre.getNumeroSinistre(), sinistre.getReferenceCompagnie());
        }
        if (entity instanceof MouvementContrat mouvement) {
            return mouvement.getNumeroMouvement();
        }
        if (entity instanceof MouvementTresorerie mouvement) {
            return firstNotBlank(mouvement.getReference(), mouvement.getLibelle());
        }
        if (entity instanceof InstrumentReglementClient instrument) {
            return instrument.getReferenceInstrument();
        }
        if (entity instanceof InstrumentReglementCompagnie instrument) {
            return instrument.getReferenceInstrument();
        }
        if (entity instanceof ProfilImportReleveBancaire profil) {
            return profil.getNom();
        }
        if (entity instanceof ImportReleveBancaire bankImport) {
            return bankImport.getNomFichier();
        }
        if (entity instanceof LigneReleveBancaire ligne) {
            return firstNotBlank(ligne.getReferenceBancaire(), ligne.getLibelle(), lineNumber(ligne.getNumeroLigne()));
        }
        if (entity instanceof ConditionPaiementClient condition && condition.getDelaiJours() != null) {
            return "Délai " + condition.getDelaiJours() + " jours";
        }
        if (entity instanceof Utilisateur utilisateur) {
            return firstNotBlank(utilisateur.getFullName(), utilisateur.getEmail());
        }
        if (entity instanceof Role role) {
            return joinReference(role.getCode(), role.getNom());
        }
        if (entity instanceof Permission permission) {
            return joinReference(permission.getCode(), permission.getNom());
        }
        if (entity instanceof SousClasse sousClasse) {
            return joinReference(sousClasse.getCode(), sousClasse.getLibelle());
        }
        if (entity instanceof TypeMouvementContrat typeMouvement) {
            return joinReference(typeMouvement.getCode(), typeMouvement.getLibelle());
        }
        if (entity instanceof Ville ville) {
            return ville.getNom();
        }
        return null;
    }

    private String lineNumber(Integer number) {
        return number == null ? null : "Ligne " + number;
    }

    private String joinReference(String code, String label) {
        if (code == null || code.isBlank()) {
            return label;
        }
        if (label == null || label.isBlank() || code.equalsIgnoreCase(label)) {
            return code;
        }
        return code + " - " + label;
    }

    private String firstNotBlank(String... values) {
        for (String value : values) {
            if (value != null && !value.isBlank()) {
                return value;
            }
        }
        return null;
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
        if (entity instanceof Vehicule vehicule
                && vehicule.getContrat() != null
                && vehicule.getContrat().getAgence() != null) {
            return vehicule.getContrat().getAgence().getId();
        }
        if (entity instanceof Remorque remorque
                && remorque.getContrat() != null
                && remorque.getContrat().getAgence() != null) {
            return remorque.getContrat().getAgence().getId();
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
