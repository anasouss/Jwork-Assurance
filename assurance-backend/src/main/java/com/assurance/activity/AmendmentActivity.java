package com.assurance.activity;

import com.assurance.dto.request.AvenantRequest;
import com.assurance.entity.AvenantDraft;
import com.assurance.entity.Contrat;
import com.assurance.repository.CarrosserieRepository;
import com.assurance.repository.CategorieTransportRepository;
import com.assurance.repository.CompagnieAssistanceRepository;
import com.assurance.repository.GarantieRepository;
import com.assurance.repository.FormuleGarantiePersonneRepository;
import com.assurance.repository.MarqueRepository;
import com.assurance.repository.ProduitAssistanceRepository;
import com.assurance.repository.UsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class AmendmentActivity {
    private final GarantieRepository garantieRepository;
    private final UsageRepository usageRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final CategorieTransportRepository categorieTransportRepository;
    private final CompagnieAssistanceRepository compagnieAssistanceRepository;
    private final ProduitAssistanceRepository produitAssistanceRepository;
    private final FormuleGarantiePersonneRepository formuleGarantiePersonneRepository;

    public ActivityCommand draftCommand(AvenantDraft draft, Map<String, String> before,
            Map<String, String> after, ActivityAction action, String title, String origin,
            AvenantRequest request) {
        return new ActivityCommand(draft.getAgence().getId(), ActivityModule.PRODUCTION, action,
                title, origin, ActivityReference.of(ActivityRecordType.AVENANT_BROUILLON, draft.getId(),
                draft.getTypeMouvement().getLibelle() + " - " + ContractActivity.reference(draft.getContrat()).label()),
                references(draft.getContrat(), request), ActivityValues.changes(before, after));
    }

    public List<ActivityReference> references(Contrat contract, AvenantRequest request) {
        List<ActivityReference> references = new ArrayList<>();
        references.add(ContractActivity.reference(contract));
        for (var vehicle : items(contract.getVehicules())) {
            if (items(request.getVehiculeIds()).contains(vehicle.getId())
                    || request.getVehicules() == null && items(request.getGaranties()).stream().anyMatch(g -> g.getVehiculeIndex() != null)) {
                references.add(ActivityReference.of(ActivityRecordType.VEHICULE, vehicle.getId(),
                        text(vehicle.getImmatriculation(), "Véhicule du contrat")));
            }
        }
        for (var trailer : items(contract.getRemorques())) {
            if (items(request.getRemorqueIds()).contains(trailer.getId())
                    || request.getRemorques() == null && items(request.getGaranties()).stream().anyMatch(g -> g.getRemorqueIndex() != null)) {
                references.add(ActivityReference.of(ActivityRecordType.REMORQUE, trailer.getId(),
                        text(trailer.getImmatriculation(), "Remorque du contrat")));
            }
        }
        for (var guarantee : items(request.getGaranties())) {
            if (guarantee.getGarantieId() != null) garantieRepository.findById(guarantee.getGarantieId())
                    .filter(g -> contract.getBrancheAssurance() != null && g.getBrancheAssurance() != null
                            && Objects.equals(contract.getBrancheAssurance().getId(), g.getBrancheAssurance().getId()))
                    .ifPresent(g -> references.add(ActivityReference.of(ActivityRecordType.GARANTIE, g.getId(), g.getLibelle())));
        }
        return references.stream().distinct().toList();
    }

    public Map<String, String> snapshot(AvenantRequest request, Contrat contract) {
        if (request == null) return Map.of();
        ActivityValues values = new ActivityValues()
                .put("Date d'effet", request.getDateEffet())
                .put("Date d'échéance", request.getDateEcheance())
                .put("Numéro du mouvement", request.getNumeroMouvement())
                .put("Notes", request.getNotes())
                .put("Libellé du relevé", request.getLibelleReleve())
                .put("Saisie avec primes", request.getSaisiePrimeNette())
                .put("Mode de règlement", request.getModeReglement() == null ? null
                        : ContractActivity.paymentMode(request.getModeReglement().name()))
                .put("Véhicules sélectionnés", items(request.getVehiculeIds()).stream().map(id -> vehicle(contract, id))
                        .sorted().collect(Collectors.joining(", ")))
                .put("Remorques sélectionnées", items(request.getRemorqueIds()).stream().map(id -> trailer(contract, id))
                        .sorted().collect(Collectors.joining(", ")));
        int index = 0;
        for (var vehicle : items(request.getVehicules())) {
            String prefix = "Véhicule " + (++index) + " - ";
            values.put(prefix + "Immatriculation", vehicle.getImmatriculation())
                    .put(prefix + "Immatriculation provisoire", vehicle.getImmatriculationProvisoire())
                    .put(prefix + "Usage", resolve(vehicle.getUsageId(), id -> usageRepository.findById(id).map(u -> u.getLibelle()).orElse(null)))
                    .put(prefix + "Marque", resolve(vehicle.getMarqueId(), id -> marqueRepository.findById(id).map(m -> m.getLibelle()).orElse(null), vehicle.getMarqueLibelle()))
                    .put(prefix + "Carrosserie", resolve(vehicle.getCarrosserieId(), id -> carrosserieRepository.findById(id).map(c -> c.getLibelle()).orElse(null), vehicle.getCarrosserieLibelle()))
                    .put(prefix + "Catégorie de transport", resolve(vehicle.getCategorieTransportId(), id -> categorieTransportRepository.findById(id).map(c -> c.getLibelle()).orElse(null)))
                    .put(prefix + "Type", vehicle.getTypeVehicule() == null ? null : vehicle.getTypeVehicule().name())
                    .put(prefix + "Carburant", vehicle.getCarburant())
                    .put(prefix + "Puissance fiscale", vehicle.getPuissanceFiscale())
                    .put(prefix + "Cylindrée", vehicle.getCylindree())
                    .put(prefix + "Places", vehicle.getNombrePlaces())
                    .put(prefix + "Sous-classe", vehicle.getSousClasse())
                    .put(prefix + "PTC", vehicle.getPtc())
                    .put(prefix + "Mise en circulation", vehicle.getDatePremiereCirculation())
                    .put(prefix + "Validité carte grise", vehicle.getDateExpirationCarteGrise())
                    .put(prefix + "Date d'effet", vehicle.getDateEffet())
                    .put(prefix + "Date d'échéance", vehicle.getDateEcheance())
                    .put(prefix + "CRM", vehicle.getCrm())
                    .put(prefix + "Attestation", vehicle.getNumeroAttestation())
                    .put(prefix + "Remorque attachée", vehicle.getRemorque())
                    .put(prefix + "Numéro remorque", vehicle.getNumeroRemorque())
                    .put(prefix + "Marque remorque", resolve(vehicle.getMarqueRemorqueId(), id -> marqueRepository.findById(id).map(m -> m.getLibelle()).orElse(null), vehicle.getMarqueRemorqueLibelle()))
                    .put(prefix + "Coefficient prorata", vehicle.getCoefficientProrata())
                    .put(prefix + "Valeur vénale", vehicle.getValeurVenale())
                    .put(prefix + "Valeur à neuf", vehicle.getValeurNeuf())
                    .put(prefix + "Valeur glace", vehicle.getValeurGlace())
                    .put(prefix + "Crédit", vehicle.getOrganismeCredit())
                    .put(prefix + "Organisme de crédit", vehicle.getNomOrganismeCredit())
                    .put(prefix + "Montant du crédit", vehicle.getMontantCredit())
                    .put(prefix + "Fin du crédit", vehicle.getDateFinCredit());
        }
        index = 0;
        for (var trailer : items(request.getRemorques())) {
            String prefix = "Remorque " + (++index) + " - ";
            values.put(prefix + "Immatriculation", trailer.getImmatriculation())
                    .put(prefix + "Usage", resolve(trailer.getUsageId(), id -> usageRepository.findById(id).map(u -> u.getLibelle()).orElse(null)))
                    .put(prefix + "Marque", resolve(trailer.getMarqueId(), id -> marqueRepository.findById(id).map(m -> m.getLibelle()).orElse(null), trailer.getMarqueLibelle()))
                    .put(prefix + "PTC", trailer.getPtc())
                    .put(prefix + "Mise en circulation", trailer.getDateMiseEnCirculation())
                    .put(prefix + "Date d'effet", trailer.getDateEffet())
                    .put(prefix + "Date d'échéance", trailer.getDateEcheance())
                    .put(prefix + "CRM", trailer.getCrm())
                    .put(prefix + "Attestation", trailer.getNumeroAttestation())
                    .put(prefix + "Coefficient prorata", trailer.getCoefficientProrata())
                    .put(prefix + "Valeur assurée", trailer.getValeurAssuree());
        }
        index = 0;
        for (var guarantee : items(request.getGaranties())) {
            String name = resolve(guarantee.getGarantieId(), id -> garantieRepository.findById(id)
                    .map(g -> g.getCode() + " - " + g.getLibelle()).orElse(null));
            String person = guarantee.getClientId() == null ? null : items(contract.getClients()).stream()
                    .map(link -> link.getClient()).filter(client -> Objects.equals(client.getId(), guarantee.getClientId()))
                    .map(client -> client.getCodeClient() + " - " + client.getNomAffichage()).findFirst().orElse("Personne à vérifier");
            String target = guarantee.getVehiculeIndex() != null ? "véhicule " + (guarantee.getVehiculeIndex() + 1)
                    : guarantee.getRemorqueIndex() != null ? "remorque " + (guarantee.getRemorqueIndex() + 1)
                    : person == null ? "contrat" : person;
            // Ordinal is only a fallback for incomplete/duplicate draft selections.
            String prefix = text(name, "Garantie " + (++index)) + " (" + target + ") - ";
            values.put(prefix + "Sélection", name)
                    .put(prefix + "Personne assurée", person)
                    .put(prefix + "Mode de tarification", guaranteeMode(guarantee.getModeSelectionne()))
                    .put(prefix + "Base assurée", valueSource(guarantee.getSourceValeurSelectionnee()))
                    .put(prefix + "Formule", resolve(guarantee.getFormuleGarantiePersonneId(),
                            id -> formuleGarantiePersonneRepository.findById(id).map(f -> f.getFormule()).orElse(null), guarantee.getFormule()))
                    .put(prefix + "Capital", guarantee.getCapital())
                    .put(prefix + "Valeur assurée", guarantee.getValeurAssuree())
                    .put(prefix + "Valeur vénale", guarantee.getValeurVenale())
                    .put(prefix + "Valeur à neuf", guarantee.getValeurNeuf())
                    .put(prefix + "Valeur glace", guarantee.getValeurGlace())
                    .put(prefix + "Taux", guarantee.getTaux())
                    .put(prefix + "Prime", guarantee.getPrime())
                    .put(prefix + "Franchise", guarantee.getTauxFranchise())
                    .put(prefix + "Franchise minimale", guarantee.getFranchiseMinimale())
                    .put(prefix + "Décès", guarantee.getMontantDeces())
                    .put(prefix + "Invalidité", guarantee.getMontantInvalidite())
                    .put(prefix + "Frais médicaux", guarantee.getMontantFraisMedicaux())
                    .put(prefix + "Hospitalisation", guarantee.getMontantFraisHospitalisation())
                    .put(prefix + "Frais funéraires", guarantee.getMontantFraisFuneraires())
                    .put(prefix + "Chirurgie", guarantee.getMontantFraisChirurgie())
                    .put(prefix + "Accessoires", guarantee.getAccessoire());
        }
        for (var precision : items(request.getPrecisions())) {
            String prefix = "Précision " + target(contract, precision.getVehiculeId(), precision.getRemorqueId()) + " - ";
            values.put(prefix + "Immatriculation", precision.getImmatriculation())
                    .put(prefix + "Immatriculation provisoire", precision.getImmatriculationProvisoire())
                    .put(prefix + "Attestation", precision.getNumeroAttestation());
        }
        for (var attestation : items(request.getAttestations())) {
            values.put("Attestation " + target(contract, attestation.getVehiculeId(), attestation.getRemorqueId()),
                    attestation.getNumeroAttestation());
        }
        index = 0;
        for (var assistance : items(request.getAssistances())) {
            String prefix = "Assistance véhicule " + (assistance.getVehiculeIndex() == null ? ++index : assistance.getVehiculeIndex() + 1) + " - ";
            values.put(prefix + "Activée", assistance.getEnabled())
                    .put(prefix + "Compagnie", resolve(assistance.getCompagnieAssistanceId(), id -> compagnieAssistanceRepository.findById(id).map(c -> c.getNom()).orElse(null)))
                    .put(prefix + "Produit", resolve(assistance.getProduitAssistanceId(), id -> produitAssistanceRepository.findById(id).map(p -> p.getLibelle()).orElse(null)))
                    .put(prefix + "Souscription", assistance.getDateSouscription())
                    .put(prefix + "Date d'effet", assistance.getDateEffet())
                    .put(prefix + "Échéance", assistance.getEcheanceCode())
                    .put(prefix + "Référence", assistance.getNumeroContratOuQuittance())
                    .put(prefix + "Type de quittance", assistance.getTypeQuittance())
                    .put(prefix + "Libellé du relevé", assistance.getLibelleReleve());
        }
        for (var line : items(request.getQuittances())) {
            String prefix = "Quittance " + (line.getCategorie() == null ? "" : line.getCategorie().name()) + " - ";
            values.put(prefix + "Prime nette", line.getPrimeNette())
                    .put(prefix + "Taxes", line.getTaxe())
                    .put(prefix + "TPF", line.getTaxeParafiscale())
                    .put(prefix + "Accessoires", line.getAccessoire())
                    .put(prefix + "CNPAC", line.getCnpac());
        }
        return values.snapshot();
    }

    public static String guaranteeMode(String value) {
        if (value == null) return null;
        return switch (value) {
            case "TAUX" -> "Taux";
            case "CAPITAL" -> "Capital";
            case "PROTECTION" -> "Protection";
            case "FORFAIT" -> "Forfait";
            default -> value;
        };
    }

    public static String valueSource(String value) {
        if (value == null) return null;
        return switch (value) {
            case "AUCUNE" -> "Sans base véhicule";
            case "VENALE" -> "Valeur vénale";
            case "NEUF" -> "Valeur à neuf";
            case "GLACE" -> "Valeur glace";
            case "MANUEL" -> "Valeur saisie";
            default -> value;
        };
    }

    private static String target(Contrat contract, Long vehicleId, Long trailerId) {
        return vehicleId != null ? vehicle(contract, vehicleId) : trailer(contract, trailerId);
    }

    private static String vehicle(Contrat contract, Long id) {
        return items(contract.getVehicules()).stream().filter(v -> Objects.equals(v.getId(), id))
                .map(v -> text(v.getImmatriculation(), "Véhicule du contrat")).findFirst().orElse("Véhicule à vérifier");
    }

    private static String trailer(Contrat contract, Long id) {
        return items(contract.getRemorques()).stream().filter(r -> Objects.equals(r.getId(), id))
                .map(r -> text(r.getImmatriculation(), "Remorque du contrat")).findFirst().orElse("Remorque à vérifier");
    }

    private static String resolve(Long id, Function<Long, String> resolver) {
        return resolve(id, resolver, null);
    }

    private static String resolve(Long id, Function<Long, String> resolver, String fallback) {
        return id == null ? fallback : text(resolver.apply(id), fallback);
    }

    private static String text(String value, String fallback) {
        return value == null || value.isBlank() ? fallback : value;
    }

    private static <T> List<T> items(List<T> values) {
        return values == null ? List.of() : values;
    }
}
