package com.assurance.service;

import com.assurance.dto.response.QuittanceResponse;
import com.assurance.dto.response.RecalculHistoriqueFinancierResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementGarantie;
import com.assurance.entity.MouvementRemorque;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.Quittance;
import com.assurance.entity.Remorque;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Vehicule;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeImpactMouvement;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AffectationQuittanceCompagnieRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.LigneDocumentClientRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.MouvementGarantieRepository;
import com.assurance.repository.MouvementRemorqueRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.security.TenantContext;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.EnumSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.function.Function;

@Slf4j
@Service
@RequiredArgsConstructor
public class HistoriqueFinancierRecalculService {

    private static final Set<NatureSnapshotMouvement> AFTER_NATURES = EnumSet.of(
            NatureSnapshotMouvement.APRES,
            NatureSnapshotMouvement.AJOUT,
            NatureSnapshotMouvement.COURANT
    );

    private final ContratRepository contratRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final MouvementGarantieRepository mouvementGarantieRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final MouvementRemorqueRepository mouvementRemorqueRepository;
    private final QuittanceRepository quittanceRepository;
    private final AffectationQuittanceCompagnieRepository affectationRepository;
    private final LigneDocumentClientRepository ligneDocumentClientRepository;
    private final QuittanceCalculService quittanceCalculService;
    private final ElementFacturableCibleService elementFacturableCibleService;
    private final QuittanceProductionService quittanceProductionService;

    @Transactional(readOnly = true)
    public RecalculHistoriqueFinancierResponse preview(Long contratId) {
        Contrat contrat = resolveContrat(contratId, false);
        return buildPreview(contrat, false, false);
    }

    @Transactional
    public RecalculHistoriqueFinancierResponse appliquer(Long contratId) {
        Contrat contrat = resolveContrat(contratId, true);
        // Lock accounting rows as well as the contract so an allocation cannot race the final checks.
        quittanceRepository.findByContratIdForUpdate(contrat.getId());
        RecalculHistoriqueFinancierResponse preview = buildPreview(contrat, false, true);
        if (!preview.isApplicable()) {
            throw new BadRequestException(String.join(" ", preview.getBlocages()));
        }

        List<String> calculationErrors = new ArrayList<>();
        List<CalculationPlan> plans = calculatePlans(contrat, calculationErrors);
        if (!calculationErrors.isEmpty()) {
            throw new BadRequestException(String.join(" ", calculationErrors));
        }
        for (CalculationPlan plan : plans) {
            MouvementContrat mouvement = plan.mouvement();
            QuittanceCalculService.Resultat calcul = plan.calcul();
            mouvement.setPrimeNette(calcul.primeNette());
            mouvement.setTaxe(calcul.taxe());
            mouvement.setTaxeParafiscale(calcul.taxeParafiscale());
            mouvement.setAccessoire(calcul.accessoire());
            mouvement.setCnpac(calcul.cnpac());
            mouvement.setPrimeTotale(calcul.primeTotale());
            mouvementContratRepository.save(mouvement);
            quittanceProductionService.remplacerPourMouvement(
                    contrat,
                    mouvement,
                    mouvement.getTypeMouvement(),
                    calcul,
                    plan.garantiesPourCibles(),
                    plan.vehicules(),
                    plan.remorques(),
                    plan.targetSummaries()
            );
        }

        log.warn(
                "Historique financier recalcule: agenceId={}, contratId={}, utilisateurId={}, mouvements={}, ancienTotal={}, nouveauTotal={}",
                TenantContext.getCurrentAgence(), contrat.getId(), TenantContext.getCurrentUser(), plans.size(),
                preview.getAncienTotal(), preview.getNouveauTotal());
        return RecalculHistoriqueFinancierResponse.builder()
                .contratId(preview.getContratId())
                .numeroDossier(preview.getNumeroDossier())
                .applicable(true)
                .applique(true)
                .blocages(preview.getBlocages())
                .mouvements(preview.getMouvements())
                .ancienTotal(preview.getAncienTotal())
                .nouveauTotal(preview.getNouveauTotal())
                .ecartTotal(preview.getEcartTotal())
                .build();
    }

