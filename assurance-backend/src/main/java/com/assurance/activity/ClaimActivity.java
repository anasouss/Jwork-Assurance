package com.assurance.activity;

import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.dto.response.SinistreIntervenantResponse;
import com.assurance.entity.Sinistre;
import com.assurance.enums.StatutSinistre;

import java.util.ArrayList;
import java.util.Collections;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;

public final class ClaimActivity {
    private ClaimActivity() {
    }

    private record Part(String label, Map<String, String> values) {
    }

    public record Snapshot(Map<String, Part> parts, List<ActivityReference> references) {
        public Snapshot {
            parts = Collections.unmodifiableMap(new LinkedHashMap<>(parts));
            references = List.copyOf(references);
        }
    }

    public static Snapshot snapshot(SinistreDetailResponse claim) {
        Map<String, Part> parts = new LinkedHashMap<>();
        List<ActivityReference> references = new ArrayList<>();
        part(parts, "header", "", new ActivityValues().put("Numéro de sinistre", claim.getNumeroSinistre())
                .put("Référence compagnie", claim.getReferenceCompagnie()).put("Statut", label(claim.getStatut()))
                .put("Étape de suivi", label(claim.getEtapeSuivi())).put("Type de dommage", label(claim.getTypeDommage()))
                .put("Mode de réparation", label(claim.getModeReparation())).put("Garage de réparation", claim.getGarage())
                .put("Date du sinistre", claim.getDateSinistre())
                .put("Date de déclaration", claim.getDateDeclaration()).put("Transmission", claim.getDateTransmission()).put("Clôture", claim.getDateCloture())
                .put("Responsabilité (%)", claim.getTauxResponsabilite()).put("Notes", claim.getNotes())
                .put("Gestionnaire", claim.getGestionnaire()).put("Prochaine action", claim.getProchaineAction()).put("Échéance de l'action", claim.getDateEcheanceAction()));
        add(references, ActivityRecordType.UTILISATEUR, claim.getGestionnaireId(), claim.getGestionnaire());
        var coverage = claim.getCouverture();
        if (coverage != null) {
            part(parts, "coverage", "Couverture", new ActivityValues().put("Dossier", coverage.getNumeroDossier()).put("Police", coverage.getNumeroPolice())
                    .put("Mouvement", coverage.getNumeroMouvement()).put("Branche", coverage.getBrancheLibelle()).put("Compagnie", coverage.getCompagnie())
                    .put("Assuré", coverage.getAssure()).put("Code client", coverage.getClientCode()).put("Date d'effet", coverage.getDateEffet())
                    .put("Date d'échéance", coverage.getDateEcheance()).put("Immatriculation", coverage.getImmatriculation())
                    .put("Attestation", coverage.getNumeroAttestation()).put("Marque", coverage.getMarque()).put("Usage", coverage.getUsageLibelle()));
            add(references, ActivityRecordType.CONTRAT, coverage.getContratId(), coverage.getNumeroDossier());
            add(references, ActivityRecordType.MOUVEMENT_CONTRAT, coverage.getMouvementId(), "Mouvement " + coverage.getNumeroMouvement());
            add(references, ActivityRecordType.VEHICULE, coverage.getVehiculeId(), coverage.getImmatriculation());
        }
        var totals = claim.getTotaux();
        if (totals != null) part(parts, "totals", "Situation financière", new ActivityValues()
                .put("Provision courante", totals.getProvisionCourante()).put("Montant indemnisable", totals.getTotalIndemnisable())
                .put("Règlements", totals.getTotalRegle()).put("Frais", totals.getTotalFrais()).put("Recours", totals.getTotalRecours())
                .put("Reste à régler", totals.getResteARegler()));
        for (var guarantee : items(claim.getGaranties())) {
            part(parts, "guarantee:" + guarantee.getId(), "Garantie " + guarantee.getCode(), new ActivityValues()
                    .put("Libellé", guarantee.getLibelle()).put("Impliquée", guarantee.isImpliquee()).put("Capital", guarantee.getCapital())
                    .put("Prime", guarantee.getPrime()).put("Taux", guarantee.getTaux()).put("Franchise (%)", guarantee.getTauxFranchise())
                    .put("Franchise minimale", guarantee.getFranchiseMinimale()).put("Décision de couverture", label(guarantee.getDecisionCouverture()))
                    .put("Franchise appliquée", guarantee.getFranchiseAppliquee()).put("Montant indemnisable", guarantee.getMontantIndemnisable()));
            add(references, ActivityRecordType.GARANTIE_SINISTRE, guarantee.getId(), guarantee.getLibelle());
            add(references, ActivityRecordType.GARANTIE, guarantee.getGarantieId(), guarantee.getLibelle());
        }
        int index = 0;
        for (var party : items(claim.getParties())) {
            part(parts, "party:" + party.getId(), "Partie " + (++index) + " - " + party.getNom(), new ActivityValues()
                    .put("Qualité", label(party.getType())).put("Nom", party.getNom()).put("Téléphone", party.getTelephone()).put("CIN", party.getCin())
                    .put("Permis", party.getNumeroPermis()).put("Immatriculation", party.getImmatriculation()).put("Compagnie adverse", party.getCompagnieAdverse())
                    .put("Police adverse", party.getNumeroPoliceAdverse()).put("Notes", party.getNotes()));
            add(references, ActivityRecordType.PARTIE_SINISTRE, party.getId(), party.getNom());
        }
        index = 0;
        for (var mission : items(claim.getMissionsExpertise())) {
            part(parts, "mission:" + mission.getId(), "Mission " + (++index), new ActivityValues().put("Référence", mission.getReferenceMission())
                    .put("Phase", label(mission.getPhase()))
                    .put("Expert", mission.getExpert()).put("Garage", mission.getGarage()).put("Date de mission", mission.getDateMission())
                    .put("Date du rapport", mission.getDateRapport()).put("Estimation", mission.getMontantEstime()).put("Montant accepté", mission.getMontantAccepte())
                    .put("Statut", label(mission.getStatut())).put("Notes", mission.getNotes()));
            add(references, ActivityRecordType.MISSION_EXPERTISE, mission.getId(), mission.getReferenceMission() == null
                    ? "Mission d'expertise - " + mission.getExpert() : mission.getReferenceMission());
            add(references, ActivityRecordType.EXPERT_SINISTRE, mission.getExpertId(), mission.getExpert());
            add(references, ActivityRecordType.GARAGE_SINISTRE, mission.getGarageId(), mission.getGarage());
        }
        index = 0;
        for (var provision : items(claim.getProvisions())) {
            part(parts, "provision:" + provision.getId(), "Provision " + (++index), new ActivityValues()
                    .put("Date", provision.getDateProvision()).put("Montant", provision.getMontant()).put("Motif", provision.getMotif()));
            add(references, ActivityRecordType.PROVISION_SINISTRE, provision.getId(), "Provision du " + date(provision.getDateProvision()));
        }
        index = 0;
        for (var operation : items(claim.getOperations())) {
            part(parts, "operation:" + operation.getId(), "Opération " + (++index), new ActivityValues().put("Type", label(operation.getType()))
                    .put("Date", operation.getDateOperation()).put("Montant", operation.getMontant()).put("Référence", operation.getReference())
                    .put("Compagnie", operation.getCompagnieAssurance()).put("Qualité de la contrepartie", label(operation.getTypeContrepartie()))
                    .put("Contrepartie", operation.getContrepartie()).put("Justification de contrepartie libre", operation.getJustificationContrepartieLibre())
                    .put("Mode de règlement", label(operation.getModeReglement())).put("Circuit financier", label(operation.getCircuitFinancier()))
                    .put("Compte de trésorerie", operation.getCompteTresorerie()).put("Opération de trésorerie", operation.getNumeroOperationTresorerie())
                    .put("Notes", operation.getNotes()));
            add(references, ActivityRecordType.OPERATION_SINISTRE, operation.getId(), label(operation.getType()) + " du " + date(operation.getDateOperation()));
            add(references, ActivityRecordType.OPERATION_SINISTRE, operation.getOperationAnnuleeId(), "Opération de sinistre annulée");
            add(references, ActivityRecordType.COMPAGNIE, operation.getCompagnieAssuranceId(), operation.getCompagnieAssurance());
            add(references, ActivityRecordType.COMPTE_TRESORERIE, operation.getCompteTresorerieId(), operation.getCompteTresorerie());
            add(references, ActivityRecordType.OPERATION_TRESORERIE, operation.getOperationTresorerieId(), operation.getNumeroOperationTresorerie());
            if (operation.getTypeContrepartie() != null) {
                var type = switch (operation.getTypeContrepartie()) {
                    case CLIENT -> ActivityRecordType.CLIENT;
                    case PARTIE -> ActivityRecordType.PARTIE_SINISTRE;
                    case EXPERT -> ActivityRecordType.EXPERT_SINISTRE;
                    case GARAGE -> ActivityRecordType.GARAGE_SINISTRE;
                    case AUTRE -> null;
                };
                if (type != null) add(references, type, operation.getContrepartieId(), operation.getContrepartie());
            }
        }
        index = 0;
        for (var document : items(claim.getDocuments())) {
            part(parts, "document:" + document.getId(), "Document " + (++index), new ActivityValues().put("Type", label(document.getType()))
                    .put("Statut", label(document.getStatut())).put("Fichier", filename(document.getNomFichier())).put("Date", document.getDateDocument())
                    .put("Référence", document.getReference()).put("Montant", document.getMontant()).put("Émetteur", document.getEmetteur())
                    .put("Garantie", document.getGarantie()).put("Mission", document.getMissionExpertise()).put("Garage", document.getGarage())
                    .put("Commentaire", document.getCommentaire()).put("Validation", document.getDateValidation()));
            add(references, ActivityRecordType.DOCUMENT_SINISTRE, document.getId(), filename(document.getNomFichier()));
            add(references, ActivityRecordType.GARANTIE_SINISTRE, document.getSinistreGarantieId(), document.getGarantie());
            add(references, ActivityRecordType.MISSION_EXPERTISE, document.getMissionExpertiseId(), document.getMissionExpertise());
            add(references, ActivityRecordType.GARAGE_SINISTRE, document.getGarageId(), document.getGarage());
        }
        return new Snapshot(parts, references.stream().distinct().toList());
    }

