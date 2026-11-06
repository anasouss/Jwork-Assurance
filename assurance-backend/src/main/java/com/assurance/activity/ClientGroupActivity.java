package com.assurance.activity;

import com.assurance.dto.response.GroupeClientResponse;
import com.assurance.entity.GroupeClient;
import com.assurance.entity.GroupeClientMembre;
import com.assurance.enums.RelationGroupeClient;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class ClientGroupActivity {
    private ClientGroupActivity() {
    }

    public static ActivityReference reference(GroupeClient group) {
        return ActivityReference.of(ActivityRecordType.GROUPE_CLIENT, group.getId(), group.getCode() + " - " + group.getLibelle());
    }

    public static Map<String, String> snapshot(GroupeClientResponse group) {
        if (group == null) return Map.of();
        ActivityValues values = new ActivityValues().put("Code", group.getCode()).put("Nom", group.getLibelle())
                .put("Tête de groupe", group.getClientTeteNom()).put("Responsable des paiements", group.getClientTresorerieNom())
                .put("Facturation consolidée par défaut", group.getFacturationConsolideeDefaut()).put("Actif", group.getActif());
        if (group.getMembres() != null) {
            for (var member : group.getMembres()) {
                String prefix = (member.getClientCode() == null ? "" : member.getClientCode() + " / ")
                        + (member.getClientNom() == null ? "Client" : member.getClientNom()) + " - ";
                values.put(prefix + "Relation", relation(member.getTypeRelation()))
                        .put(prefix + "Groupe principal", member.getPrincipal())
                        .put(prefix + "Début", member.getDateDebut()).put(prefix + "Fin", member.getDateFin());
            }
        }
        return values.snapshot();
    }

    public static ActivityCommand command(Long agencyId, GroupeClientResponse before,
            GroupeClientResponse group, ActivityAction action, String title, String origin) {
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(snapshot(before), snapshot(group)));
        if (before != null) {
            if (!Objects.equals(before.getClientTeteId(), group.getClientTeteId())
                    && changes.stream().noneMatch(change -> change.label().equals("Tête de groupe"))) {
                changes.add(new ActivityChange("Tête de groupe", null, "Selection actualisee"));
            }
            if (!Objects.equals(before.getClientTresorerieId(), group.getClientTresorerieId())
                    && changes.stream().noneMatch(change -> change.label().equals("Responsable des paiements"))) {
                changes.add(new ActivityChange("Responsable des paiements", null, "Selection actualisee"));
            }
        }
        Map<String, ActivityReference> references = new LinkedHashMap<>();
        addReferences(references, before);
        addReferences(references, group);
        return new ActivityCommand(agencyId, ActivityModule.CRM, action, title, origin,
                ActivityReference.of(ActivityRecordType.GROUPE_CLIENT, group.getId(), group.getCode() + " - " + group.getLibelle()),
                List.copyOf(references.values()), changes);
    }

    private static void addReferences(Map<String, ActivityReference> references, GroupeClientResponse group) {
        if (group == null) return;
        addClient(references, group.getClientTeteId(), group.getClientTeteNom());
        addClient(references, group.getClientTresorerieId(), group.getClientTresorerieNom());
        if (group.getMembres() != null) for (var member : group.getMembres()) {
            addClient(references, member.getClientId(), member.getClientNom());
        }
    }

    private static void addClient(Map<String, ActivityReference> references, Long id, String name) {
        if (id == null) return;
        references.put("CLIENT:" + id, ActivityReference.of(ActivityRecordType.CLIENT, id, name == null || name.isBlank() ? "Client" : name));
    }

    public static void addMembership(ActivityValues values, GroupeClientMembre membership) {
        String prefix = membership.getGroupe().getCode() + " / " + ClientActivity.reference(membership.getClient()).label() + " - ";
        values.put(prefix + "Relation", relation(membership.getTypeRelation()))
                .put(prefix + "Groupe principal", membership.getPrincipal())
                .put(prefix + "Début", membership.getDateDebut()).put(prefix + "Fin", membership.getDateFin());
    }

    public static String relation(RelationGroupeClient relation) {
        if (relation == null) return null;
        return switch (relation) {
            case TETE_GROUPE -> "Tête de groupe";
            case FILIALE -> "Filiale";
            case SOCIETE_LIEE -> "Société liée";
        };
    }
}
