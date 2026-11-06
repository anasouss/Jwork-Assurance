package com.assurance.activity;

import com.assurance.entity.Client;
import com.assurance.enums.GenreClient;
import com.assurance.enums.TypeClient;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

public final class ClientActivity {
    private ClientActivity() {
    }

    public static ActivityReference reference(Client client) {
        String name = client.getNomAffichage();
        if (name == null || name.isBlank()) name = "Client";
        return ActivityReference.of(ActivityRecordType.CLIENT, client.getId(),
                client.getCodeClient() == null ? name : client.getCodeClient() + " - " + name);
    }

    public static State capture(Client client) {
        Map<String, Long> relationships = new LinkedHashMap<>();
        List<ActivityReference> references = new ArrayList<>();
        relationships.put("Client parent", client.getClientParent() == null ? null : client.getClientParent().getId());
        relationships.put("Ville", client.getVille() == null ? null : client.getVille().getId());
        relationships.put("Catégorie", client.getCategorieClient() == null ? null : client.getCategorieClient().getId());
        if (client.getClientParent() != null) references.add(reference(client.getClientParent()));
        if (client.getVille() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "VILLE:" + client.getVille().getId(), client.getVille().getNom()));
        if (client.getCategorieClient() != null) references.add(ActivityReference.of(ActivityRecordType.CATEGORIE_CLIENT,
                client.getCategorieClient().getId(), client.getCategorieClient().getLibelle()));
        return new State(snapshot(client), references, relationships);
    }

    public static ActivityCommand command(Client client, State before,
            ActivityAction action, String title, String origin) {
        State after = capture(client);
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(before == null ? null : before.values(), after.values()));
        if (before != null) {
            var labels = new LinkedHashSet<>(before.relationships().keySet());
            labels.addAll(after.relationships().keySet());
            for (String label : labels) {
                if (!Objects.equals(before.relationships().get(label), after.relationships().get(label))
                        && changes.stream().noneMatch(change -> label.equals(change.label()))) {
                    changes.add(new ActivityChange(label, null, "Selection actualisee"));
                }
            }
        }
        Map<String, ActivityReference> references = new LinkedHashMap<>();
        if (before != null) before.references().forEach(reference -> references.put(reference.type() + ":" + reference.id(), reference));
        after.references().forEach(reference -> references.put(reference.type() + ":" + reference.id(), reference));
        return new ActivityCommand(client.getAgence().getId(), ActivityModule.CRM, action, title,
                origin, reference(client), List.copyOf(references.values()), changes);
    }

    public record State(Map<String, String> values, List<ActivityReference> references, Map<String, Long> relationships) {
        public State {
            values = Collections.unmodifiableMap(new LinkedHashMap<>(values));
            references = List.copyOf(references);
            relationships = Collections.unmodifiableMap(new LinkedHashMap<>(relationships));
        }
    }

    public static Map<String, String> snapshot(Client client) {
        String phones = client.getTelephones() == null ? null : client.getTelephones().stream()
                .map(phone -> phone.getNumero()
                        + (Boolean.TRUE.equals(phone.getPrincipal()) ? " (principal)" : "")
                        + (Boolean.TRUE.equals(phone.getWhatsapp()) ? " (WhatsApp)" : ""))
                .sorted().collect(Collectors.joining(", "));
        return new ActivityValues()
                .put("Code client", client.getCodeClient())
                .put("Type de client", client.getTypeClient() == null ? null
                        : client.getTypeClient() == TypeClient.PERSONNE_MORALE ? "Personne morale" : "Personne physique")
                .put("Genre", client.getGenre() == null ? null : client.getGenre() == GenreClient.HOMME ? "Homme" : "Femme")
                .put("Prénom", client.getPrenom()).put("Nom", client.getNom())
                .put("Raison sociale", client.getRaisonSociale())
                .put("CIN", client.getCin()).put("Validité CIN", client.getCinValidite())
                .put("Passeport", client.getPassport()).put("Validité passeport", client.getPassportValidite())
                .put("Permis de conduire", client.getNumeroPermis())
                .put("Délivrance du permis", client.getDateDelivrancePermis())
                .put("Validité du permis", client.getDateValiditePermis())
                .put("Date de naissance", client.getDateNaissance())
                .put("Nationalité", client.getNationalite()).put("Carte de résidence", client.getCarteResidence())
                .put("RC", client.getRc()).put("ICE", client.getIce()).put("IF", client.getIff())
                .put("Patente", client.getPatente()).put("CNSS", client.getCnss())
                .put("Adresse", client.getAdresse()).put("Ville", client.getVille() == null ? null : client.getVille().getNom())
                .put("Catégorie", client.getCategorieClient() == null ? null : client.getCategorieClient().getLibelle())
                .put("Client parent", client.getClientParent() == null ? null : reference(client.getClientParent()).label())
                .put("Téléphone principal", client.getTelephone()).put("Téléphones", phones)
                .put("E-mail", client.getEmail()).put("Conducteur habituel", client.getConducteurHabituel())
                .put("Actif", client.getActif()).snapshot();
    }
}