    public static ActivityCommand command(Sinistre claim, Snapshot before, SinistreDetailResponse after, ActivityAction action,
            String title, String origin) {
        Snapshot current = after == null ? new Snapshot(Map.of(), List.of()) : snapshot(after);
        List<ActivityChange> changes = new ArrayList<>();
        var previous = before == null ? new Snapshot(Map.of(), List.of()) : before;
        // Child identity aligns snapshots; a shifted display position is not a modification.
        var keys = new LinkedHashSet<>(previous.parts().keySet());
        keys.addAll(current.parts().keySet());
        for (String key : keys) {
            Part oldPart = previous.parts().get(key);
            Part newPart = current.parts().get(key);
            String prefix = (newPart == null ? oldPart : newPart).label();
            for (var change : ActivityValues.changes(oldPart == null ? Map.of() : oldPart.values(), newPart == null ? Map.of() : newPart.values())) {
                String name = prefix.isBlank() ? change.label() : prefix + " - " + change.label();
                changes.add(new ActivityChange(name.length() > 1000 ? name.substring(0, 997) + "..." : name, change.beforeValue(), change.afterValue()));
            }
        }
        List<ActivityReference> references = new ArrayList<>(previous.references());
        references.addAll(current.references());
        add(references, ActivityRecordType.CLIENT, claim.getClient().getId(), claim.getClient().getNomAffichage());
        add(references, ActivityRecordType.COMPAGNIE, claim.getCompagnieAssurance().getId(), claim.getCompagnieAssurance().getNom());
        return new ActivityCommand(claim.getAgence().getId(), ActivityModule.SINISTRES, action, title, origin,
                ActivityReference.of(ActivityRecordType.SINISTRE, claim.getId(), claim.getNumeroSinistre()), references.stream().distinct().toList(), changes);
    }

