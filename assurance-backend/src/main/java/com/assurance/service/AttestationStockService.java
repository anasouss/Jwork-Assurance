package com.assurance.service;

import com.assurance.dto.request.CancelAttestationStockRequest;
import com.assurance.dto.request.UpdateAttestationStockSettingsRequest;
import com.assurance.dto.request.UpsertSeuilStockAttestationRequest;
import com.assurance.dto.response.AttestationStockDashboardResponse;
import com.assurance.dto.response.AttestationStockItemResponse;
import com.assurance.dto.response.AttestationStockSettingsResponse;
import com.assurance.dto.response.AttestationNumeroValidationResponse;
import com.assurance.dto.response.SeuilStockAttestationResponse;
import com.assurance.entity.AttestationStock;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementStockAttestation;
import com.assurance.entity.Remorque;
import com.assurance.entity.SeuilStockAttestation;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.StatutAttestationStock;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.TypeMouvementStockAttestation;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.AttestationStockRepository;
import com.assurance.repository.GroupeUsageAttestationRepository;
import com.assurance.repository.MouvementStockAttestationRepository;
import com.assurance.repository.SeuilStockAttestationRepository;
import com.assurance.repository.UsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.EnumMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AttestationStockService {

    public static final String PARAM_CONTROLE_STOCK_ATTESTATION = "ENABLE_ATTESTATION_STOCK_CHECK";

    private final AttestationStockRepository attestationStockRepository;
    private final MouvementStockAttestationRepository mouvementStockAttestationRepository;
    private final SeuilStockAttestationRepository seuilStockAttestationRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final GroupeUsageAttestationRepository groupeUsageAttestationRepository;
    private final UsageRepository usageRepository;
    private final ParametreApplicationService parametreApplicationService;
    private final AttestationNumeroService attestationNumeroService;

    public boolean controleActif(Long agenceId) {
        return parametreApplicationService.getBoolean(agenceId, PARAM_CONTROLE_STOCK_ATTESTATION, true);
    }

    public String normaliserNumero(String numero, Contrat contrat, Usage usage) {
        return attestationNumeroService.normaliser(numero, contrat != null ? contrat.getCompagnieAssurance() : null, usage);
    }

    public List<String> listerDisponibles(String fragment, Contrat contrat, Usage usage) {
        if (!controleActif(contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null)
                || contrat == null
                || contrat.getCompagnieAssurance() == null
                || !hasText(fragment)) {
            return List.of();
        }
        GroupeUsageAttestation groupe = groupeStock(usage);
        if (groupe == null) {
            return List.of();
        }
        return attestationStockRepository.findDisponibles(
                fragment.trim(),
                StatutAttestationStock.DISPONIBLE,
                contrat.getCompagnieAssurance().getId(),
                groupe.getId()
        );
    }

    @Transactional(readOnly = true)
    public List<String> listerDisponibles(Long agenceId, Long compagnieId, Long usageId, String fragment) {
        if (!controleActif(agenceId) || compagnieId == null || usageId == null || !hasText(fragment)) {
            return List.of();
        }
        Usage usage = usageRepository.findById(usageId)
                .orElseThrow(() -> new ResourceNotFoundException("Usage", usageId));
        GroupeUsageAttestation groupe = groupeStock(usage);
        if (groupe == null) {
            return List.of();
        }
        return attestationStockRepository.findDisponibles(
                        fragment.trim(),
                        StatutAttestationStock.DISPONIBLE,
                        compagnieId,
                        groupe.getId()
                )
                .stream()
                .limit(10)
                .toList();
    }

    @Transactional(readOnly = true)
    public AttestationNumeroValidationResponse validerNumero(Long agenceId, Long compagnieId, Long usageId, String numero, String numeroCourant) {
        CompagnieAssurance compagnie = compagnieId == null ? null : compagnieAssuranceRepository.findById(compagnieId)
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", compagnieId));
        Usage usage = usageId == null ? null : usageRepository.findById(usageId)
                .orElseThrow(() -> new ResourceNotFoundException("Usage", usageId));
        String prefixe = attestationNumeroService.normaliserPrefixe(compagnie != null ? compagnie.getPrefixeAttestation() : null);
        String codeUsageStock = attestationNumeroService.codeGroupe(usage);
        String numeroNormalise = attestationNumeroService.normaliser(numero, compagnie, usage);
        boolean controleStockActif = controleActif(agenceId);
        boolean validationRequise = controleStockActif
                && Boolean.TRUE.equals(usage != null ? usage.getConsommeAttestation() : null)
                && groupeStock(usage) != null
                && compagnie != null;

        if (!validationRequise) {
            return AttestationNumeroValidationResponse.builder()
                    .controleStockActif(controleStockActif)
                    .validationRequise(false)
                    .disponible(true)
                    .numeroNormalise(numeroNormalise)
                    .prefixe(prefixe)
                    .codeUsageStock(codeUsageStock)
                    .suggestions(List.of())
                    .build();
        }
        if (!hasText(numeroNormalise)) {
            return AttestationNumeroValidationResponse.builder()
                    .controleStockActif(true)
                    .validationRequise(true)
                    .disponible(false)
                    .numeroNormalise(numeroNormalise)
                    .prefixe(prefixe)
                    .codeUsageStock(codeUsageStock)
                    .message("Numero d'attestation obligatoire")
                    .suggestions(List.of())
                    .build();
        }

        String numeroCourantNormalise = attestationNumeroService.normaliser(numeroCourant, compagnie, usage);
        if (hasText(numeroCourantNormalise) && numeroCourantNormalise.equalsIgnoreCase(numeroNormalise)) {
            return AttestationNumeroValidationResponse.builder()
                    .controleStockActif(true)
                    .validationRequise(true)
                    .disponible(true)
                    .numeroNormalise(numeroNormalise)
                    .prefixe(prefixe)
                    .codeUsageStock(codeUsageStock)
                    .message("Numero deja associe a cette cible")
                    .suggestions(List.of())
                    .build();
        }

        GroupeUsageAttestation groupe = groupeStock(usage);
        List<AttestationStock> candidates = attestationStockRepository.findGestionnable(
                attestationNumeroService.candidats(numeroNormalise, compagnie, usage),
                compagnie.getId(),
                groupe.getId()
        );
        AttestationStock stock = candidates.stream().findFirst().orElse(null);
        boolean disponible = stock != null && stock.getStatut() == StatutAttestationStock.DISPONIBLE;
        String message = stock == null
                ? "Ce numero d'attestation n'existe pas en stock"
                : disponible ? "Numero disponible en stock" : messageStatut(stock.getStatut());
        return AttestationNumeroValidationResponse.builder()
                .controleStockActif(true)
                .validationRequise(true)
                .disponible(disponible)
                .numeroNormalise(numeroNormalise)
                .prefixe(prefixe)
                .codeUsageStock(codeUsageStock)
                .statut(stock != null ? stock.getStatut() : null)
                .message(message)
                .suggestions(listerDisponibles(agenceId, compagnieId, usageId, numero))
                .build();
    }

    @Transactional(readOnly = true)
    public AttestationStockSettingsResponse settings(Long agenceId) {
        return AttestationStockSettingsResponse.builder()
                .controleStockActif(controleActif(agenceId))
                .build();
    }

    @Transactional
    public AttestationStockSettingsResponse updateSettings(Long agenceId, UpdateAttestationStockSettingsRequest request) {
        boolean controleActif = Boolean.TRUE.equals(request.getControleStockActif());
        parametreApplicationService.setBoolean(
                agenceId,
                PARAM_CONTROLE_STOCK_ATTESTATION,
                controleActif,
                "Active le controle du stock des attestations pendant la production"
        );
        return settings(agenceId);
    }

    @Transactional(readOnly = true)
    public AttestationStockDashboardResponse dashboard(Long agenceId) {
        Map<StatutAttestationStock, Long> summaryByStatus = emptyStatusMap();
        for (Object[] row : attestationStockRepository.countByStatutForDashboard()) {
            summaryByStatus.put((StatutAttestationStock) row[0], toLong(row[1]));
        }

        Map<String, AttestationStockDashboardResponse.CompanyUsageStock.CompanyUsageStockBuilder> grouped = new LinkedHashMap<>();
        Map<String, StatusTotals> groupedTotals = new LinkedHashMap<>();
        for (Object[] row : attestationStockRepository.countByCompanyAndGroupForDashboard()) {
            Long compagnieId = toLong(row[0]);
            Long groupeId = toLong(row[2]);
            String key = compagnieId + "|" + groupeId;
            grouped.computeIfAbsent(key, ignored -> AttestationStockDashboardResponse.CompanyUsageStock.builder()
                    .compagnieAssuranceId(compagnieId)
                    .compagnieAssuranceNom((String) row[1])
                    .groupeUsageAttestationId(groupeId)
                    .groupeUsageAttestationCode((String) row[3])
                    .groupeUsageAttestationLibelle((String) row[4])
                    .groupeUsageAttestationCouleur((String) row[5]));
            StatusTotals totals = groupedTotals.computeIfAbsent(key, ignored -> new StatusTotals());
            totals.add((StatutAttestationStock) row[6], toLong(row[7]));
        }

        Map<String, SeuilStockAttestation> seuilsByKey = new LinkedHashMap<>();
        for (SeuilStockAttestation seuil : seuilStockAttestationRepository.findByActifTrueOrderByCompagnieAssuranceNomAscGroupeUsageAttestationCodeAsc()) {
            seuilsByKey.put(seuilKey(seuil.getCompagnieAssurance().getId(), seuil.getGroupeUsageAttestation().getId()), seuil);
        }

        List<AttestationStockDashboardResponse.CompanyUsageStock> stocks = grouped.entrySet().stream()
                .map(entry -> {
                    StatusTotals totals = groupedTotals.get(entry.getKey());
                    SeuilStockAttestation seuil = seuilsByKey.get(entry.getKey());
                    return entry.getValue()
                            .total(totals.total())
                            .disponible(totals.get(StatutAttestationStock.DISPONIBLE))
                            .reservee(totals.get(StatutAttestationStock.RESERVEE))
                            .utilisee(totals.get(StatutAttestationStock.UTILISEE))
                            .annulee(totals.get(StatutAttestationStock.ANNULEE))
                            .desactivee(totals.get(StatutAttestationStock.DESACTIVEE))
                            .minimumStock(seuil != null ? seuil.getMinimumStock() : null)
                            .stockFaible(seuil != null ? seuil.getStockFaible() : false)
                            .build();
                })
                .toList();

        return AttestationStockDashboardResponse.builder()
                .controleStockActif(controleActif(agenceId))
                .summary(toSummary(summaryByStatus))
                .stocksParCompagnieUsage(stocks)
                .seuils(seuilsByKey.values().stream().map(this::toSeuilResponse).toList())
                .build();
    }

    @Transactional(readOnly = true)
    public List<AttestationStockItemResponse> rechercher(Long agenceId, Long compagnieId, Long groupeUsageAttestationId, StatutAttestationStock statut, String numero, Integer limit) {
        int size = limit == null ? 100 : Math.max(1, Math.min(limit, 500));
        String numeroFiltre = hasText(numero) ? numero.trim() : null;
        return attestationStockRepository.searchGestionStock(agenceId, numeroFiltre, compagnieId, groupeUsageAttestationId, statut, PageRequest.of(0, size))
                .stream()
                .map(this::toItemResponse)
                .toList();
    }

    @Transactional
    public AttestationStockItemResponse annuler(Long agenceId, Long attestationId, CancelAttestationStockRequest request) {
        AttestationStock attestation = attestationStockRepository
                .findGestionnableByIdAndAgenceIdForUpdate(attestationId, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("AttestationStock", attestationId));
        if (attestation.getStatut() != StatutAttestationStock.DISPONIBLE) {
            throw new BadRequestException("Seule une attestation disponible peut etre annulee");
        }

        String motif = request.getMotif().trim();
        attestation.setStatut(StatutAttestationStock.ANNULEE);
        attestation.setDateAnnulation(LocalDateTime.now());
        attestation.setMotifAnnulation(motif);
        attestationStockRepository.save(attestation);
        enregistrerMouvement(
                attestation,
                TypeMouvementStockAttestation.ANNULATION,
                null,
                null,
                attestation.getNumero(),
                null,
                motif
        );
        recalculerSeuil(attestation);
        return toItemResponse(attestation);
    }

    @Transactional(readOnly = true)
    public List<SeuilStockAttestationResponse> listerSeuils() {
        return seuilStockAttestationRepository.findByActifTrueOrderByCompagnieAssuranceNomAscGroupeUsageAttestationCodeAsc()
                .stream()
                .map(this::toSeuilResponse)
                .toList();
    }

    @Transactional
    public SeuilStockAttestationResponse creerSeuil(UpsertSeuilStockAttestationRequest request) {
        CompagnieAssurance compagnie = compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        GroupeUsageAttestation groupe = groupeUsageAttestationRepository.findById(request.getGroupeUsageAttestationId())
                .orElseThrow(() -> new ResourceNotFoundException("GroupeUsageAttestation", request.getGroupeUsageAttestationId()));
        SeuilStockAttestation seuil = seuilStockAttestationRepository
                .findByCompagnieAssuranceIdAndGroupeUsageAttestationIdAndActifTrue(compagnie.getId(), groupe.getId())
                .orElseGet(() -> SeuilStockAttestation.builder()
                        .compagnieAssurance(compagnie)
                        .groupeUsageAttestation(groupe)
                        .actif(true)
                        .build());
        updateSeuilValues(seuil, request.getMinimumStock());
        return toSeuilResponse(seuilStockAttestationRepository.save(seuil));
    }

    @Transactional
    public SeuilStockAttestationResponse modifierSeuil(Long id, UpsertSeuilStockAttestationRequest request) {
        SeuilStockAttestation seuil = seuilStockAttestationRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new ResourceNotFoundException("SeuilStockAttestation", id));
        if (!seuil.getCompagnieAssurance().getId().equals(request.getCompagnieAssuranceId())
                || !seuil.getGroupeUsageAttestation().getId().equals(request.getGroupeUsageAttestationId())) {
            CompagnieAssurance compagnie = compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                    .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
            GroupeUsageAttestation groupe = groupeUsageAttestationRepository.findById(request.getGroupeUsageAttestationId())
                    .orElseThrow(() -> new ResourceNotFoundException("GroupeUsageAttestation", request.getGroupeUsageAttestationId()));
            seuil.setCompagnieAssurance(compagnie);
            seuil.setGroupeUsageAttestation(groupe);
        }
        updateSeuilValues(seuil, request.getMinimumStock());
        return toSeuilResponse(seuilStockAttestationRepository.save(seuil));
    }

    @Transactional
    public void consommerPourMouvement(Contrat contrat, MouvementContrat mouvement, String numero, Usage usage, Vehicule vehicule, Remorque remorque) {
        if (!doitConsommer(contrat, mouvement != null ? mouvement.getTypeMouvement() : null, usage)) {
            return;
        }
        String numeroNormalise = normaliserNumero(numero, contrat, usage);
        if (!hasText(numeroNormalise)) {
            throw new BadRequestException("Numero d'attestation obligatoire pour ce mouvement");
        }
        AttestationStock attestation = trouverDisponiblePourUpdate(contrat, usage, numeroNormalise);
        attestation.setStatut(StatutAttestationStock.UTILISEE);
        attestation.setDateUtilisation(LocalDateTime.now());
        attestation.setNumeroDossier(contrat.getNumeroDossier());
        attestation.setNumeroPolice(contrat.getNumeroPolice());
        attestation.setContrat(contrat);
        attestation.setMouvementContrat(mouvement);
        attestation.setVehicule(vehicule);
        attestation.setRemorque(remorque);
        attestationStockRepository.save(attestation);
        enregistrerMouvement(attestation, TypeMouvementStockAttestation.UTILISATION, contrat, mouvement, null, numeroNormalise);
        recalculerSeuil(attestation);
    }

    @Transactional
    public void liberer(Contrat contrat, MouvementContrat mouvement, String numero, Usage usage) {
        if (!controleActif(contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null) || !hasText(numero)) {
            return;
        }
        if (contrat == null || contrat.getCompagnieAssurance() == null) {
            return;
        }
        GroupeUsageAttestation groupe = groupeStock(usage);
        if (groupe == null) {
            return;
        }
        String numeroNormalise = normaliserNumero(numero, contrat, usage);
        List<AttestationStock> attestations = attestationStockRepository.findGestionnableForUpdate(
                attestationNumeroService.candidats(numeroNormalise, contrat.getCompagnieAssurance(), usage),
                contrat.getCompagnieAssurance().getId(),
                groupe.getId()
        );
        for (AttestationStock attestation : attestations) {
            if (contrat != null && attestation.getContrat() != null && !contrat.getId().equals(attestation.getContrat().getId())) {
                continue;
            }
            attestation.setStatut(StatutAttestationStock.DISPONIBLE);
            attestation.setDateUtilisation(null);
            attestation.setNumeroDossier(null);
            attestation.setNumeroPolice(null);
            attestation.setContrat(null);
            attestation.setMouvementContrat(null);
            attestation.setVehicule(null);
            attestation.setRemorque(null);
            attestationStockRepository.save(attestation);
            enregistrerMouvement(attestation, TypeMouvementStockAttestation.LIBERATION, contrat, mouvement, numeroNormalise, null);
            recalculerSeuil(attestation);
            return;
        }
    }

    public boolean doitConsommer(Contrat contrat, TypeMouvementContrat typeMouvement, Usage usage) {
        if (!controleActif(contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null)) {
            return false;
        }
        return Boolean.TRUE.equals(typeMouvement != null ? typeMouvement.getConsommeAttestation() : null)
                && Boolean.TRUE.equals(usage != null ? usage.getConsommeAttestation() : null)
                && groupeStock(usage) != null;
    }

    private AttestationStock trouverDisponiblePourUpdate(Contrat contrat, Usage usage, String numeroNormalise) {
        if (contrat == null || contrat.getCompagnieAssurance() == null) {
            throw new BadRequestException("Compagnie invalide pour le controle du stock d'attestation");
        }
        GroupeUsageAttestation groupe = groupeStock(usage);
        if (groupe == null) {
            throw new BadRequestException("Usage invalide pour le controle du stock d'attestation");
        }
        List<AttestationStock> candidates = attestationStockRepository.findGestionnableForUpdate(
                attestationNumeroService.candidats(numeroNormalise, contrat.getCompagnieAssurance(), usage),
                contrat.getCompagnieAssurance().getId(),
                groupe.getId()
        );
        return candidates.stream()
                .filter(attestation -> attestation.getStatut() == StatutAttestationStock.DISPONIBLE)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Ce numero d'attestation n'est pas disponible en stock"));
    }

    private GroupeUsageAttestation groupeStock(Usage usage) {
        GroupeUsageAttestation groupe = usage != null ? usage.getGroupeUsageAttestation() : null;
        if (groupe == null || !Boolean.TRUE.equals(groupe.getVisibleStock()) || !Boolean.TRUE.equals(groupe.getActif())) {
            return null;
        }
        return groupe;
    }

    private void enregistrerMouvement(
            AttestationStock attestation,
            TypeMouvementStockAttestation typeMouvement,
            Contrat contrat,
            MouvementContrat mouvementContrat,
            String numeroAvant,
            String numeroApres
    ) {
        enregistrerMouvement(attestation, typeMouvement, contrat, mouvementContrat, numeroAvant, numeroApres, null);
    }

    private void enregistrerMouvement(
            AttestationStock attestation,
            TypeMouvementStockAttestation typeMouvement,
            Contrat contrat,
            MouvementContrat mouvementContrat,
            String numeroAvant,
            String numeroApres,
            String notes
    ) {
        mouvementStockAttestationRepository.save(MouvementStockAttestation.builder()
                .attestationStock(attestation)
                .typeMouvement(typeMouvement)
                .contrat(contrat)
                .mouvementContrat(mouvementContrat)
                .numeroAvant(numeroAvant)
                .numeroApres(numeroApres)
                .dateMouvement(LocalDateTime.now())
                .notes(notes)
                .build());
    }

    private void recalculerSeuil(AttestationStock attestation) {
        seuilStockAttestationRepository
                .findByCompagnieAssuranceIdAndGroupeUsageAttestationIdAndActifTrue(
                        attestation.getCompagnieAssurance().getId(),
                        attestation.getGroupeUsageAttestation().getId()
                )
                .ifPresent(seuil -> {
                    long disponible = attestationStockRepository.countDisponibles(
                            attestation.getCompagnieAssurance().getId(),
                            attestation.getGroupeUsageAttestation().getId()
                    );
                    seuil.setStockDisponible((int) disponible);
                    seuil.setStockFaible(disponible <= Math.max(0, seuil.getMinimumStock()));
                    seuil.setDerniereEvaluation(LocalDateTime.now());
                    seuilStockAttestationRepository.save(seuil);
                });
    }

    private void updateSeuilValues(SeuilStockAttestation seuil, Integer minimumStock) {
        int disponible = (int) attestationStockRepository.countDisponibles(
                seuil.getCompagnieAssurance().getId(),
                seuil.getGroupeUsageAttestation().getId()
        );
        seuil.setMinimumStock(Math.max(0, minimumStock == null ? 0 : minimumStock));
        seuil.setStockDisponible(disponible);
        seuil.setStockFaible(disponible <= seuil.getMinimumStock());
        seuil.setDerniereEvaluation(LocalDateTime.now());
        seuil.setActif(true);
    }

    private AttestationStockDashboardResponse.Summary toSummary(Map<StatutAttestationStock, Long> values) {
        return AttestationStockDashboardResponse.Summary.builder()
                .disponible(values.get(StatutAttestationStock.DISPONIBLE))
                .reservee(values.get(StatutAttestationStock.RESERVEE))
                .utilisee(values.get(StatutAttestationStock.UTILISEE))
                .annulee(values.get(StatutAttestationStock.ANNULEE))
                .desactivee(values.get(StatutAttestationStock.DESACTIVEE))
                .total(values.values().stream().mapToLong(Long::longValue).sum())
                .build();
    }

    private Map<StatutAttestationStock, Long> emptyStatusMap() {
        Map<StatutAttestationStock, Long> values = new EnumMap<>(StatutAttestationStock.class);
        for (StatutAttestationStock statut : StatutAttestationStock.values()) {
            values.put(statut, 0L);
        }
        return values;
    }

    private AttestationStockItemResponse toItemResponse(AttestationStock attestation) {
        Contrat contrat = attestation.getContrat();
        java.time.LocalDate dateEffet = attestation.getMouvementContrat() != null && attestation.getMouvementContrat().getDateEffet() != null
                ? attestation.getMouvementContrat().getDateEffet()
                : contrat != null ? contrat.getDateEffet() : null;
        return AttestationStockItemResponse.builder()
                .id(attestation.getId())
                .compagnieAssuranceId(attestation.getCompagnieAssurance().getId())
                .compagnieAssuranceNom(attestation.getCompagnieAssurance().getNom())
                .groupeUsageAttestationId(attestation.getGroupeUsageAttestation().getId())
                .groupeUsageAttestationCode(attestation.getGroupeUsageAttestation().getCode())
                .groupeUsageAttestationLibelle(attestation.getGroupeUsageAttestation().getLibelle())
                .numero(attestation.getNumero())
                .serie(attestation.getSerie())
                .statut(attestation.getStatut())
                .dateUtilisation(attestation.getDateUtilisation())
                .dateAnnulation(attestation.getDateAnnulation())
                .motifAnnulation(attestation.getMotifAnnulation())
                .assure(resolveAssure(contrat))
                .numeroDossier(attestation.getNumeroDossier())
                .numeroPolice(attestation.getNumeroPolice())
                .dateEffet(dateEffet)
                .dateReception(attestation.getLot().getLivraison().getDateReception())
                .referenceLivraison(attestation.getLot().getLivraison().getReferenceCommande())
                .build();
    }

    private String resolveAssure(Contrat contrat) {
        if (contrat == null || contrat.getClients() == null) {
            return null;
        }
        return contrat.getClients().stream()
                .filter(item -> item.getRole() == RoleClientContrat.SOUSCRIPTEUR)
                .sorted((left, right) -> Boolean.compare(Boolean.TRUE.equals(right.getPrincipalPourRole()), Boolean.TRUE.equals(left.getPrincipalPourRole())))
                .map(ContratClient::getClient)
                .filter(client -> client != null)
                .map(client -> client.getNomAffichage())
                .filter(value -> value != null && !value.isBlank())
                .findFirst()
                .orElse(null);
    }

    private SeuilStockAttestationResponse toSeuilResponse(SeuilStockAttestation seuil) {
        return SeuilStockAttestationResponse.builder()
                .id(seuil.getId())
                .compagnieAssuranceId(seuil.getCompagnieAssurance().getId())
                .compagnieAssuranceNom(seuil.getCompagnieAssurance().getNom())
                .groupeUsageAttestationId(seuil.getGroupeUsageAttestation().getId())
                .groupeUsageAttestationCode(seuil.getGroupeUsageAttestation().getCode())
                .groupeUsageAttestationLibelle(seuil.getGroupeUsageAttestation().getLibelle())
                .minimumStock(seuil.getMinimumStock())
                .stockDisponible(seuil.getStockDisponible())
                .stockFaible(seuil.getStockFaible())
                .derniereEvaluation(seuil.getDerniereEvaluation())
                .build();
    }

    private String seuilKey(Long compagnieId, Long groupeUsageAttestationId) {
        return compagnieId + "|" + groupeUsageAttestationId;
    }

    private String messageStatut(StatutAttestationStock statut) {
        if (statut == StatutAttestationStock.UTILISEE) {
            return "Ce numero d'attestation est deja utilise";
        }
        if (statut == StatutAttestationStock.RESERVEE) {
            return "Ce numero d'attestation est reserve";
        }
        if (statut == StatutAttestationStock.ANNULEE) {
            return "Ce numero d'attestation est annule";
        }
        if (statut == StatutAttestationStock.DESACTIVEE) {
            return "Ce numero d'attestation est desactive";
        }
        return "Ce numero d'attestation n'est pas disponible en stock";
    }

    private long toLong(Object value) {
        return value instanceof Number number ? number.longValue() : 0L;
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private static class StatusTotals {
        private final Map<StatutAttestationStock, Long> values = new EnumMap<>(StatutAttestationStock.class);

        private StatusTotals() {
            for (StatutAttestationStock statut : StatutAttestationStock.values()) {
                values.put(statut, 0L);
            }
        }

        private void add(StatutAttestationStock statut, long value) {
            values.put(statut, get(statut) + value);
        }

        private long get(StatutAttestationStock statut) {
            return values.getOrDefault(statut, 0L);
        }

        private long total() {
            return values.values().stream().mapToLong(Long::longValue).sum();
        }
    }
}
