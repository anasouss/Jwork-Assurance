package com.assurance.activity;

import com.assurance.entity.Agence;
import com.assurance.entity.Role;
import com.assurance.entity.Utilisateur;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** Business allowlist only: never credentials, token identifiers, or storage paths. */
public final class AdministrationActivity {
    private AdministrationActivity() {
    }

    public static Long agencyId(Utilisateur user) {
        return user.getAgence() == null ? null : user.getAgence().getId();
    }

    public static ActivityReference reference(Utilisateur user) {
        return ActivityReference.of(ActivityRecordType.UTILISATEUR, user.getId(),
                user.getFullName() + " - " + user.getEmail());
    }

    public static ActivityReference reference(Agence agency) {
        return ActivityReference.of(ActivityRecordType.AGENCE, agency.getId(), agency.getCode() + " - " + agency.getNom());
    }

    public static ActivityReference reference(Role role) {
        return ActivityReference.of(ActivityRecordType.ROLE, role.getId(), role.getCode() + " - " + role.getNom());
    }

    public static Map<String, String> userSnapshot(Utilisateur user) {
        return new ActivityValues().put("Prenom", user.getPrenom()).put("Nom", user.getNom())
                .put("Adresse e-mail", user.getEmail()).put("Telephone", user.getTelephone())
                .put("Actif", user.getActif())
                .put("Agence", user.getAgence() == null ? "Plateforme" : reference(user.getAgence()).label())
                .put("Role", user.getRole() == null ? null : reference(user.getRole()).label()).snapshot();
    }

    public static ActivityCommand user(Utilisateur user, Map<String, String> before, ActivityAction action,
            String title, String origin) {
        var changes = new ArrayList<>(ActivityValues.changes(before, userSnapshot(user)));
        List<ActivityReference> references = new ArrayList<>();
        if (user.getAgence() != null) references.add(reference(user.getAgence()));
        if (user.getRole() != null) references.add(reference(user.getRole()));
        return new ActivityCommand(agencyId(user), ActivityModule.ADMINISTRATION, action, title, origin,
                reference(user), references, changes);
    }

    public static Map<String, String> roleSnapshot(Role role) {
        String permissions = role.getPermissions().stream()
                .map(permission -> permission.getModule() + " - " + permission.getNom())
                .sorted().collect(java.util.stream.Collectors.joining("\n"));
        return new ActivityValues().put("Code", role.getCode()).put("Nom", role.getNom())
                .put("Description", role.getDescription()).put("Role systeme", role.getSystemRole())
                .put("Agence", role.getAgence() == null ? "Plateforme" : reference(role.getAgence()).label())
                .put("Autorisations", permissions).snapshot();
    }

    public static ActivityCommand role(Role role, Map<String, String> before, ActivityAction action, String title, String origin) {
        return new ActivityCommand(role.getAgence() == null ? null : role.getAgence().getId(), ActivityModule.ADMINISTRATION,
                action, title, origin, reference(role), role.getAgence() == null ? List.of() : List.of(reference(role.getAgence())),
                ActivityValues.changes(before, action == ActivityAction.DELETED ? null : roleSnapshot(role)));
    }

    public static Map<String, String> agencySnapshot(Agence agency) {
        return new ActivityValues().put("Code", agency.getCode()).put("Nom", agency.getNom())
                .put("Adresse", agency.getAdresse()).put("Ville", agency.getVille())
                .put("Telephone", agency.getTelephone()).put("Fax", agency.getFax()).put("Adresse e-mail", agency.getEmail())
                .put("Identifiant fiscal", agency.getIdentifiantFiscal()).put("Patente", agency.getPatente())
                .put("ICE", agency.getIce()).put("Numero d'agrement", agency.getNumeroAgrement())
                .put("Date d'agrement", agency.getDateAgrement()).put("Banque", agency.getBanque()).put("RIB", agency.getRib())
                .put("Statut", agency.getStatut() == null ? null : switch (agency.getStatut()) {
                    case ACTIVE -> "Active";
                    case SUSPENDED -> "Suspendue";
                    case ARCHIVED -> "Archivee";
                }).snapshot();
    }

    public static ActivityCommand agency(Agence agency, Map<String, String> before, ActivityAction action, String title, String origin) {
        return new ActivityCommand(agency.getId(), ActivityModule.ADMINISTRATION, action, title, origin, reference(agency),
                List.of(), ActivityValues.changes(before, agencySnapshot(agency)));
    }

    public static ActivityCommand branding(Agence agency, boolean before, boolean after, boolean signature, ActivityAction action) {
        String label = signature ? "Signature" : "Logo";
        return new ActivityCommand(agency.getId(), ActivityModule.ADMINISTRATION, action,
                label + " de l'agence " + (after ? (signature ? "enregistree" : "enregistre") : (signature ? "retiree" : "retire")),
                signature ? "AGENCY_SIGNATURE" : "AGENCY_LOGO", reference(agency), List.of(),
                ActivityValues.changes(new ActivityValues().put(label, before ? "Present" : null).snapshot(),
                        new ActivityValues().put(label, after ? "Present" : null).snapshot()));
    }

    public static ActivityCommand platform(ActivityCommand command) {
        return new ActivityCommand(null, command.module(), command.action(), command.title(), command.origin(),
                command.subject(), command.references(), command.changes());
    }

}