    public static String label(Enum<?> value) {
        if (value == null) return null;
        return switch (value.name()) {
            case "BROUILLON" -> "Brouillon";
            case "DECLARE" -> "Déclaré";
            case "DOSSIER_INCOMPLET" -> "Dossier incomplet";
            case "TRANSMIS_COMPAGNIE" -> "Transmis à la compagnie";
            case "EXPERTISE" -> "Expertise";
            case "EN_ATTENTE_REGLEMENT" -> "En attente de règlement";
            case "PARTIELLEMENT_REGLE" -> "Partiellement réglé";
            case "REGLE" -> "Réglé";
            case "CLOTURE" -> "Clôture";
            case "REJETE" -> "Rejeté";
            case "ANNULE" -> "Annulé";
            case "ROUVERT" -> "Rouvert";
            case "CORPOREL" -> "Corporel";
            case "AUTRE" -> "Autre";
            case "CONDUCTEUR" -> "Conducteur";
            case "ADVERSAIRE" -> "Adversaire";
            case "PASSAGER" -> "Passager";
            case "VICTIME" -> "Victime";
            case "BENEFICIAIRE" -> "Bénéficiaire";
            case "A_ETUDIER" -> "À étudier";
            case "ACCEPTEE" -> "Acceptée";
            case "PARTIELLE" -> "Partielle";
            case "REFUSEE" -> "Refusée";
            case "A_MANDATER" -> "À mandater";
            case "MANDATEE" -> "Mandatée";
            case "EN_COURS" -> "En cours";
            case "RAPPORT_RECU" -> "Rapport reçu";
            case "VALIDEE" -> "Validée";
            case "ANNULEE" -> "Annulée";
            case "DECLARATION" -> "Déclaration";
            case "CONSTAT" -> "Constat";
            case "PV_POLICE" -> "PV de police";
            case "CARTE_GRISE" -> "Carte grise";
            case "PERMIS" -> "Permis";
            case "PHOTO" -> "Photo";
            case "DEVIS" -> "Devis";
            case "RAPPORT_EXPERT" -> "Rapport d'expert";
            case "ACCORD" -> "Accord";
            case "FACTURE" -> "Facture";
            case "REGLEMENT" -> "Règlement";
            case "RECOURS" -> "Recours";
            case "RECU" -> "Reçu";
            case "VALIDE" -> "Validé";
            case "FRAIS" -> "Frais";
            case "ANNULATION" -> "Annulation";
            case "CLIENT" -> "Client";
            case "PARTIE" -> "Partie impliquée";
            case "EXPERT" -> "Expert";
            case "GARAGE" -> "Garage";
            case "VIREMENT" -> "Virement";
            case "CHEQUE" -> "Chèque";
            case "ESPECES" -> "Espèces";
            case "COMPENSATION" -> "Compensation";
            case "DIRECT_COMPAGNIE" -> "Direct compagnie";
            case "TRESORERIE_AGENCE" -> "Trésorerie de l'agence";
            default -> value.name();
        };
    }