    private RecalculHistoriqueFinancierResponse buildPreview(
            Contrat contrat,
            boolean applique,
            boolean verifierBlocagesComptables
    ) {
        List<String> blocages = validateContract(contrat);
        List<CalculationPlan> plans = calculatePlans(contrat, blocages);
        if (verifierBlocagesComptables || !plans.isEmpty()) {
            validateAccountingUsage(plans, blocages);
        }

        List<RecalculHistoriqueFinancierResponse.Mouvement> mouvements = plans.stream()
                .map(this::toResponse)
                .toList();
        BigDecimal ancienTotal = scale(mouvements.stream()
                .map(item -> item.getAnciensMontants().getPrimeTotale())
                .reduce(BigDecimal.ZERO, BigDecimal::add));
        BigDecimal nouveauTotal = scale(mouvements.stream()
                .map(item -> item.getNouveauxMontants().getPrimeTotale())
                .reduce(BigDecimal.ZERO, BigDecimal::add));

        return RecalculHistoriqueFinancierResponse.builder()
                .contratId(contrat.getId())
                .numeroDossier(contrat.getNumeroDossier())
                .applicable(blocages.isEmpty())
                .applique(applique)
                .blocages(List.copyOf(blocages))
                .mouvements(mouvements)
                .ancienTotal(ancienTotal)
                .nouveauTotal(nouveauTotal)
                .ecartTotal(scale(nouveauTotal.subtract(ancienTotal)))
                .build();
    }

    private List<String> validateContract(Contrat contrat) {
        List<String> blocages = new ArrayList<>();
        if (contrat.getStatut() != StatutContrat.ACTIVE) {
            blocages.add("Le contrat doit être actif.");
        }
        if (Boolean.TRUE.equals(contrat.getBrouillon()) || Boolean.TRUE.equals(contrat.getProspection())) {
            blocages.add("Les brouillons et les prospections ne peuvent pas être recalculés.");
        }
        return blocages;
    }

    private void validateAccountingUsage(List<CalculationPlan> plans, List<String> blocages) {
        for (CalculationPlan plan : plans) {
            Quittance quittance = plan.quittance();
            String movementLabel = "Mouvement " + safe(plan.mouvement().getNumeroMouvement());
            if (Boolean.TRUE.equals(quittance.getPayee())) {
                blocages.add(movementLabel + " : la quittance est déjà payée.");
            }
            if (affectationRepository.existsByQuittanceId(quittance.getId())) {
                blocages.add(movementLabel + " : la quittance est déjà affectée à la compagnie.");
            }
            if (ligneDocumentClientRepository.countByMouvementContratId(plan.mouvement().getId()) > 0) {
                blocages.add(movementLabel + " : la quittance figure dans un document client.");
            }
        }
    }

