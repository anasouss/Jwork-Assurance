package com.assurance.service;

import com.assurance.dto.request.UpsertAssistanceContratRequest;
import com.assurance.dto.response.AssistanceContratContextResponse;
import com.assurance.dto.response.AssistanceContratResponse;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.TypeContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.CompagnieAssistanceRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.ProduitAssistanceRepository;
import com.assurance.repository.SousClasseRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.Comparator;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class AssistanceContratService {

    private final ContratRepository contratRepository;
    private final VehiculeRepository vehiculeRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final CompagnieAssistanceRepository compagnieAssistanceRepository;
    private final ProduitAssistanceRepository produitAssistanceRepository;
    private final SousClasseRepository sousClasseRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final ElementFacturableRepository elementFacturableRepository;
    private final TarifProduitAssistanceService tarifProduitAssistanceService;
    private final EcheanceService echeanceService;

    @Transactional(readOnly = true)
    public AssistanceContratContextResponse getContext(Long agenceId, Long contratId, Long mouvementId, LocalDate dateSouscription) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        MouvementContrat mouvement = resolveMouvement(contrat, mouvementId);
        LocalDate referenceDate = firstNonNull(dateSouscription, mouvement != null ? mouvement.getDateEffet() : null, contrat.getDateEffet(), LocalDate.now());
        List<AssistanceContrat> activeAssistances = mouvement == null
                ? assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(contrat.getId())
                : assistanceContratRepository.findByMouvementContratIdAndActifTrueOrderByCreatedAtDesc(mouvement.getId());
        Set<Long> vehiculesAvecAssistance = activeAssistances.stream()
                .filter(assistance -> assistance.getVehicule() != null)
                .map(assistance -> assistance.getVehicule().getId())
                .collect(Collectors.toSet());
        List<Vehicule> vehiculesContexte = resolveVehiculesCibles(contrat, mouvement).stream()
                .filter(vehicule -> Boolean.TRUE.equals(vehicule.getActif()))
                .toList();
        List<Vehicule> vehiculesEligibles = vehiculesContexte.stream()
                .filter(vehicule -> !vehiculesAvecAssistance.contains(vehicule.getId()))
                .filter(vehicule -> assistanceAutorisee(contrat, vehicule))
                .toList();
        Long categorieClientId = resolveAssistanceCategorieClientId(contrat);
        Set<Long> usageIds = vehiculesContexte.stream()
                .map(Vehicule::getUsage)
                .filter(java.util.Objects::nonNull)
                .map(Usage::getId)
                .collect(Collectors.toSet());
        List<AssistanceContratContextResponse.ProduitAssistanceOption> produits = produitAssistanceRepository.findAll().stream()
                .filter(produit -> Boolean.TRUE.equals(produit.getActif()))
                .filter(produit -> produit.getCategorieClient() == null
                        || produit.getCategorieClient().getId().equals(categorieClientId))
                .filter(produit -> produit.getUsages() == null
                        || produit.getUsages().isEmpty()
                        || produit.getUsages().stream().anyMatch(usage -> usageIds.contains(usage.getId())))
                .map(produit -> toProduitOption(produit, referenceDate))
                .filter(produit -> produit.getTarifProduitAssistanceId() != null)
                .sorted(Comparator.comparing(
                        AssistanceContratContextResponse.ProduitAssistanceOption::getLibelle,
                        Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)
                ))
                .toList();
        return AssistanceContratContextResponse.builder()
                .contratId(contrat.getId())
                .numeroDossier(contrat.getNumeroDossier())
                .numeroPolice(contrat.getNumeroPolice())
                .typeContrat(contrat.getTypeContrat())
                .dateEffet(firstNonNull(mouvement != null ? mouvement.getDateEffet() : null, contrat.getDateEffet()))
                .dateEcheance(firstNonNull(mouvement != null ? mouvement.getDateEcheance() : null, contrat.getDateEcheance()))
                .echeanceCode(contrat.getEcheance())
                .mouvementContratId(mouvement != null ? mouvement.getId() : null)
                .mouvementCode(mouvement != null && mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getCode() : null)
                .mouvementLibelle(mouvement != null && mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getLibelle() : "Contrat")
                .categorieClientId(categorieClientId)
                .vehiculesEligibles(vehiculesEligibles.stream().map(this::toVehiculeOption).toList())
                .assistances(activeAssistances.stream().map(this::toResponse).toList())
                .compagnies(compagnieAssistanceRepository.findAll().stream()
                        .filter(compagnie -> Boolean.TRUE.equals(compagnie.getActif()))
                        .sorted(Comparator.comparing(CompagnieAssistance::getNom, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                        .map(compagnie -> AssistanceContratContextResponse.CompagnieAssistanceOption.builder()
                                .id(compagnie.getId())
                                .code(compagnie.getCode())
                                .libelle(compagnie.getNom())
                                .build())
                        .toList())
                .produits(produits)
                .build();
    }

    @Transactional
    public AssistanceContratResponse upsert(Long agenceId, Long contratId, UpsertAssistanceContratRequest request) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        Vehicule vehicule = vehiculeRepository.findById(request.getVehiculeId())
                .orElseThrow(() -> new ResourceNotFoundException("Vehicule", request.getVehiculeId()));
        if (vehicule.getContrat() == null || !vehicule.getContrat().getId().equals(contrat.getId())) {
            throw new BadRequestException("Le vehicule ne correspond pas au contrat");
        }
        MouvementContrat mouvement = resolveMouvement(contrat, request.getMouvementContratId());
        validateVehiculeCible(contrat, mouvement, vehicule);
        AssistancePricing pricing = resolvePricing(contrat, vehicule, request);

        AssistanceContrat assistance = assistanceContratRepository
                .findFirstByContratIdAndVehiculeIdAndActifTrueOrderByCreatedAtDesc(contrat.getId(), vehicule.getId())
                .orElse(null);
        if (assistance != null
                && mouvement != null
                && (assistance.getMouvementContrat() == null
                    || !mouvement.getId().equals(assistance.getMouvementContrat().getId()))) {
            assistance.setActif(false);
            if (assistance.getElementFacturable() != null) {
                assistance.getElementFacturable().setActif(false);
                elementFacturableRepository.save(assistance.getElementFacturable());
            }
            assistanceContratRepository.save(assistance);
            assistance = null;
        }
        if (assistance == null) {
            assistance = new AssistanceContrat();
        }
        assistance.setContrat(contrat);
        assistance.setMouvementContrat(mouvement);
        assistance.setVehicule(vehicule);
        assistance.setCompagnieAssuranceContrat(contrat.getCompagnieAssurance());
        assistance.setCompagnieAssistance(pricing.compagnie());
        assistance.setProduitAssistance(pricing.produit());
        assistance.setTarifProduitAssistance(pricing.tarif());
        assistance.setProduit(pricing.produit().getLibelle());
        assistance.setDateSouscription(pricing.dateSouscription());
        assistance.setDateEffet(pricing.dateEffet());
        assistance.setDateEcheance(pricing.dateEcheance());
        assistance.setEcheanceCode(pricing.echeanceCode());
        assistance.setDuree(pricing.trimestres());
        assistance.setUnite("TRIMESTRE");
        assistance.setNumeroDossier(contrat.getNumeroDossier());
        assistance.setNumeroPoliceContrat(contrat.getNumeroPolice());
        assistance.setNumeroContratOuQuittance(request.getNumeroContratOuQuittance());
        assistance.setTypeQuittance(request.getTypeQuittance());
        assistance.setPrimeNette(pricing.primeNette());
        assistance.setPrimeTotale(pricing.primeTotale());
        assistance.setActif(true);
        assistance = assistanceContratRepository.save(assistance);
        contrat.setAssistance(true);
        contratRepository.save(contrat);

        ElementFacturable element = assistance.getElementFacturable();
        if (element == null) {
            element = new ElementFacturable();
        }
        element.setAgence(contrat.getAgence());
        element.setContrat(contrat);
        element.setMouvementContrat(mouvement);
        element.setCompagnieAssurance(contrat.getCompagnieAssurance());
        element.setNature(NatureElementFacturable.ASSISTANCE);
        element.setStatut(StatutElementFacturable.A_QUITTANCER);
        element.setReferenceSource(String.valueOf(assistance.getId()));
        element.setLibelle("Assistance - " + pricing.produit().getLibelle());
        element.setDateDebut(pricing.dateEffet());
        element.setDateFin(pricing.dateEcheance());
        element.setPrimeNette(pricing.primeNette());
        element.setTaxe(pricing.primeTotale().subtract(pricing.primeNette()).max(BigDecimal.ZERO));
        element.setTaxeParafiscale(BigDecimal.ZERO);
        element.setAccessoire(BigDecimal.ZERO);
        element.setCnpac(BigDecimal.ZERO);
        element.setPrimeTotale(pricing.primeTotale());
        element.setActif(true);
        element = elementFacturableRepository.save(element);
        assistance.setElementFacturable(element);
        assistance = assistanceContratRepository.save(assistance);

        return toResponse(assistance, pricing.trimestres(), pricing.prorata());
    }

    @Transactional(readOnly = true)
    public AssistanceContratResponse preview(
            Contrat contrat,
            Vehicule vehicule,
            UpsertAssistanceContratRequest request
    ) {
        AssistancePricing pricing = resolvePricing(contrat, vehicule, request);
        return AssistanceContratResponse.builder()
                .contratId(contrat.getId())
                .vehiculeId(vehicule.getId())
                .vehiculeImmatriculation(vehicule.getImmatriculation())
                .compagnieAssistanceId(pricing.compagnie().getId())
                .compagnieAssistanceLibelle(pricing.compagnie().getNom())
                .produitAssistanceId(pricing.produit().getId())
                .tarifProduitAssistanceId(pricing.tarif() != null ? pricing.tarif().getId() : null)
                .produit(pricing.produit().getLibelle())
                .dateSouscription(pricing.dateSouscription())
                .dateEffet(pricing.dateEffet())
                .dateEcheance(pricing.dateEcheance())
                .echeanceCode(pricing.echeanceCode())
                .numeroContratOuQuittance(request.getNumeroContratOuQuittance())
                .trimestres(pricing.trimestres())
                .prorataRatio(pricing.prorata().setScale(2, RoundingMode.HALF_UP))
                .primeNette(pricing.primeNette())
                .primeTotale(pricing.primeTotale())
                .build();
    }

    private AssistancePricing resolvePricing(
            Contrat contrat,
            Vehicule vehicule,
            UpsertAssistanceContratRequest request
    ) {
        if (!assistanceAutorisee(contrat, vehicule)) {
            throw new BadRequestException("L'assistance n'est pas autorisée pour la sous-classe du véhicule");
        }
        if (request.getCompagnieAssistanceId() == null || request.getProduitAssistanceId() == null) {
            throw new BadRequestException("La compagnie et le produit d'assistance sont obligatoires");
        }
        CompagnieAssistance compagnie = compagnieAssistanceRepository.findById(request.getCompagnieAssistanceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssistance", request.getCompagnieAssistanceId()));
        ProduitAssistance produit = produitAssistanceRepository.findById(request.getProduitAssistanceId())
                .orElseThrow(() -> new ResourceNotFoundException("ProduitAssistance", request.getProduitAssistanceId()));
        if (!Boolean.TRUE.equals(compagnie.getActif()) || !Boolean.TRUE.equals(produit.getActif())) {
            throw new BadRequestException("La compagnie ou le produit d'assistance est inactif");
        }
        if (produit.getCompagnieAssistance() == null
                || !produit.getCompagnieAssistance().getId().equals(compagnie.getId())) {
            throw new BadRequestException("Le produit d'assistance ne correspond pas a la compagnie selectionnee");
        }
        if (produit.getUsages() != null && !produit.getUsages().isEmpty()
                && (vehicule.getUsage() == null
                || produit.getUsages().stream().noneMatch(usage -> usage.getId().equals(vehicule.getUsage().getId())))) {
            throw new BadRequestException("Produit d'assistance incompatible avec l'usage du vehicule");
        }
        Long categorieClientId = resolveAssistanceCategorieClientId(contrat);
        if (produit.getCategorieClient() != null
                && !produit.getCategorieClient().getId().equals(categorieClientId)) {
            throw new BadRequestException("Produit d'assistance incompatible avec la categorie client du contrat");
        }

        LocalDate dateSouscription = firstNonNull(
                request.getDateSouscription(),
                request.getDateEffet(),
                vehicule.getDateEffet(),
                contrat.getDateEffet(),
                LocalDate.now()
        );
        LocalDate dateEffet = firstNonNull(request.getDateEffet(), dateSouscription);
        String echeanceCode = echeanceService.normalizeCode(firstNonNull(request.getEcheanceCode(), contrat.getEcheance()));
        LocalDate dateEcheance = echeanceService.resolveDateEcheance(dateEffet, echeanceCode, contrat.getDateEcheance());
        int trimestres = resolveAssistanceQuarterCount(dateEffet, dateEcheance);
        BigDecimal prorata = BigDecimal.valueOf(trimestres).divide(BigDecimal.valueOf(4), 8, RoundingMode.HALF_UP);
        TarifProduitAssistance tarif = tarifProduitAssistanceService.resolveTarifForDate(produit, dateSouscription);
        if (tarif == null) {
            throw new BadRequestException("Aucun tarif d'assistance applicable a la date de souscription");
        }
        BigDecimal montantHt = tarif.getMontantHt();
        BigDecimal montantTtc = tarif.getMontantTtc();
        BigDecimal primeNette = montantHt.multiply(prorata).setScale(2, RoundingMode.HALF_UP);
        BigDecimal primeTotale = montantTtc.multiply(prorata).setScale(2, RoundingMode.HALF_UP);
        return new AssistancePricing(
                compagnie,
                produit,
                tarif,
                dateSouscription,
                dateEffet,
                dateEcheance,
                echeanceCode,
                trimestres,
                prorata,
                primeNette,
                primeTotale
        );
    }

    private boolean assistanceAutorisee(Contrat contrat, Vehicule vehicule) {
        if (contrat.getTypeContrat() != TypeContrat.CONVENTION
                || vehicule.getSousClasse() == null
                || vehicule.getSousClasse().isBlank()) {
            return true;
        }
        return sousClasseRepository.findByCodeIgnoreCase(vehicule.getSousClasse().trim())
                .filter(sousClasse -> !Boolean.FALSE.equals(sousClasse.getActif()))
                .map(sousClasse -> Boolean.TRUE.equals(sousClasse.getAssistanceAutorisee()))
                .orElse(false);
    }

    @Transactional
    public void deactivate(Long agenceId, Long contratId, Long assistanceId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        AssistanceContrat assistance = assistanceContratRepository.findById(assistanceId)
                .orElseThrow(() -> new ResourceNotFoundException("AssistanceContrat", assistanceId));
        if (assistance.getContrat() == null || !assistance.getContrat().getId().equals(contrat.getId())) {
            throw new BadRequestException("L'assistance ne correspond pas au contrat");
        }
        assistance.setActif(false);
        if (assistance.getElementFacturable() != null) {
            assistance.getElementFacturable().setActif(false);
            elementFacturableRepository.save(assistance.getElementFacturable());
        }
        assistanceContratRepository.save(assistance);
        contrat.setAssistance(assistanceContratRepository.countByContratIdAndActifTrue(contrat.getId()) > 0);
        contratRepository.save(contrat);
    }

    private AssistanceContratResponse toResponse(AssistanceContrat assistance) {
        int trimestres = assistance.getDuree() == null ? resolveAssistanceQuarterCount(assistance.getDateEffet(), assistance.getDateEcheance()) : assistance.getDuree();
        BigDecimal prorata = BigDecimal.valueOf(trimestres).divide(BigDecimal.valueOf(4), 8, RoundingMode.HALF_UP);
        return toResponse(assistance, trimestres, prorata);
    }

    private AssistanceContratResponse toResponse(AssistanceContrat assistance, int trimestres, BigDecimal prorata) {
        return AssistanceContratResponse.builder()
                .id(assistance.getId())
                .contratId(assistance.getContrat() != null ? assistance.getContrat().getId() : null)
                .mouvementContratId(assistance.getMouvementContrat() != null ? assistance.getMouvementContrat().getId() : null)
                .vehiculeId(assistance.getVehicule() != null ? assistance.getVehicule().getId() : null)
                .vehiculeImmatriculation(assistance.getVehicule() != null ? assistance.getVehicule().getImmatriculation() : null)
                .compagnieAssistanceId(assistance.getCompagnieAssistance() != null ? assistance.getCompagnieAssistance().getId() : null)
                .compagnieAssistanceLibelle(assistance.getCompagnieAssistance() != null ? assistance.getCompagnieAssistance().getNom() : null)
                .produitAssistanceId(assistance.getProduitAssistance() != null ? assistance.getProduitAssistance().getId() : null)
                .tarifProduitAssistanceId(assistance.getTarifProduitAssistance() != null ? assistance.getTarifProduitAssistance().getId() : null)
                .produit(assistance.getProduit())
                .dateSouscription(assistance.getDateSouscription())
                .dateEffet(assistance.getDateEffet())
                .dateEcheance(assistance.getDateEcheance())
                .echeanceCode(assistance.getEcheanceCode())
                .numeroContratOuQuittance(assistance.getNumeroContratOuQuittance())
                .trimestres(trimestres)
                .prorataRatio(prorata.setScale(2, RoundingMode.HALF_UP))
                .primeNette(assistance.getPrimeNette())
                .primeTotale(assistance.getPrimeTotale())
                .elementFacturableId(assistance.getElementFacturable() != null ? assistance.getElementFacturable().getId() : null)
                .build();
    }

    private MouvementContrat resolveMouvement(Contrat contrat, Long mouvementId) {
        if (mouvementId == null) {
            return null;
        }
        MouvementContrat mouvement = mouvementContratRepository.findById(mouvementId)
                .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", mouvementId));
        if (mouvement.getContrat() == null || !mouvement.getContrat().getId().equals(contrat.getId())) {
            throw new BadRequestException("Le mouvement ne correspond pas au contrat");
        }
        return mouvement;
    }

    private List<Vehicule> resolveVehiculesCibles(Contrat contrat, MouvementContrat mouvement) {
        if (mouvement == null) {
            return vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        }
        Map<Long, Vehicule> vehicules = new LinkedHashMap<>();
        for (MouvementVehicule snapshot : mouvementVehiculeRepository.findByMouvementContratId(mouvement.getId())) {
            if (snapshot.getVehicule() != null && isEtatApresMouvement(snapshot.getNature())) {
                vehicules.putIfAbsent(snapshot.getVehicule().getId(), snapshot.getVehicule());
            }
        }
        return List.copyOf(vehicules.values());
    }

    private void validateVehiculeCible(Contrat contrat, MouvementContrat mouvement, Vehicule vehicule) {
        if (mouvement == null) {
            return;
        }
        boolean cibleDuMouvement = resolveVehiculesCibles(contrat, mouvement).stream()
                .anyMatch(cible -> cible.getId().equals(vehicule.getId())
                        && Boolean.TRUE.equals(cible.getActif()));
        if (!cibleDuMouvement) {
            throw new BadRequestException("Le véhicule ne correspond pas aux cibles actives du mouvement");
        }
    }

    private boolean isEtatApresMouvement(NatureSnapshotMouvement nature) {
        return nature == NatureSnapshotMouvement.AJOUT
                || nature == NatureSnapshotMouvement.APRES
                || nature == NatureSnapshotMouvement.COURANT;
    }

    private AssistanceContratContextResponse.VehiculeAssistanceOption toVehiculeOption(Vehicule vehicule) {
        return AssistanceContratContextResponse.VehiculeAssistanceOption.builder()
                .id(vehicule.getId())
                .immatriculation(vehicule.getImmatriculation())
                .usageId(vehicule.getUsage() != null ? vehicule.getUsage().getId() : null)
                .usageCode(vehicule.getUsage() != null ? vehicule.getUsage().getCode() : null)
                .usageLibelle(vehicule.getUsage() != null ? vehicule.getUsage().getLibelle() : null)
                .dateEffet(vehicule.getDateEffet())
                .dateEcheance(vehicule.getDateEcheance())
                .build();
    }

    private AssistanceContratContextResponse.ProduitAssistanceOption toProduitOption(ProduitAssistance produit, LocalDate referenceDate) {
        TarifProduitAssistance tarif = tarifProduitAssistanceService.resolveTarifForDate(produit, referenceDate);
        return AssistanceContratContextResponse.ProduitAssistanceOption.builder()
                .id(produit.getId())
                .libelle(produit.getLibelle())
                .type(produit.getType())
                .compagnieAssistanceId(produit.getCompagnieAssistance() != null ? produit.getCompagnieAssistance().getId() : null)
                .categorieClientId(produit.getCategorieClient() != null ? produit.getCategorieClient().getId() : null)
                .usageIds(produit.getUsages() == null ? List.of() : produit.getUsages().stream().map(Usage::getId).toList())
                .prestations(produit.getPrestations())
                .tarifProduitAssistanceId(tarif != null ? tarif.getId() : null)
                .dateDebutTarif(tarif != null ? tarif.getDateDebut() : null)
                .dateFinTarif(tarif != null ? tarif.getDateFin() : null)
                .montantHt(tarif != null ? tarif.getMontantHt() : null)
                .montantTtc(tarif != null ? tarif.getMontantTtc() : null)
                .build();
    }

    private Long resolveAssistanceCategorieClientId(Contrat contrat) {
        RoleClientContrat preferredRole = contrat.getTypeContrat() == TypeContrat.FLOTTE
                ? RoleClientContrat.PROPRIETAIRE
                : RoleClientContrat.SOUSCRIPTEUR;
        Long preferred = resolveCategorieClientId(contrat, preferredRole);
        if (preferred != null) {
            return preferred;
        }
        RoleClientContrat secondaryRole = preferredRole == RoleClientContrat.PROPRIETAIRE
                ? RoleClientContrat.SOUSCRIPTEUR
                : RoleClientContrat.PROPRIETAIRE;
        Long secondary = resolveCategorieClientId(contrat, secondaryRole);
        if (secondary != null) {
            return secondary;
        }
        return contrat.getCategorieClient() != null ? contrat.getCategorieClient().getId() : null;
    }

    private Long resolveCategorieClientId(Contrat contrat, RoleClientContrat role) {
        return contrat.getClients() == null ? null : contrat.getClients().stream()
                .filter(link -> link.getRole() == role)
                .sorted(Comparator.comparing(ContratClient::getPrincipalPourRole, Comparator.nullsLast(Boolean::compareTo)).reversed())
                .map(ContratClient::getClient)
                .filter(client -> client != null && client.getCategorieClient() != null)
                .map(client -> client.getCategorieClient().getId())
                .findFirst()
                .orElse(null);
    }

    public static int resolveAssistanceQuarterCount(LocalDate dateEffet, LocalDate dateEcheance) {
        if (dateEffet == null || dateEcheance == null || dateEcheance.isBefore(dateEffet)) {
            return 4;
        }
        LocalDate endExclusive = dateEcheance.plusDays(1);
        long months = (long) (endExclusive.getYear() - dateEffet.getYear()) * 12
                + (endExclusive.getMonthValue() - dateEffet.getMonthValue());
        if (dateEffet.plusMonths(months).isBefore(endExclusive)) {
            months++;
        }
        months = Math.max(1, months);
        return Math.max(1, Math.min(4, (int) Math.ceil(months / 3.0d)));
    }

    @SafeVarargs
    private final <T> T firstNonNull(T... values) {
        for (T value : values) {
            if (value != null) {
                return value;
            }
        }
        return null;
    }

    private record AssistancePricing(
            CompagnieAssistance compagnie,
            ProduitAssistance produit,
            TarifProduitAssistance tarif,
            LocalDate dateSouscription,
            LocalDate dateEffet,
            LocalDate dateEcheance,
            String echeanceCode,
            int trimestres,
            BigDecimal prorata,
            BigDecimal primeNette,
            BigDecimal primeTotale
    ) {
    }
}
