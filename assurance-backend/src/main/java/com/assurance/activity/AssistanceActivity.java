package com.assurance.activity;

import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.Contrat;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.Vehicule;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.LigneTarificationAssistanceRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

@Component
@RequiredArgsConstructor
public class AssistanceActivity {
    private final ContratRepository contracts;
    private final AssistanceContratRepository assistances;
    private final VehiculeRepository vehicles;
    private final LigneTarificationAssistanceRepository pricingLines;

    /** Read actual persisted children: some workflows replace rows without refreshing parent collections. */
    public Snapshot capture(Long agencyId, Long contractId) {
        Contrat contract = contracts.findByAgenceIdAndId(agencyId, contractId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contractId));
        Map<String, Part> parts = new LinkedHashMap<>();
        List<ActivityReference> references = new ArrayList<>();
        parts.put("contract", new Part("Contrat", new ActivityValues()
                .put("Dossier", contract.getNumeroDossier()).put("Police", contract.getNumeroPolice())
                .put("Date d'effet", contract.getDateEffet()).put("Date d'echeance", contract.getDateEcheance())
                .put("Echeance", contract.getEcheance()).put("Periodicite", contract.getPeriodicite())
                .put("Brouillon", contract.getBrouillon()).put("Statut", contract.getStatut() == null ? null : switch (contract.getStatut()) {
                    case DRAFT -> "Brouillon";
                    case ACTIVE -> "Actif";
                    case SUSPENDED -> "Suspendu";
                    case CANCELLED -> "Annule";
                    case EXPIRED -> "Expire";
                    case RENEWED -> "Renouvele";
                })
                .put("Categorie client", contract.getCategorieClient() == null ? null : contract.getCategorieClient().getLibelle())
                .put("Payeur", contract.getPayeurPrime() == null ? null : ClientActivity.reference(contract.getPayeurPrime()).label())
                .put("Type de payeur", contract.getTypePayeurPrime() == null ? null : switch (contract.getTypePayeurPrime()) {
                    case SOUSCRIPTEUR -> "Souscripteur";
                    case TRESORERIE_GROUPE -> "Tresorerie du groupe";
                    case MEMBRE_GROUPE -> "Membre du groupe";
                    case TIERS_MANDATE -> "Tiers mandate";
                }).snapshot()));
        if (contract.getPayeurPrime() != null) references.add(ClientActivity.reference(contract.getPayeurPrime()));
        if (contract.getContratOrigine() != null) references.add(ContractActivity.reference(contract.getContratOrigine()));
        for (var link : contract.getClients()) {
            String role = switch (link.getRole()) {
                case SOUSCRIPTEUR -> "Souscripteur";
                case PROPRIETAIRE -> "Proprietaire";
                case CONDUCTEUR -> "Conducteur";
                case BENEFICIAIRE -> "Assure";
                case PAYEUR -> "Payeur";
                case CONTACT -> "Contact";
            };
            ActivityReference client = ClientActivity.reference(link.getClient());
            var clientValues = new LinkedHashMap<>(ClientActivity.snapshot(link.getClient()));
            clientValues.putAll(new ActivityValues().put("Principal pour ce role", link.getPrincipalPourRole()).snapshot());
            parts.put("client:" + link.getRole() + ":" + client.id(),
                    new Part(role + " - " + client.label(), Collections.unmodifiableMap(clientValues)));
            references.add(client);
        }
        for (Vehicule vehicle : vehicles.findByContratIdAndContratAgenceIdOrderByCreatedAtAsc(contractId, agencyId)) {
            ActivityReference ref = vehicleReference(vehicle);
            parts.put("vehicle:" + vehicle.getId(), new Part(ref.label(), new ActivityValues()
                    .put("Immatriculation", vehicle.getImmatriculation())
                    .put("Type", vehicle.getTypeVehicule() == null ? null : switch (vehicle.getTypeVehicule()) {
                        case AUTOMOBILE -> "Automobile";
                        case CAMION -> "Camion";
                        case MOTO -> "Moto";
                        case BUS -> "Bus";
                        case TRACTEUR -> "Tracteur";
                        case AUTRE -> "Autre";
                    })
                    .put("Usage", vehicle.getUsage() == null ? null : vehicle.getUsage().getCode() + " - " + vehicle.getUsage().getLibelle())
                    .put("Marque", vehicle.getMarque() == null ? null : vehicle.getMarque().getLibelle())
                    .put("Carrosserie", vehicle.getCarrosserie() == null ? null : vehicle.getCarrosserie().getLibelle())
                    .put("Categorie transport", vehicle.getCategorieTransport() == null ? null : vehicle.getCategorieTransport().getLibelle())
                    .put("Premiere circulation", vehicle.getDatePremiereCirculation()).put("Expiration carte grise", vehicle.getDateExpirationCarteGrise())
                    .put("Nombre de places", vehicle.getNombrePlaces()).put("Date d'effet", vehicle.getDateEffet())
                    .put("Date d'echeance", vehicle.getDateEcheance()).put("Actif", vehicle.getActif()).snapshot()));
            references.add(ref);
        }
        for (AssistanceContrat assistance : assistances.findByContratIdAndContratAgenceIdOrderByCreatedAtDesc(contractId, agencyId)) {
            parts.put("assistance:" + assistance.getId(), new Part(reference(assistance).label(), snapshot(assistance)));
            references.add(reference(assistance));
            references.addAll(references(assistance));
        }
        for (var line : pricingLines.findByAssistanceContratContratIdAndAssistanceContratContratAgenceIdOrderByIdAsc(contractId, agencyId)) {
            ActivityReference insured = ClientActivity.reference(line.getAssure());
            parts.put("price:" + line.getAssistanceContrat().getId() + ":" + insured.id(),
                    new Part("Tarification - " + insured.label(), new ActivityValues()
                            .put("Age retenu", line.getAge()).put("Tarif", tariffLabel(line.getTarifProduitAssistance()))
                            .put("Coefficient de duree", line.getCoefficientDuree()).put("Base HT", line.getMontantBaseHt())
                            .put("Base TTC", line.getMontantBaseTtc()).put("Reduction", line.getMontantReduction())
                            .put("Prime nette", line.getPrimeNette()).put("Montant TTC", line.getPrimeTotale()).snapshot()));
            references.add(insured);
        }
        return new Snapshot(agencyId, ContractActivity.reference(contract), Collections.unmodifiableMap(parts), references.stream().distinct().toList());
    }

    public static ActivityReference reference(AssistanceContrat assistance) {
        String number = assistance.getNumeroContratOuQuittance();
        String label = number == null || number.isBlank() ? assistance.getProduit() : number;
        return ActivityReference.of(ActivityRecordType.ASSISTANCE, assistance.getId(),
                label == null || label.isBlank() ? "Assistance en preparation" : "Assistance - " + label);
    }

    public static ActivityReference vehicleReference(Vehicule vehicle) {
        return ActivityReference.of(ActivityRecordType.VEHICULE, vehicle.getId(),
                vehicle.getImmatriculation() == null || vehicle.getImmatriculation().isBlank() ? "Vehicule" : vehicle.getImmatriculation());
    }

    public static Map<String, String> snapshot(AssistanceContrat assistance) {
        ActivityValues values = new ActivityValues().put("Reference", assistance.getNumeroContratOuQuittance())
                .put("Nature", assistance.getTypeQuittance() == null ? null : switch (assistance.getTypeQuittance()) {
                    case "AN", "AFFAIRE_NOUVELLE" -> "Affaire nouvelle";
                    case "REN", "RENOUVELLEMENT" -> "Renouvellement";
                    default -> assistance.getTypeQuittance();
                })
                .put("Compagnie", assistance.getCompagnieAssistance() == null ? null : assistance.getCompagnieAssistance().getNom())
                .put("Produit", assistance.getProduit()).put("Tarif", tariffLabel(assistance.getTarifProduitAssistance()))
                .put("Vehicule", assistance.getVehicule() == null ? null : vehicleReference(assistance.getVehicule()).label())
                .put("Mouvement", movementLabel(assistance.getMouvementContrat()))
                .put("Souscription", assistance.getDateSouscription()).put("Date d'effet", assistance.getDateEffet())
                .put("Date d'echeance", assistance.getDateEcheance()).put("Echeance", assistance.getEcheanceCode())
                .put("Duree", assistance.getDuree()).put("Unite", "MOIS".equals(assistance.getUnite()) ? "Mois"
                        : "TRIMESTRE".equals(assistance.getUnite()) ? "Trimestre" : assistance.getUnite())
                .put("Code promotionnel", assistance.getCodePromo()).put("Reduction", assistance.getMontantReduction())
                .put("Prime nette", assistance.getPrimeNette()).put("Montant TTC", assistance.getPrimeTotale())
                .put("Libelle du releve", assistance.getLibelleReleve()).put("Actif", assistance.getActif());
        billableValues(values, assistance.getElementFacturable());
        return values.snapshot();
    }

    static void billableValues(ActivityValues values, ElementFacturable element) {
        if (element == null) return;
        values.put("Facturation active", element.getActif())
                .put("Statut de facturation", element.getStatut() == null ? null : switch (element.getStatut()) {
                    case BROUILLON -> "Brouillon";
                    case A_QUITTANCER -> "A quittancer";
                    case QUITTANCE_PARTIELLE -> "Partiellement quittance";
                    case QUITTANCE -> "Quittance";
                    case ANNULE -> "Annule";
                })
                .put("Taxes", element.getTaxe()).put("TPF", element.getTaxeParafiscale())
                .put("Accessoires", element.getAccessoire()).put("CNPAC", element.getCnpac());
    }

    public static List<ActivityReference> references(AssistanceContrat assistance) {
        List<ActivityReference> references = context(assistance.getContrat(), assistance.getMouvementContrat(),
                assistance.getVehicule(), assistance.getElementFacturable());
        if (assistance.getAssistanceOrigine() != null) references.add(reference(assistance.getAssistanceOrigine()));
        if (assistance.getCompagnieAssistance() != null) references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE_ASSISTANCE,
                assistance.getCompagnieAssistance().getId(), assistance.getCompagnieAssistance().getNom()));
        if (assistance.getProduitAssistance() != null) references.add(ActivityReference.of(ActivityRecordType.PRODUIT_ASSISTANCE,
                assistance.getProduitAssistance().getId(), assistance.getProduitAssistance().getLibelle()));
        if (assistance.getTarifProduitAssistance() != null) references.add(ActivityReference.of(ActivityRecordType.TARIF_ASSISTANCE,
                assistance.getTarifProduitAssistance().getId(), tariffLabel(assistance.getTarifProduitAssistance())));
        return references;
    }

    static List<ActivityReference> context(Contrat contract, MouvementContrat movement, Vehicule vehicle, ElementFacturable element) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(ContractActivity.reference(contract));
        for (var link : contract.getClients()) references.add(ClientActivity.reference(link.getClient()));
        if (movement != null) references.add(ActivityReference.of(ActivityRecordType.MOUVEMENT_CONTRAT, movement.getId(), movementLabel(movement)));
        if (vehicle != null) references.add(vehicleReference(vehicle));
        if (element != null) references.add(ActivityReference.of(ActivityRecordType.ELEMENT_FACTURABLE, element.getId(),
                element.getLibelle() == null || element.getLibelle().isBlank() ? "Element facturable" : element.getLibelle()));
        return references;
    }

    public static ActivityCommand linked(AssistanceContrat assistance, Map<String, String> before,
            List<ActivityReference> previousReferences, ActivityAction action, String title, String origin) {
        List<ActivityReference> references = new ArrayList<>(previousReferences);
        references.addAll(references(assistance));
        return new ActivityCommand(assistance.getContrat().getAgence().getId(), ActivityModule.PRODUCTION, action,
                title, origin, reference(assistance), references.stream().distinct().toList(), ActivityValues.changes(before, snapshot(assistance)));
    }

    public static ActivityCommand command(Snapshot before, Snapshot after, ActivityAction action, String title, String origin) {
        Snapshot current = after == null ? before : after;
        Map<String, Part> oldParts = before == null ? Map.of() : before.parts();
        Map<String, Part> newParts = after == null ? Map.of() : after.parts();
        var keys = new LinkedHashSet<>(oldParts.keySet());
        keys.addAll(newParts.keySet());
        List<ActivityChange> changes = new ArrayList<>();
        for (String key : keys) {
            Part oldPart = oldParts.get(key);
            Part newPart = newParts.get(key);
            String label = (newPart == null ? oldPart : newPart).label();
            for (ActivityChange change : ActivityValues.changes(oldPart == null ? null : oldPart.values(), newPart == null ? null : newPart.values())) {
                changes.add(new ActivityChange(label + " - " + change.label(), change.beforeValue(), change.afterValue()));
            }
        }
        List<ActivityReference> references = new ArrayList<>();
        if (before != null) {
            references.addAll(before.references());
            if (!before.subject().id().equals(current.subject().id())) references.add(before.subject());
        }
        if (after != null) references.addAll(after.references());
        references.removeIf(reference -> reference.type() == current.subject().type() && reference.id().equals(current.subject().id()));
        return new ActivityCommand(current.agencyId(), ActivityModule.PRODUCTION, action, title, origin,
                current.subject(), references.stream().distinct().toList(), changes);
    }

    private static String movementLabel(MouvementContrat movement) {
        if (movement == null) return null;
        return (movement.getTypeMouvement() == null ? "Mouvement" : movement.getTypeMouvement().getLibelle())
                + (movement.getNumeroMouvement() == null ? "" : " - " + movement.getNumeroMouvement());
    }

    private static String tariffLabel(TarifProduitAssistance tariff) {
        if (tariff == null) return null;
        var format = java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy");
        return "Tarif du " + (tariff.getDateDebut() == null ? "-" : tariff.getDateDebut().format(format))
                + (tariff.getDateFin() == null ? "" : " au " + tariff.getDateFin().format(format))
                + (tariff.getDureeMois() == null ? "" : " - " + tariff.getDureeMois() + " mois")
                + (tariff.getAgeMin() == null ? "" : tariff.getAgeMax() == null
                        ? " - a partir de " + tariff.getAgeMin() + " ans"
                        : " - " + tariff.getAgeMin() + " a " + tariff.getAgeMax() + " ans");
    }

    private record Part(String label, Map<String, String> values) {
    }

    public record Snapshot(Long agencyId, ActivityReference subject, Map<String, Part> parts, List<ActivityReference> references) {
    }
}
