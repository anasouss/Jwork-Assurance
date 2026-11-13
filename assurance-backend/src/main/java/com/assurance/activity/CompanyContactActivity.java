package com.assurance.activity;

import com.assurance.entity.ContactCompagnie;
import com.assurance.enums.ServiceContactCompagnie;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;

public final class CompanyContactActivity {
    private CompanyContactActivity() {
    }

    public static ActivityReference reference(ContactCompagnie contact) {
        String name = (contact.getPrenom() == null ? "" : contact.getPrenom() + " ") + contact.getNom();
        return ActivityReference.of(ActivityRecordType.CONTACT_COMPAGNIE, contact.getId(), name.trim());
    }

    public static Map<String, String> snapshot(ContactCompagnie contact) {
        return new ActivityValues().put("Nom", contact.getNom()).put("Prénom", contact.getPrenom())
                .put("Service", serviceLabel(contact.getService())).put("Fonction", contact.getFonction())
                .put("Adresse e-mail", contact.getEmail()).put("Mobile", contact.getTelephoneMobile())
                .put("Téléphone fixe", contact.getTelephoneFixe()).put("Poste", contact.getPosteTelephonique())
                .put("WhatsApp", contact.getWhatsapp()).put("Fax", contact.getFax())
                .put("Principal", contact.getPrincipal()).put("Notes", contact.getNotes()).put("Actif", contact.getActif()).snapshot();
    }

    public static PrincipalChanges displacedPrincipals(ContactCompagnie target, List<ContactCompagnie> previous) {
        List<ActivityReference> references = new ArrayList<>();
        List<ActivityChange> changes = new ArrayList<>();
        for (ContactCompagnie contact : previous) {
            if (Objects.equals(contact.getId(), target.getId())) continue;
            ActivityReference reference = reference(contact);
            references.add(reference);
            changes.add(new ActivityChange("Contact principal remplacé - " + reference.label(), "Oui", "Non"));
        }
        return new PrincipalChanges(List.copyOf(references), List.copyOf(changes));
    }

    public static ActivityCommand command(ContactCompagnie contact, Map<String, String> before, PrincipalChanges displaced,
            ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>(displaced.references());
        references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE, contact.getCompagnieAssurance().getId(),
                contact.getCompagnieAssurance().getNom()));
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(before, snapshot(contact)));
        changes.addAll(displaced.changes());
        return new ActivityCommand(contact.getAgence().getId(), ActivityModule.COMPAGNIES, action, title, origin,
                reference(contact), references, changes);
    }

    private static String serviceLabel(ServiceContactCompagnie service) {
        if (service == null) return null;
        return switch (service) {
            case PRODUCTION -> "Production";
            case COMPTABILITE -> "Comptabilité";
            case SINISTRES -> "Sinistres";
            case RENOUVELLEMENTS -> "Renouvellements";
            case ATTESTATIONS_STOCK -> "Stock d'attestations";
            case COMMERCIAL -> "Commercial";
            case DIRECTION -> "Direction";
            case AUTRE -> "Autre";
        };
    }

    public record PrincipalChanges(List<ActivityReference> references, List<ActivityChange> changes) {
        public static PrincipalChanges none() {
            return new PrincipalChanges(List.of(), List.of());
        }
    }
}
