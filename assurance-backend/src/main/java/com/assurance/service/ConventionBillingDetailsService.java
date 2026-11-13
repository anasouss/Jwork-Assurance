package com.assurance.service;

import com.assurance.entity.Client;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.MouvementContrat;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.RoleClientContrat;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.AffectationQuittanceCompagnieRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Comparator;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ConventionBillingDetailsService {
    private final ContratClientRepository clients;
    private final AffectationQuittanceCompagnieRepository affectations;

    public Details details(ElementFacturable element) {
        MouvementContrat movement = element.getMouvementContrat();
        String insured = clients.findByContratIdIn(java.util.List.of(element.getContrat().getId())).stream()
                .filter(link -> link.getRole() == RoleClientContrat.PROPRIETAIRE
                        || link.getRole() == RoleClientContrat.SOUSCRIPTEUR)
                .sorted(Comparator.comparing((ContratClient link) -> link.getRole() != RoleClientContrat.PROPRIETAIRE)
                        .thenComparing(link -> !Boolean.TRUE.equals(link.getPrincipalPourRole())))
                .map(ContratClient::getClient).map(this::name).findFirst().orElse(null);
        String vehicle = movement == null ? null : movement.getVehicules().stream()
                .filter(item -> item.getNature() != NatureSnapshotMouvement.AVANT)
                .sorted(Comparator.comparing(com.assurance.entity.MouvementVehicule::getId))
                .map(item -> item.getImmatriculation() == null || item.getImmatriculation().isBlank()
                        ? item.getImmatriculationProvisoire() : item.getImmatriculation())
                .filter(Objects::nonNull).distinct().collect(Collectors.joining(", "));
        String receipt = affectations.findCompanyNumbersForElement(element.getAgence().getId(),
                        element.getContrat().getId(), element.getId()).stream()
                .filter(Objects::nonNull).map(String::trim).filter(number -> !number.isEmpty())
                .distinct().collect(Collectors.joining(", "));
        return new Details(receipt.isEmpty() ? null : receipt, insured, vehicle);
    }

    public String movementLabel(MouvementContrat movement) {
        if (movement.getTypeMouvement().getCategorie() == CategorieMouvementContrat.AFFAIRE_NOUVELLE) return "Affaire nouvelle";
        if (movement.getTypeMouvement().getCategorie() == CategorieMouvementContrat.RENOUVELLEMENT) return "Terme";
        return movement.getPrimeTotale() != null && movement.getPrimeTotale().signum() < 0 ? "Ristourne" : "Avenant";
    }

    private String name(Client client) {
        if (client.getRaisonSociale() != null && !client.getRaisonSociale().isBlank()) return client.getRaisonSociale();
        return java.util.stream.Stream.of(client.getPrenom(), client.getNom())
                .filter(Objects::nonNull).collect(Collectors.joining(" "));
    }

    public record Details(String numeroQuittance, String assure, String vehicule) {
    }
}