    private List<CalculationPlan> calculatePlans(Contrat contrat, List<String> blocages) {
        List<MouvementContrat> mouvements = mouvementContratRepository
                .findByContratIdOrderByCreatedAtDesc(contrat.getId()).stream()
                .filter(mouvement -> mouvement.getStatut() == StatutMouvementContrat.VALIDE)
                .filter(mouvement -> mouvement.getTypeMouvement() != null
                        && Boolean.TRUE.equals(mouvement.getTypeMouvement().getGenereQuittance()))
                .sorted(Comparator.comparingInt(this::movementNumber)
                        .thenComparing(MouvementContrat::getDateEffet, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(MouvementContrat::getId))
                .toList();
        List<CalculationPlan> plans = new ArrayList<>();
        for (MouvementContrat mouvement : mouvements) {
            try {
                plans.add(calculatePlan(contrat, mouvement));
            } catch (RuntimeException exception) {
                blocages.add("Mouvement " + safe(mouvement.getNumeroMouvement()) + " : " + exception.getMessage());
            }
        }
        if (mouvements.isEmpty()) {
            blocages.add("Aucun mouvement financier validé n’a été trouvé.");
        }
        return plans;
    }

    private CalculationPlan calculatePlan(Contrat contrat, MouvementContrat mouvement) {
        if (mouvement.getDateEffet() == null) {
            throw new BadRequestException("la date d’effet est absente");
        }
        Quittance quittance = quittanceRepository
                .findFirstByMouvementContratIdOrderByCreatedAtAsc(mouvement.getId())
                .orElseThrow(() -> new BadRequestException("la quittance générale est absente"));
        if (!Boolean.TRUE.equals(quittance.getGlobale()) || Boolean.TRUE.equals(quittance.getAlternative())) {
            throw new BadRequestException("la quittance générale est incohérente");
        }
        if (quittance.getElementFacturable() == null) {
            throw new BadRequestException("l’élément facturable est absent");
        }

        List<MouvementGarantie> snapshots = mouvementGarantieRepository.findByMouvementContratId(mouvement.getId());
        SnapshotTargets beforeTargets = targets(mouvement, EnumSet.of(NatureSnapshotMouvement.AVANT));
        SnapshotTargets afterTargets = targets(mouvement, AFTER_NATURES);
        List<ContratGarantie> before = guarantees(contrat, snapshots, NatureSnapshotMouvement.AVANT, beforeTargets);
        List<ContratGarantie> after = guarantees(contrat, snapshots, AFTER_NATURES, afterTargets);
        List<ContratGarantie> differential = guarantees(
                contrat, snapshots, EnumSet.of(NatureSnapshotMouvement.DIFFERENTIEL), afterTargets);
        TypeMouvementContrat type = mouvement.getTypeMouvement();
        TypeImpactMouvement impact = type.getTypeImpact() == null ? TypeImpactMouvement.NORMAL : type.getTypeImpact();

        QuittanceCalculService.Resultat calcul;
        List<QuittanceResponse.TargetSummary> summaries;
        List<ContratGarantie> garantiesPourCibles;
        SnapshotTargets outputTargets;

        if (!before.isEmpty() && !after.isEmpty()) {
            QuittanceCalculService.Resultat avant = calculate(contrat, null, before, beforeTargets, mouvement);
            QuittanceCalculService.Resultat apres = calculate(contrat, null, after, afterTargets, mouvement);
            calcul = "CHV_M".equalsIgnoreCase(type.getCode())
                    ? quittanceCalculService.differenceChangementVehicule(apres, avant)
                    : quittanceCalculService.differenceGaranties(apres, avant);
            outputTargets = mergeTargets(beforeTargets, afterTargets);
            garantiesPourCibles = after;
            summaries = elementFacturableCibleService.calculerDifference(
                    contrat, before, after, outputTargets.vehicules(), outputTargets.remorques(), mouvement.getDateEffet());
        } else {
            garantiesPourCibles = !after.isEmpty() ? after : differential;
            outputTargets = afterTargets.hasTargets() ? afterTargets : targets(
                    mouvement, EnumSet.of(NatureSnapshotMouvement.DIFFERENTIEL, NatureSnapshotMouvement.RETRAIT));
            if (garantiesPourCibles.isEmpty()
                    && impact != TypeImpactMouvement.ZERO
                    && impact != TypeImpactMouvement.CNPAC_SEUL) {
                throw new BadRequestException("les snapshots de garanties nécessaires sont absents");
            }
            calcul = calculate(contrat, type, garantiesPourCibles, outputTargets, mouvement);
            if (impact == TypeImpactMouvement.ZERO) {
                summaries = List.of();
            } else if (impact == TypeImpactMouvement.CNPAC_SEUL) {
                summaries = singleTargetSummary(calcul, outputTargets);
            } else if (impact == TypeImpactMouvement.RETOUR_PRIME) {
                summaries = elementFacturableCibleService.calculerDifference(
                        contrat, garantiesPourCibles, List.of(), outputTargets.vehicules(),
                        outputTargets.remorques(), mouvement.getDateEffet());
            } else {
                summaries = elementFacturableCibleService.calculer(
                        contrat, garantiesPourCibles, outputTargets.vehicules(),
                        outputTargets.remorques(), mouvement.getDateEffet());
            }
        }
        summaries = reconcile(summaries, calcul);
        return new CalculationPlan(
                mouvement, quittance, calcul, garantiesPourCibles,
                outputTargets.persistedVehicules(), outputTargets.persistedRemorques(), summaries);
    }

    private QuittanceCalculService.Resultat calculate(
            Contrat contrat,
            TypeMouvementContrat type,
            List<ContratGarantie> garanties,
            SnapshotTargets targets,
            MouvementContrat mouvement
    ) {
        int fallback = Math.max(1, targets.vehicules().size() + targets.remorques().size());
        int units = quittanceCalculService.compterUnitesCnpac(garanties, fallback);
        return quittanceCalculService.calculer(contrat, type, garanties, units, mouvement.getDateEffet());
    }

    private SnapshotTargets targets(MouvementContrat mouvement, Set<NatureSnapshotMouvement> natures) {
        Map<Long, Vehicule> vehicules = new LinkedHashMap<>();
        Map<Long, Vehicule> persistedVehicules = new LinkedHashMap<>();
        List<MouvementVehicule> vehicleSnapshots = mouvementVehiculeRepository
                .findByMouvementContratId(mouvement.getId()).stream()
                .sorted(Comparator.comparing(MouvementVehicule::getId))
                .toList();
        for (MouvementVehicule snapshot : vehicleSnapshots) {
            if (!natures.contains(snapshot.getNature())) continue;
            Vehicule target = Vehicule.builder()
                    .contrat(mouvement.getContrat())
                    .typeVehicule(snapshot.getTypeVehicule())
                    .usage(snapshot.getUsage())
                    .marque(snapshot.getMarque())
                    .carrosserie(snapshot.getCarrosserie())
                    .categorieTransport(snapshot.getCategorieTransport())
                    .immatriculation(snapshot.getImmatriculation())
                    .immatriculationProvisoire(snapshot.getImmatriculationProvisoire())
                    .carburant(snapshot.getCarburant())
                    .puissanceFiscale(snapshot.getPuissanceFiscale())
                    .nombrePlaces(snapshot.getNombrePlaces())
                    .sousClasse(snapshot.getSousClasse())
                    .ptc(snapshot.getPtc())
                    .datePremiereCirculation(snapshot.getDatePremiereCirculation())
                    .dateExpirationCarteGrise(snapshot.getDateExpirationCarteGrise())
                    .dateEffet(snapshot.getDateEffet())
                    .dateEcheance(snapshot.getDateEcheance())
                    .crm(snapshot.getCrm())
                    .numeroAttestation(snapshot.getNumeroAttestation())
                    .coefficientProrata(snapshot.getCoefficientProrata())
                    .valeurVenale(snapshot.getValeurVenale())
                    .valeurNeuf(snapshot.getValeurNeuf())
                    .valeurGlace(snapshot.getValeurGlace())
                    .organismeCredit(snapshot.getOrganismeCredit())
                    .nomOrganismeCredit(snapshot.getNomOrganismeCredit())
                    .montantCredit(snapshot.getMontantCredit())
                    .dateFinCredit(snapshot.getDateFinCredit())
                    .build();
            Long key = snapshot.getVehicule() == null ? -snapshot.getId() : snapshot.getVehicule().getId();
            target.setId(key);
            vehicules.putIfAbsent(key, target);
            if (snapshot.getVehicule() != null) {
                persistedVehicules.putIfAbsent(key, snapshot.getVehicule());
            }
        }

        Map<Long, Remorque> remorques = new LinkedHashMap<>();
        Map<Long, Remorque> persistedRemorques = new LinkedHashMap<>();
        List<MouvementRemorque> trailerSnapshots = mouvementRemorqueRepository
                .findByMouvementContratId(mouvement.getId()).stream()
                .sorted(Comparator.comparing(MouvementRemorque::getId))
                .toList();
        for (MouvementRemorque snapshot : trailerSnapshots) {
            if (!natures.contains(snapshot.getNature())) continue;
            Remorque target = Remorque.builder()
                    .contrat(mouvement.getContrat())
                    .usage(snapshot.getUsage())
                    .marque(snapshot.getMarque())
                    .immatriculation(snapshot.getImmatriculation())
                    .ptc(snapshot.getPtc())
                    .dateMiseEnCirculation(snapshot.getDateMiseEnCirculation())
                    .dateEffet(snapshot.getDateEffet())
                    .dateEcheance(snapshot.getDateEcheance())
                    .crm(snapshot.getCrm())
                    .numeroAttestation(snapshot.getNumeroAttestation())
                    .coefficientProrata(snapshot.getCoefficientProrata())
                    .valeurAssuree(snapshot.getValeurAssuree())
                    .build();
            Long key = snapshot.getRemorque() == null ? -snapshot.getId() : snapshot.getRemorque().getId();
            target.setId(key);
            remorques.putIfAbsent(key, target);
            if (snapshot.getRemorque() != null) {
                persistedRemorques.putIfAbsent(key, snapshot.getRemorque());
            }
        }
        return new SnapshotTargets(vehicules, remorques, persistedVehicules, persistedRemorques);
    }

    private List<ContratGarantie> guarantees(
            Contrat contrat,
            List<MouvementGarantie> snapshots,
            NatureSnapshotMouvement nature,
            SnapshotTargets targets
    ) {
        return guarantees(contrat, snapshots, EnumSet.of(nature), targets);
    }

    private List<ContratGarantie> guarantees(
            Contrat contrat,
            List<MouvementGarantie> snapshots,
            Set<NatureSnapshotMouvement> natures,
            SnapshotTargets targets
    ) {
        return snapshots.stream()
                .filter(snapshot -> natures.contains(snapshot.getNature()))
                .map(snapshot -> ContratGarantie.builder()
                        .contrat(contrat)
                        .garantie(snapshot.getGarantie())
                        .vehicule(resolveTarget(snapshot.getVehicule(), targets.vehiculesById()))
                        .remorque(resolveTarget(snapshot.getRemorque(), targets.remorquesById()))
                        .client(snapshot.getClient())
                        .ligneGrilleTarifaire(snapshot.getLigneGrilleTarifaire())
                        .modeSelectionne(snapshot.getModeSelectionne())
                        .sourceValeurSelectionnee(snapshot.getSourceValeurSelectionnee())
                        .formuleGarantiePersonne(snapshot.getFormuleGarantiePersonne())
                        .actif(true)
                        .valeurVenale(snapshot.getValeurVenale())
                        .valeurNeuf(snapshot.getValeurNeuf())
                        .valeurGlace(snapshot.getValeurGlace())
                        .formule(snapshot.getFormule())
                        .montantDeces(snapshot.getMontantDeces())
                        .montantInvalidite(snapshot.getMontantInvalidite())
                        .montantFraisMedicaux(snapshot.getMontantFraisMedicaux())
                        .montantFraisHospitalisation(snapshot.getMontantFraisHospitalisation())
                        .montantFraisFuneraires(snapshot.getMontantFraisFuneraires())
                        .montantFraisChirurgie(snapshot.getMontantFraisChirurgie())
                        .accessoire(snapshot.getAccessoire())
                        .capital(snapshot.getCapital())
                        .taux(snapshot.getTaux())
                        .prime(snapshot.getPrime())
                        .tauxFranchise(snapshot.getTauxFranchise())
                        .franchiseMinimale(snapshot.getFranchiseMinimale())
                        .build())
                .toList();
    }

    private <T extends com.assurance.entity.BaseEntity> T resolveTarget(T source, Map<Long, T> targets) {
        return source == null ? null : targets.getOrDefault(source.getId(), source);
    }

    private SnapshotTargets mergeTargets(SnapshotTargets before, SnapshotTargets after) {
        Map<Long, Vehicule> vehicules = new LinkedHashMap<>(before.vehiculesById());
        vehicules.putAll(after.vehiculesById());
        Map<Long, Remorque> remorques = new LinkedHashMap<>(before.remorquesById());
        remorques.putAll(after.remorquesById());
        Map<Long, Vehicule> persistedVehicules = new LinkedHashMap<>(before.persistedVehiculesById());
        persistedVehicules.putAll(after.persistedVehiculesById());
        Map<Long, Remorque> persistedRemorques = new LinkedHashMap<>(before.persistedRemorquesById());
        persistedRemorques.putAll(after.persistedRemorquesById());
        return new SnapshotTargets(vehicules, remorques, persistedVehicules, persistedRemorques);
    }

    private List<QuittanceResponse.TargetSummary> singleTargetSummary(
            QuittanceCalculService.Resultat result,
            SnapshotTargets targets
    ) {
        if (!targets.hasTargets()) return List.of();
        boolean vehicle = !targets.vehicules().isEmpty();
        return List.of(QuittanceResponse.TargetSummary.builder()
                .kind(vehicle ? "VEHICULE" : "REMORQUE")
                .vehiculeIndex(vehicle ? 0 : null)
                .remorqueIndex(vehicle ? null : 0)
                .primeNette(result.primeNette())
                .primeNetteHorsEvcat(result.primeNette())
                .automobilePrimeNette(result.primeNette())
                .corporelPrimeNette(BigDecimal.ZERO)
                .evcatPrimeNette(BigDecimal.ZERO)
                .taxe(result.taxe())
                .taxeParafiscale(result.taxeParafiscale())
                .accessoire(result.accessoire())
                .cnpac(result.cnpac())
                .primeTotale(result.primeTotale())
                .build());
    }

    private List<QuittanceResponse.TargetSummary> reconcile(
            List<QuittanceResponse.TargetSummary> source,
            QuittanceCalculService.Resultat result
    ) {
        if (source == null || source.isEmpty()) return List.of();
        List<QuittanceResponse.TargetSummary> summaries = new ArrayList<>(source);
        QuittanceResponse.TargetSummary last = summaries.get(summaries.size() - 1);
        BigDecimal automobile = linePrime(result, CategorieQuittance.AUTOMOBILE);
        BigDecimal corporel = linePrime(result, CategorieQuittance.CORPOREL);
        BigDecimal evcat = linePrime(result, CategorieQuittance.EVCAT);
        last.setPrimeNette(adjustLast(summaries, QuittanceResponse.TargetSummary::getPrimeNette, result.primeNette()));
        last.setPrimeNetteHorsEvcat(adjustLast(summaries, QuittanceResponse.TargetSummary::getPrimeNetteHorsEvcat, automobile.add(corporel)));
        last.setAutomobilePrimeNette(adjustLast(summaries, QuittanceResponse.TargetSummary::getAutomobilePrimeNette, automobile));
        last.setCorporelPrimeNette(adjustLast(summaries, QuittanceResponse.TargetSummary::getCorporelPrimeNette, corporel));
        last.setEvcatPrimeNette(adjustLast(summaries, QuittanceResponse.TargetSummary::getEvcatPrimeNette, evcat));
        last.setTaxe(adjustLast(summaries, QuittanceResponse.TargetSummary::getTaxe, result.taxe()));
        last.setTaxeParafiscale(adjustLast(summaries, QuittanceResponse.TargetSummary::getTaxeParafiscale, result.taxeParafiscale()));
        last.setAccessoire(adjustLast(summaries, QuittanceResponse.TargetSummary::getAccessoire, result.accessoire()));
        last.setCnpac(adjustLast(summaries, QuittanceResponse.TargetSummary::getCnpac, result.cnpac()));
        last.setPrimeTotale(adjustLast(summaries, QuittanceResponse.TargetSummary::getPrimeTotale, result.primeTotale()));
        return summaries;
    }

    private BigDecimal adjustLast(
            List<QuittanceResponse.TargetSummary> summaries,
            Function<QuittanceResponse.TargetSummary, BigDecimal> getter,
            BigDecimal expected
    ) {
        BigDecimal preceding = summaries.stream()
                .limit(Math.max(0, summaries.size() - 1L))
                .map(getter)
                .map(this::zero)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
        return scale(zero(expected).subtract(preceding));
    }

    private BigDecimal linePrime(QuittanceCalculService.Resultat result, CategorieQuittance category) {
        return result.lignes().stream()
                .filter(line -> line.categorie() == category)
                .map(QuittanceCalculService.Ligne::primeNette)
                .findFirst()
                .orElse(BigDecimal.ZERO);
    }

    private RecalculHistoriqueFinancierResponse.Mouvement toResponse(CalculationPlan plan) {
        RecalculHistoriqueFinancierResponse.Montants oldAmounts = amounts(plan.mouvement());
        RecalculHistoriqueFinancierResponse.Montants newAmounts = amounts(plan.calcul());
        return RecalculHistoriqueFinancierResponse.Mouvement.builder()
                .mouvementId(plan.mouvement().getId())
                .numeroMouvement(plan.mouvement().getNumeroMouvement())
                .code(plan.mouvement().getTypeMouvement().getCode())
                .libelle(plan.mouvement().getTypeMouvement().getLibelle())
                .dateEffet(plan.mouvement().getDateEffet())
                .anciensMontants(oldAmounts)
                .nouveauxMontants(newAmounts)
                .modifie(!sameAmounts(oldAmounts, newAmounts))
                .build();
    }

    private RecalculHistoriqueFinancierResponse.Montants amounts(MouvementContrat movement) {
        return RecalculHistoriqueFinancierResponse.Montants.builder()
                .primeNette(scale(movement.getPrimeNette()))
                .taxe(scale(movement.getTaxe()))
                .taxeParafiscale(scale(movement.getTaxeParafiscale()))
                .accessoire(scale(movement.getAccessoire()))
                .cnpac(scale(movement.getCnpac()))
                .primeTotale(scale(movement.getPrimeTotale()))
                .build();
    }

    private RecalculHistoriqueFinancierResponse.Montants amounts(QuittanceCalculService.Resultat result) {
        return RecalculHistoriqueFinancierResponse.Montants.builder()
                .primeNette(scale(result.primeNette()))
                .taxe(scale(result.taxe()))
                .taxeParafiscale(scale(result.taxeParafiscale()))
                .accessoire(scale(result.accessoire()))
                .cnpac(scale(result.cnpac()))
                .primeTotale(scale(result.primeTotale()))
                .build();
    }

    private boolean sameAmounts(
            RecalculHistoriqueFinancierResponse.Montants left,
            RecalculHistoriqueFinancierResponse.Montants right
    ) {
        return left.getPrimeNette().compareTo(right.getPrimeNette()) == 0
                && left.getTaxe().compareTo(right.getTaxe()) == 0
                && left.getTaxeParafiscale().compareTo(right.getTaxeParafiscale()) == 0
                && left.getAccessoire().compareTo(right.getAccessoire()) == 0
                && left.getCnpac().compareTo(right.getCnpac()) == 0
                && left.getPrimeTotale().compareTo(right.getPrimeTotale()) == 0;
    }

    private Contrat resolveContrat(Long contratId, boolean lock) {
        Long agenceId = TenantContext.getCurrentAgence();
        if (agenceId == null) throw new BadRequestException("Agence courante introuvable");
        return (lock
                ? contratRepository.findByAgenceIdAndIdForUpdate(agenceId, contratId)
                : contratRepository.findByAgenceIdAndId(agenceId, contratId))
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
    }

    private int movementNumber(MouvementContrat movement) {
        try {
            return Integer.parseInt(safe(movement.getNumeroMouvement()));
        } catch (NumberFormatException ignored) {
            return Integer.MAX_VALUE;
        }
    }

    private String safe(String value) {
        return value == null ? "?" : value.trim();
    }

    private BigDecimal zero(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal scale(BigDecimal value) {
        return zero(value).setScale(2, RoundingMode.HALF_UP);
    }

    private record SnapshotTargets(
            Map<Long, Vehicule> vehiculesById,
            Map<Long, Remorque> remorquesById,
            Map<Long, Vehicule> persistedVehiculesById,
            Map<Long, Remorque> persistedRemorquesById
    ) {
        private List<Vehicule> vehicules() { return List.copyOf(vehiculesById.values()); }
        private List<Remorque> remorques() { return List.copyOf(remorquesById.values()); }
        private List<Vehicule> persistedVehicules() { return List.copyOf(persistedVehiculesById.values()); }
        private List<Remorque> persistedRemorques() { return List.copyOf(persistedRemorquesById.values()); }
        private boolean hasTargets() { return !vehiculesById.isEmpty() || !remorquesById.isEmpty(); }
    }

    private record CalculationPlan(
            MouvementContrat mouvement,
            Quittance quittance,
            QuittanceCalculService.Resultat calcul,
            List<ContratGarantie> garantiesPourCibles,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<QuittanceResponse.TargetSummary> targetSummaries
    ) {}
}
