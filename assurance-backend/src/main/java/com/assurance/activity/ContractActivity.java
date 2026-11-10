package com.assurance.activity;

import com.assurance.dto.response.ContratResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.MouvementContrat;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;

import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/** Only business-facing fields: technical row identities never become changes. */
public final class ContractActivity {
    private ContractActivity() {
    }

    public static ActivityCommand command(ContratResponse before, ContratResponse after,
            ActivityAction action, String title, String origin) {
        ContratResponse record = after == null ? before : after;
        return new ActivityCommand(record.getAgenceId(), ActivityModule.PRODUCTION, action,
                title, origin, reference(record), references(before, after), changes(before, after));
    }

    public static List<ActivityReference> references(ContratResponse before, ContratResponse after) {
        List<ActivityReference> references = new ArrayList<>();
        if (before != null) references.addAll(references(before));
        if (after != null) references.addAll(references(after));
        return distinctReferences(references);
    }

    public static List<ActivityChange> changes(ContratResponse before, ContratResponse after) {
        var oldValues = snapshot(before);
        var newValues = snapshot(after);
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(oldValues, newValues));
        if (before != null && after != null) {
            var oldRelationships = relationships(before);
            var newRelationships = relationships(after);
            var labels = new LinkedHashSet<>(oldRelationships.keySet());
            labels.addAll(newRelationships.keySet());
            for (String label : labels) {
                if (!Objects.equals(oldRelationships.get(label), newRelationships.get(label))
                        && changes.stream().noneMatch(change -> change.label().equals(label))) {
                    changes.add(new ActivityChange(label, null, "Selection actualisee"));
                }
            }
        }
        // Keep the saved guarantee code available even when only its price changed.
        var coverageLabels = new LinkedHashSet<String>();
        for (var change : changes) {
            int separator = change.label().lastIndexOf(" - ");
            if (separator < 0) continue;
            String coverageLabel = change.label().substring(0, separator) + " - Couverture";
            if (newValues.containsKey(coverageLabel) || oldValues.containsKey(coverageLabel)) {
                coverageLabels.add(coverageLabel);
            }
        }
        for (String coverageLabel : coverageLabels) {
            if (changes.stream().noneMatch(change -> change.label().equals(coverageLabel))) {
                String code = newValues.getOrDefault(coverageLabel, oldValues.get(coverageLabel));
                if (code != null) changes.add(new ActivityChange(coverageLabel, null, code));
            }
        }
        return List.copyOf(changes);
    }

    private static List<ActivityReference> distinctReferences(List<ActivityReference> references) {
        Map<String, ActivityReference> identities = new LinkedHashMap<>();
        references.forEach(reference -> identities.put(reference.type() + ":" + reference.id(), reference));
        return List.copyOf(identities.values());
    }

    private static Map<String, Object> relationships(ContratResponse contract) {
        Map<String, Object> values = new LinkedHashMap<>();
        values.put("Branche", contract.getBrancheAssuranceId());
        values.put("Compagnie", contract.getCompagnieAssuranceId());
        values.put("Convention", contract.getConventionId());
        values.put("Grille tarifaire", contract.getGrilleTarifaireId());
        values.put("Categorie client", contract.getCategorieClientId());
        values.put("Usage du contrat", contract.getUsageId());
        values.put("Contrat d'origine", contract.getContratOrigineId());
        values.put("Payeur", contract.getPayeurPrimeClientId());
        values.put("Groupe de facturation", contract.getGroupeFacturationId());
        for (var role : com.assurance.enums.RoleClientContrat.values()) {
            values.put(clientRole(role.name()), items(contract.getClients()).stream().filter(link -> role.name().equals(link.getRole()))
                    .map(link -> link.getClientId() + ":" + link.isPrincipalPourRole()).sorted().toList());
        }
        int index = 0;
        for (var vehicle : items(contract.getVehicules())) {
            String prefix = "Vehicule " + (++index) + " - ";
            values.put(prefix + "Usage", vehicle.getUsageId());
            values.put(prefix + "Marque", vehicle.getMarqueId());
            values.put(prefix + "Carrosserie", vehicle.getCarrosserieId());
            values.put(prefix + "Categorie de transport", vehicle.getCategorieTransportId());
            values.put(prefix + "Marque remorque", vehicle.getMarqueRemorqueId());
        }
        index = 0;
        for (var trailer : items(contract.getRemorques())) {
            String prefix = "Remorque " + (++index) + " - ";
            values.put(prefix + "Usage", trailer.getUsageId());
            values.put(prefix + "Marque", trailer.getMarqueId());
        }
        // Draft saves rebuild target and guarantee rows; only business selections matter.
        values.put("Affectation et parametrage des garanties", items(contract.getGaranties()).stream()
                .map(guarantee -> guarantee.getGarantieId() + ":" + targetKey(contract, guarantee.getVehiculeId(), guarantee.getRemorqueId())
                        + ":" + guarantee.getClientId() + ":" + guarantee.getLigneGrilleTarifaireId() + ":" + guarantee.getFormuleGarantiePersonneId())
                .sorted().toList());
        values.put("Configuration des assistances", items(contract.getAssistances()).stream()
                .map(assistance -> targetKey(contract, assistance.getVehiculeId(), null) + ":" + assistance.getCompagnieAssistanceId()
                        + ":" + assistance.getProduitAssistanceId() + ":" + assistance.getTarifProduitAssistanceId())
                .sorted().toList());
        return values;
    }

    private static String targetKey(ContratResponse contract, Long vehicleId, Long trailerId) {
        if (vehicleId != null) {
            var vehicles = items(contract.getVehicules());
            for (int index = 0; index < vehicles.size(); index++) {
                if (vehicleId.equals(vehicles.get(index).getVehiculeId())) return "VEHICULE:" + index;
            }
            return "VEHICULE:" + vehicleId;
        }
        if (trailerId != null) {
            var trailers = items(contract.getRemorques());
            for (int index = 0; index < trailers.size(); index++) {
                if (trailerId.equals(trailers.get(index).getRemorqueId())) return "REMORQUE:" + index;
            }
            return "REMORQUE:" + trailerId;
        }
        return "CONTRAT";
    }

    private static String clientRole(String role) {
        return switch (role) {
            case "SOUSCRIPTEUR" -> "Souscripteur";
            case "PROPRIETAIRE" -> "Proprietaire";
            case "CONDUCTEUR" -> "Conducteur";
            case "BENEFICIAIRE" -> "Beneficiaire";
            case "PAYEUR" -> "Client payeur";
            case "CONTACT" -> "Contact";
            default -> role;
        };
    }

    public static ActivityReference reference(ContratResponse record) {
        return ActivityReference.of(ActivityRecordType.CONTRAT, record.getId(), dossierLabel(
                record.getProspection(), record.getBrouillon(), record.getNumeroDossier(),
                record.getNumeroDevis(), record.getNumeroPolice(), record.getNumeroContrat()));
    }

    public static ActivityReference reference(Contrat record) {
        return ActivityReference.of(ActivityRecordType.CONTRAT, record.getId(), dossierLabel(
                record.getProspection(), record.getBrouillon(), record.getNumeroDossier(),
                record.getNumeroDevis(), record.getNumeroPolice(), record.getNumeroContrat()));
    }

    private static String dossierLabel(Boolean prospection, Boolean brouillon, String dossier,
            String devis, String police, String contrat) {
        boolean draft = Boolean.TRUE.equals(brouillon);
        if (Boolean.TRUE.equals(prospection)) {
            String result = draft ? "Brouillon de devis" : "Devis";
            if (devis != null && !devis.isBlank()) result += " " + devis;
            if (dossier != null && !dossier.isBlank() && !dossier.equals(devis)) result += " - Dossier " + dossier;
            return result;
        }
        if (draft) {
            return "Brouillon de contrat" + (dossier == null || dossier.isBlank() ? "" : " - Dossier " + dossier);
        }
        if (dossier != null && !dossier.isBlank()) return "Dossier " + dossier;
        if (police != null && !police.isBlank()) return "Police " + police;
        if (contrat != null && !contrat.isBlank()) return "Contrat " + contrat;
        return "Contrat sans reference";
    }

    public static ActivityCommand genericMovementCommand(MouvementContrat movement, QuittanceResponse response, StatutContrat previousStatus) {
        Contrat contract = movement.getContrat();
        String movementLabel = movement.getTypeMouvement().getLibelle();
        List<ActivityReference> references = new ArrayList<>();
        references.add(reference(contract));
        if (contract.getCompagnieAssurance() != null) references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE,
                contract.getCompagnieAssurance().getId(), contract.getCompagnieAssurance().getNom()));
        for (var client : items(contract.getClients())) references.add(ActivityReference.of(ActivityRecordType.CLIENT,
                client.getClient().getId(), client.getClient().getNomAffichage()));
        for (var vehicle : items(movement.getVehicules())) {
            if (vehicle.getVehicule() != null) references.add(ActivityReference.of(ActivityRecordType.VEHICULE,
                    vehicle.getVehicule().getId(), label(vehicle.getImmatriculation(), "Vehicule du mouvement")));
        }
        for (var trailer : items(movement.getRemorques())) {
            if (trailer.getRemorque() != null) references.add(ActivityReference.of(ActivityRecordType.REMORQUE,
                    trailer.getRemorque().getId(), label(trailer.getImmatriculation(), "Remorque du mouvement")));
        }
        for (var guarantee : items(movement.getGaranties())) references.add(ActivityReference.of(ActivityRecordType.GARANTIE,
                guarantee.getGarantie().getId(), guarantee.getGarantie().getLibelle()));
        if (response.getId() != null) references.add(ActivityReference.of(ActivityRecordType.QUITTANCE,
                response.getId(), label(response.getNumeroQuittance(), "Quittance du mouvement")));
        if (response.getElementFacturableId() != null) references.add(ActivityReference.of(ActivityRecordType.ELEMENT_FACTURABLE,
                response.getElementFacturableId(), movementLabel));
        var values = new ActivityValues().put("Evenement", movementLabel).put("Numero du mouvement", movement.getNumeroMouvement())
                .put("Date d'effet", movement.getDateEffet()).put("Date d'echeance", movement.getDateEcheance())
                .put("Date de validation", movement.getDateValidation()).put("Prime nette", movement.getPrimeNette())
                .put("Taxes", movement.getTaxe()).put("TPF", movement.getTaxeParafiscale())
                .put("Accessoires", movement.getAccessoire()).put("CNPAC", movement.getCnpac()).put("Montant TTC", movement.getPrimeTotale())
                .put("Libelle du releve", movement.getLibelleReleve()).put("Notes", movement.getNotes());
        List<ActivityChange> changes = new ArrayList<>(ActivityValues.changes(null, values.snapshot()));
        if (previousStatus != contract.getStatut()) changes.add(new ActivityChange("Statut du contrat",
                contractStatus(previousStatus), contractStatus(contract.getStatut())));
        return new ActivityCommand(contract.getAgence().getId(), ActivityModule.PRODUCTION, ActivityAction.VALIDATED,
                movementLabel + " - mouvement valide", "CONTRACT_GENERIC_MOVEMENT_CREATE",
                ActivityReference.of(ActivityRecordType.MOUVEMENT_CONTRAT, movement.getId(),
                        movementLabel + " - " + movement.getNumeroMouvement()), references.stream().distinct().toList(), changes);
    }

    public static List<ActivityReference> references(ContratResponse record) {
        List<ActivityReference> references = new ArrayList<>();
        if (record.getBrancheAssuranceId() != null) references.add(new ActivityReference(ActivityRecordType.REFERENTIEL,
                "BRANCHE_ASSURANCE:" + record.getBrancheAssuranceId(), label(record.getBrancheAssuranceLibelle(), "Branche")));
        if (record.getUsageId() != null) references.add(ActivityReference.of(ActivityRecordType.USAGE,
                record.getUsageId(), label(record.getUsageLibelle(), "Usage")));
        if (record.getCategorieClientId() != null) references.add(ActivityReference.of(ActivityRecordType.CATEGORIE_CLIENT,
                record.getCategorieClientId(), label(record.getCategorieClientLibelle(), "Categorie client")));
        if (record.getPayeurPrimeClientId() != null) references.add(ActivityReference.of(ActivityRecordType.CLIENT,
                record.getPayeurPrimeClientId(), label(record.getPayeurPrimeNom(), "Payeur")));
        if (record.getGroupeFacturationId() != null) references.add(ActivityReference.of(ActivityRecordType.GROUPE_CLIENT,
                record.getGroupeFacturationId(), label(record.getGroupeFacturationNom(), "Groupe de facturation")));
        if (record.getContratOrigineId() != null) references.add(ActivityReference.of(ActivityRecordType.CONTRAT,
                record.getContratOrigineId(), label(record.getContratOrigineReference(), "Contrat d'origine")));
        if (record.getCompagnieAssuranceId() != null) references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE,
                record.getCompagnieAssuranceId(), label(record.getCompagnieAssuranceNom(), "Compagnie")));
        if (record.getConventionId() != null) references.add(ActivityReference.of(ActivityRecordType.CONVENTION,
                record.getConventionId(), label(record.getConventionIntitule(), "Convention")));
        if (record.getGrilleTarifaireId() != null) references.add(ActivityReference.of(ActivityRecordType.GRILLE_TARIFAIRE,
                record.getGrilleTarifaireId(), label(record.getGrilleTarifaireLibelle(), "Grille tarifaire")));
        for (var client : items(record.getClients())) {
            String name = label(client.getNomAffichage(), "Client");
            if (client.getClient() != null && client.getClient().getCodeClient() != null) name = client.getClient().getCodeClient() + " - " + name;
            if (client.getClientId() != null) references.add(ActivityReference.of(ActivityRecordType.CLIENT,
                    client.getClientId(), name));
        }
        for (var vehicle : items(record.getVehicules())) {
            if (vehicle.getVehiculeId() != null) references.add(ActivityReference.of(ActivityRecordType.VEHICULE,
                    vehicle.getVehiculeId(), label(vehicle.getImmatriculation(), "Vehicule")));
            addReference(references, ActivityRecordType.USAGE, vehicle.getUsageId(), vehicle.getUsageLibelle(), "Usage du vehicule");
            addReference(references, ActivityRecordType.MARQUE, vehicle.getMarqueId(), vehicle.getMarque(), "Marque du vehicule");
            addReference(references, ActivityRecordType.CARROSSERIE, vehicle.getCarrosserieId(), vehicle.getCarrosserie(), "Carrosserie");
            addReference(references, ActivityRecordType.CATEGORIE_TRANSPORT, vehicle.getCategorieTransportId(), vehicle.getCategorieTransportLibelle(), "Categorie de transport");
            addReference(references, ActivityRecordType.MARQUE, vehicle.getMarqueRemorqueId(), vehicle.getMarqueRemorque(), "Marque remorque");
        }
        for (var trailer : items(record.getRemorques())) {
            if (trailer.getRemorqueId() != null) references.add(ActivityReference.of(ActivityRecordType.REMORQUE,
                    trailer.getRemorqueId(), label(trailer.getImmatriculation(), "Remorque")));
            addReference(references, ActivityRecordType.USAGE, trailer.getUsageId(), trailer.getUsageLibelle(), "Usage de la remorque");
            addReference(references, ActivityRecordType.MARQUE, trailer.getMarqueId(), trailer.getMarque(), "Marque de la remorque");
        }
        for (var movement : items(record.getMouvements())) {
            if (movement.getId() != null) references.add(ActivityReference.of(ActivityRecordType.MOUVEMENT_CONTRAT,
                    movement.getId(), label(movement.getLibelle(), "Mouvement")
                            + (movement.getNumeroMouvement() == null ? "" : " - " + movement.getNumeroMouvement())));
        }
        for (var guarantee : items(record.getGaranties())) {
            if (guarantee.getGarantieId() != null) references.add(ActivityReference.of(ActivityRecordType.GARANTIE,
                    guarantee.getGarantieId(), label(guarantee.getLibelle(), "Garantie")));
            addReference(references, ActivityRecordType.LIGNE_GRILLE_TARIFAIRE, guarantee.getLigneGrilleTarifaireId(),
                    "Tarif - " + label(guarantee.getLibelle(), "Garantie"), "Ligne tarifaire");
            addReference(references, ActivityRecordType.FORMULE_GARANTIE_PERSONNE, guarantee.getFormuleGarantiePersonneId(),
                    "Formule - " + label(guarantee.getFormule(), guarantee.getLibelle()), "Formule de garantie");
            if (guarantee.getClientId() != null && items(record.getClients()).stream().noneMatch(client -> guarantee.getClientId().equals(client.getClientId()))) {
                references.add(ActivityReference.of(ActivityRecordType.CLIENT, guarantee.getClientId(), "Personne assuree"));
            }
        }
        for (var assistance : items(record.getAssistances())) {
            if (assistance.getId() != null) references.add(ActivityReference.of(ActivityRecordType.ASSISTANCE,
                    assistance.getId(), "Assistance - " + label(assistance.getNumeroContratOuQuittance(), label(assistance.getProduit(), "En preparation"))));
            if (assistance.getElementFacturableId() != null) references.add(ActivityReference.of(ActivityRecordType.ELEMENT_FACTURABLE,
                    assistance.getElementFacturableId(), "Assistance - " + label(assistance.getProduit(), "Element facturable")));
            if (assistance.getCompagnieAssistanceId() != null) references.add(ActivityReference.of(ActivityRecordType.COMPAGNIE_ASSISTANCE,
                    assistance.getCompagnieAssistanceId(), label(assistance.getCompagnieAssistanceLibelle(), "Compagnie d'assistance")));
            if (assistance.getProduitAssistanceId() != null) references.add(ActivityReference.of(ActivityRecordType.PRODUIT_ASSISTANCE,
                    assistance.getProduitAssistanceId(), label(assistance.getProduit(), "Produit d'assistance")));
            if (assistance.getTarifProduitAssistanceId() != null) references.add(ActivityReference.of(ActivityRecordType.TARIF_ASSISTANCE,
                    assistance.getTarifProduitAssistanceId(), "Tarif - " + label(assistance.getProduit(), "Assistance")));
        }
        if (record.getQuittanceGenerale() != null) {
            var receipt = record.getQuittanceGenerale();
            if (receipt.getId() != null) references.add(ActivityReference.of(ActivityRecordType.QUITTANCE,
                    receipt.getId(), label(receipt.getNumeroQuittance(), "Quittance generale")));
            if (receipt.getElementFacturableId() != null) references.add(ActivityReference.of(ActivityRecordType.ELEMENT_FACTURABLE,
                    receipt.getElementFacturableId(), "Creance du contrat"));
        }
        return distinctReferences(references);
    }

    public static Map<String, String> snapshot(ContratResponse contract) {
        if (contract == null) return Map.of();
        ActivityValues values = new ActivityValues()
                .put("Nature du dossier", Boolean.TRUE.equals(contract.getProspection()) ? "Devis" : "Contrat")
                .put("Dossier", contract.getNumeroDossier())
                .put("Devis", contract.getNumeroDevis())
                .put("Police", contract.getNumeroPolice())
                .put("Branche", contract.getBrancheAssuranceLibelle())
                .put("Compagnie", contract.getCompagnieAssuranceNom())
                .put("Convention", contract.getConventionIntitule())
                .put("Grille tarifaire", contract.getGrilleTarifaireLibelle())
                .put("Categorie client", contract.getCategorieClientLibelle())
                .put("Usage du contrat", contract.getUsageLibelle())
                .put("Contrat d'origine", contract.getContratOrigineReference())
                .put("Statut", contractStatus(contract.getStatut()))
                .put("Type de contrat", contract.getTypeContrat() == null ? null
                        : contract.getTypeContrat() == TypeContrat.PARTICULIER ? "Mono"
                        : contract.getTypeContrat() == TypeContrat.FLOTTE ? "Flotte" : "Convention")
                .put("Brouillon", contract.getBrouillon())
                .put("Prospection", contract.getProspection())
                .put("Date d'effet", contract.getDateEffet())
                .put("Date d'echeance", contract.getDateEcheance())
                .put("Numero d'attestation", contract.getNumeroAttestation())
                .put("Mode de reglement", paymentMode(contract.getModeReglement()))
                .put("Mode de paiement", contract.getModePaiement())
                .put("Payeur", contract.getPayeurPrimeNom())
                .put("Groupe de facturation", contract.getGroupeFacturationNom())
                .put("Facturation", contract.getModeFacturation() == null ? null : switch (contract.getModeFacturation()) {
                    case DIRECTE -> "Directe";
                    case CONSOLIDEE_GROUPE -> "Consolidee par groupe";
                })
                .put("Fractionnement", contract.getFractionnement() == null ? null : switch (contract.getFractionnement()) {
                    case MENSUEL -> "Mensuel";
                    case TRIMESTRIEL -> "Trimestriel";
                    case SEMESTRIEL -> "Semestriel";
                    case ANNUEL -> "Annuel";
                })
                .put("Echeance annuelle", contract.getEcheance())
                .put("Renouvellement", contract.getTypeRenouvellement())
                .put("Terme de renouvellement", contract.getModeTermeRenouvellement() == null ? null
                        : contract.getModeTermeRenouvellement() == com.assurance.enums.ModeTermeRenouvellement.CABINET ? "Cabinet" : "Compagnie")
                .put("Renouvele", contract.getRenouvele())
                .put("Saisie des garanties", contract.getModeSaisieGaranties() == null ? null : switch (contract.getModeSaisieGaranties()) {
                    case MANUELLE -> "Manuelle";
                    case MANUELLE_AVEC_PRIME_NETTE -> "Manuelle avec primes";
                    case AUTOMATIQUE_GRILLE -> "Grille tarifaire";
                })
                .put("Saisie avec primes", contract.getSaisiePrimeNette())
                .put("Taux RC", contract.getTauxRc())
                .put("CRM partage", contract.getCrmPartage())
                .put("Valeur du CRM partage", contract.getCrmPartageValeur())
                .put("Bon de commande", contract.getNumeroBonCommande())
                .put("Montant du bulletin", contract.getMontantBulletin())
                .put("Libelle du releve", contract.getLibelleReleve())
                .put("Notes", contract.getNotes())
                .put("Reduction saharienne", contract.getReductionSaharienne());
        for (var role : com.assurance.enums.RoleClientContrat.values()) {
            String names = items(contract.getClients()).stream()
                    .filter(client -> role.name().equals(client.getRole())).map(ContratResponse.ClientLink::getNomAffichage)
                    .filter(Objects::nonNull).sorted().collect(Collectors.joining(", "));
            values.put(clientRole(role.name()), names.isBlank() ? null : names);
        }
        int index = 0;
        for (var vehicle : items(contract.getVehicules())) {
            String prefix = "Vehicule " + (++index) + " - ";
            values.put(prefix + "Immatriculation", vehicle.getImmatriculation())
                    .put(prefix + "Marque", vehicle.getMarque())
                    .put(prefix + "Usage", vehicle.getUsageLibelle())
                    .put(prefix + "Carrosserie", vehicle.getCarrosserie())
                    .put(prefix + "Categorie de transport", vehicle.getCategorieTransportLibelle())
                    .put(prefix + "Sous-classe", vehicle.getSousClasse())
                    .put(prefix + "PTC", vehicle.getPtc())
                    .put(prefix + "Carburant", vehicle.getCarburant())
                    .put(prefix + "Puissance fiscale", vehicle.getPuissanceFiscale())
                    .put(prefix + "Cylindree", vehicle.getCylindree())
                    .put(prefix + "Places", vehicle.getNombrePlaces())
                    .put(prefix + "Mise en circulation", vehicle.getDatePremiereCirculation())
                    .put(prefix + "Validite carte grise", vehicle.getDateExpirationCarteGrise())
                    .put(prefix + "Attestation", vehicle.getNumeroAttestation())
                    .put(prefix + "Date d'effet", vehicle.getDateEffet())
                    .put(prefix + "Date d'echeance", vehicle.getDateEcheance())
                    .put(prefix + "CRM", vehicle.getCrm())
                    .put(prefix + "Coefficient prorata", vehicle.getCoefficientProrata())
                    .put(prefix + "Valeur a neuf", vehicle.getValeurNeuf())
                    .put(prefix + "Valeur venale", vehicle.getValeurVenale())
                    .put(prefix + "Valeur glace", vehicle.getValeurGlace())
                    .put(prefix + "Remorque attachee", vehicle.getRemorque())
                    .put(prefix + "Numero de remorque", vehicle.getNumeroRemorque())
                    .put(prefix + "Marque remorque", vehicle.getMarqueRemorque())
                    .put(prefix + "Credit", vehicle.getOrganismeCredit())
                    .put(prefix + "Organisme de credit", vehicle.getNomOrganismeCredit())
                    .put(prefix + "Montant du credit", vehicle.getMontantCredit())
                    .put(prefix + "Fin du credit", vehicle.getDateFinCredit());
        }
        index = 0;
        for (var trailer : items(contract.getRemorques())) {
            String prefix = "Remorque " + (++index) + " - ";
            values.put(prefix + "Immatriculation", trailer.getImmatriculation())
                    .put(prefix + "Marque", trailer.getMarque())
                    .put(prefix + "Usage", trailer.getUsageLibelle())
                    .put(prefix + "PTC", trailer.getPtc())
                    .put(prefix + "Mise en circulation", trailer.getDateMiseEnCirculation())
                    .put(prefix + "Date d'effet", trailer.getDateEffet())
                    .put(prefix + "Date d'echeance", trailer.getDateEcheance())
                    .put(prefix + "CRM", trailer.getCrm())
                    .put(prefix + "Coefficient prorata", trailer.getCoefficientProrata())
                    .put(prefix + "Attestation", trailer.getNumeroAttestation())
                    .put(prefix + "Valeur assuree", trailer.getValeurAssuree());
        }
        for (var guarantee : items(contract.getGaranties())) {
            String target = guarantee.getVehiculeId() != null
                    ? items(contract.getVehicules()).stream().filter(vehicle -> Objects.equals(vehicle.getVehiculeId(), guarantee.getVehiculeId()))
                            .map(vehicle -> label(vehicle.getImmatriculation(), "Vehicule")).findFirst().orElse("Vehicule")
                    : guarantee.getRemorqueId() != null
                    ? items(contract.getRemorques()).stream().filter(trailer -> Objects.equals(trailer.getRemorqueId(), guarantee.getRemorqueId()))
                            .map(trailer -> label(trailer.getImmatriculation(), "Remorque")).findFirst().orElse("Remorque")
                    : guarantee.getClientId() != null
                    ? items(contract.getClients()).stream().filter(client -> Objects.equals(client.getClientId(), guarantee.getClientId()))
                            .map(client -> label(client.getNomAffichage(), "Personne assuree")).findFirst().orElse("Personne assuree")
                    : "Contrat";
            String prefix = label(guarantee.getLibelle(), "Garantie") + " (" + target + ") - ";
            values.put(prefix + "Couverture", label(guarantee.getCode(), guarantee.getLibelle()))
                    .put(prefix + "Mode de tarification", AmendmentActivity.guaranteeMode(guarantee.getModeSelectionne()))
                    .put(prefix + "Base assuree", AmendmentActivity.valueSource(guarantee.getSourceValeurSelectionnee()))
                    .put(prefix + "Capital", guarantee.getCapital())
                    .put(prefix + "Valeur assuree", guarantee.getValeurAssuree())
                    .put(prefix + "Formule", guarantee.getFormule())
                    .put(prefix + "Prime", guarantee.getPrime())
                    .put(prefix + "Taux", guarantee.getTaux())
                    .put(prefix + "Franchise", guarantee.getTauxFranchise())
                    .put(prefix + "Franchise minimale", guarantee.getFranchiseMinimale())
                    .put(prefix + "Deces", guarantee.getMontantDeces())
                    .put(prefix + "Invalidite", guarantee.getMontantInvalidite())
                    .put(prefix + "Frais medicaux", guarantee.getMontantFraisMedicaux())
                    .put(prefix + "Hospitalisation", guarantee.getMontantFraisHospitalisation())
                    .put(prefix + "Frais funeraires", guarantee.getMontantFraisFuneraires())
                    .put(prefix + "Chirurgie", guarantee.getMontantFraisChirurgie())
                    .put(prefix + "Accessoire", guarantee.getAccessoire());
        }
        valuesFromQuittance(values, contract.getQuittanceGenerale(), "Quittance - ");
        index = 0;
        for (var assistance : items(contract.getAssistances())) {
            String prefix = "Assistance " + (++index) + " - ";
            values.put(prefix + "Reference", assistance.getNumeroContratOuQuittance())
                    .put(prefix + "Vehicule", assistance.getVehiculeImmatriculation())
                    .put(prefix + "Compagnie", assistance.getCompagnieAssistanceLibelle())
                    .put(prefix + "Produit", assistance.getProduit())
                    .put(prefix + "Souscription", assistance.getDateSouscription())
                    .put(prefix + "Date d'effet", assistance.getDateEffet())
                    .put(prefix + "Date d'echeance", assistance.getDateEcheance())
                    .put(prefix + "Prime nette", assistance.getPrimeNette())
                    .put(prefix + "Montant TTC", assistance.getPrimeTotale())
                    .put(prefix + "Libelle du releve", assistance.getLibelleReleve());
        }
        return values.snapshot();
    }

    public static void valuesFromQuittance(ActivityValues values,
            com.assurance.dto.response.QuittanceResponse quittance, String prefix) {
        if (quittance == null) return;
        values.put(prefix + "Date d'effet", quittance.getDateDebut())
                .put(prefix + "Date d'echeance", quittance.getDateFin())
                .put(prefix + "Prime nette", quittance.getPrimeNette())
                .put(prefix + "Taxes", quittance.getTaxe())
                .put(prefix + "TPF", quittance.getTaxeParafiscale())
                .put(prefix + "Accessoires", quittance.getAccessoire())
                .put(prefix + "CNPAC", quittance.getCnpac())
                .put(prefix + "Montant TTC", quittance.getPrimeTotale());
        for (var line : items(quittance.getLignes())) {
            if (Boolean.TRUE.equals(line.getGlobale()) || "TOTAL".equals(line.getCategorie())) continue;
            String category = "CORPOREL".equals(line.getCategorie()) ? "Corporel"
                    : "AUTOMOBILE".equals(line.getCategorie()) ? "Automobile" : line.getCategorie();
            values.put(prefix + category + " - Prime nette", line.getPrimeNette())
                    .put(prefix + category + " - Taxes", line.getTaxe())
                    .put(prefix + category + " - TPF", line.getTaxeParafiscale())
                    .put(prefix + category + " - Accessoires", line.getAccessoire())
                    .put(prefix + category + " - CNPAC", line.getCnpac())
                    .put(prefix + category + " - Montant TTC", line.getPrimeTotale());
        }
    }

    public static String paymentMode(String mode) {
        if (mode == null) return null;
        return switch (mode.toLowerCase(java.util.Locale.ROOT)) {
            case "bureau" -> "Reglement au bureau";
            case "facture" -> "Reglement sur facture";
            default -> mode;
        };
    }

    private static String contractStatus(StatutContrat status) {
        return status == null ? null : switch (status) {
            case DRAFT -> "Brouillon";
            case ACTIVE -> "Actif";
            case SUSPENDED -> "Suspendu";
            case CANCELLED -> "Annule";
            case EXPIRED -> "Expire";
            case RENEWED -> "Renouvele";
        };
    }

    private static String label(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static void addReference(List<ActivityReference> references, ActivityRecordType type, Long id, String value, String fallback) {
        if (id != null) references.add(ActivityReference.of(type, id, label(value, fallback)));
    }

    private static <T> List<T> items(List<T> values) {
        return values == null ? List.of() : values;
    }
}