    public static ActivityCommand withReason(ActivityCommand command, String reason) {
        if (command.changes().isEmpty() || reason == null || reason.isBlank()) return command;
        var changes = new ArrayList<>(command.changes());
        changes.add(new ActivityChange("Motif du changement", null, reason.trim()));
        return new ActivityCommand(command.agenceId(), command.module(), command.action(), command.title(), command.origin(),
                command.subject(), command.references(), changes);
    }

    public static ActivityCommand target(ActivityCommand command, Snapshot before, SinistreDetailResponse after,
            ActivityRecordType type, Long id) {
        if (type == null) return command;
        var oldReferences = before == null ? List.<ActivityReference>of() : before.references();
        var candidates = id == null ? snapshot(after).references() : command.references();
        ActivityReference subject = candidates.stream().filter(reference -> reference.type() == type)
                .filter(reference -> id != null ? reference.id().equals(id.toString())
                        : oldReferences.stream().noneMatch(old -> old.type() == type && old.id().equals(reference.id())))
                .findFirst().orElseThrow(() -> new IllegalStateException("Objet du sinistre introuvable pour l'activité"));
        var references = new ArrayList<>(command.references());
        references.add(command.subject());
        references.removeIf(reference -> reference.type() == type && reference.id().equals(subject.id()));
        return new ActivityCommand(command.agenceId(), command.module(), command.action(), command.title(), command.origin(),
                subject, references.stream().distinct().toList(), command.changes());
    }

    public static ActivityAction transitionAction(StatutSinistre status) {
        return switch (status) {
            case CLOTURE -> ActivityAction.CLOSED;
            case ANNULE -> ActivityAction.CANCELLED;
            case REJETE -> ActivityAction.REJECTED;
            case ROUVERT -> ActivityAction.OPENED;
            case TRANSMIS_COMPAGNIE -> ActivityAction.TRANSMITTED;
            case DECLARE -> ActivityAction.VALIDATED;
            default -> ActivityAction.UPDATED;
        };
    }

    private static void part(Map<String, Part> parts, String key, String label, ActivityValues values) {
        parts.put(key, new Part(label, values.snapshot()));
    }

    private static void add(List<ActivityReference> references, ActivityRecordType type, Long id, String label) {
        if (id != null) references.add(ActivityReference.of(type, id, label == null || label.isBlank() ? labelForType(type) : label));
    }

    private static String labelForType(ActivityRecordType type) {
        return switch (type) {
            case VEHICULE -> "Véhicule";
            case MISSION_EXPERTISE -> "Mission d'expertise";
            case DOCUMENT_SINISTRE -> "Document du sinistre";
            default -> "Référence du dossier";
        };
    }

    private static String filename(String value) {
        if (value == null || value.isBlank()) return null;
        try {
            var name = java.nio.file.Path.of(value.replace('\\', '/')).getFileName();
            return name == null ? null : name.toString();
        } catch (java.nio.file.InvalidPathException ignored) {
            return "Document";
        }
    }

    private static String date(java.time.LocalDate value) {
        return value == null ? "-" : value.format(java.time.format.DateTimeFormatter.ofPattern("dd/MM/yyyy"));
    }

    private static <T> List<T> items(List<T> items) {
        return items == null ? List.of() : items;
    }

    public static Map<String, String> intervenantSnapshot(SinistreIntervenantResponse person) {
        return new ActivityValues().put("Code", person.getCode()).put("Nom", person.getNom()).put("Téléphone", person.getTelephone())
                .put("E-mail", person.getEmail()).put("Adresse", person.getAdresse()).put("Ville", person.getVille())
                .put("Conventionné", person.isConventionne()).put("Actif", person.isActif()).snapshot();
    }

    public static ActivityCommand intervenantCommand(Long agencyId, SinistreIntervenantResponse person, Map<String, String> before,
            ActivityRecordType type, boolean created) {
        String title = type == ActivityRecordType.EXPERT_SINISTRE ? "Expert" : "Garage";
        return new ActivityCommand(agencyId, ActivityModule.SINISTRES, created ? ActivityAction.CREATED : ActivityAction.UPDATED,
                title + (created ? " créé" : " modifié"), "CLAIM_INTERVENANT_CONFIGURATION",
                ActivityReference.of(type, person.getId(), person.getCode() + " - " + person.getNom()), List.of(),
                ActivityValues.changes(before, intervenantSnapshot(person)));
    }
}
