package com.assurance.service;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.BusinessActivityRecorder;
import com.assurance.activity.ClaimActivity;
import com.assurance.dto.request.CreateSinistreRequest;
import com.assurance.dto.request.TransitionSinistreRequest;
import com.assurance.dto.request.UpdateSinistreRequest;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.dto.response.SinistreSummaryResponse;
import com.assurance.dto.response.SinistreDoublonResponse;
import com.assurance.dto.response.SinistreGestionnaireResponse;
import com.assurance.entity.MouvementGarantie;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreCouverture;
import com.assurance.entity.SinistreGarantie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.DecisionCouvertureSinistre;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.SinistreCouvertureRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistreRepository;
import com.assurance.repository.UtilisateurRepository;
import jakarta.persistence.criteria.JoinType;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Sort;
import org.springframework.data.jpa.domain.Specification;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SinistreService {

    private final SinistreRepository sinistreRepository;
    private final SinistreCouvertureRepository couvertureRepository;
    private final SinistreGarantieRepository garantieRepository;
    private final SinistreOperationRepository operationRepository;
    private final MissionExpertiseRepository missionRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final SinistreCouvertureService couvertureService;
    private final SinistreNumeroService numeroService;
    private final SinistreWorkflowService workflowService;
    private final SinistreReadinessService readinessService;
    private final SinistreEvenementService evenementService;
    private final SinistreResponseMapper responseMapper;
    private final BusinessActivityRecorder activityRecorder;
    private final SinistreQualificationService qualificationService;
    private final SinistreSuiviService suiviService;
    private final SinistreAssistanceService assistanceService;

    @Transactional
    public SinistreDetailResponse transitionEtape(Long agenceId, Long utilisateurId, Long id,
            com.assurance.dto.request.TransitionEtapeSinistreRequest request) {
        Sinistre sinistre = resolveForUpdate(agenceId, id);
        var before = ClaimActivity.snapshot(responseMapper.toDetail(sinistre));
        suiviService.transition(agenceId, utilisateurId, id, request);
        var detail = responseMapper.toDetail(sinistre);
        activityRecorder.record(ClaimActivity.withReason(ClaimActivity.command(sinistre, before, detail,
                ActivityAction.UPDATED, "Suivi du sinistre modifié", "CLAIM_WORKFLOW_TRANSITION"), request.getMotif()));
        return detail;
    }

    @Transactional(readOnly = true)
    public List<SinistreDoublonResponse> findPossibleDuplicates(
            Long agenceId,
            Long contratId,
            Long vehiculeId,
            LocalDate dateSinistre
    ) {
        return sinistreRepository.findPossibleDuplicates(
                        agenceId,
                        contratId,
                        vehiculeId,
                        dateSinistre
                ).stream()
                .map(item -> SinistreDoublonResponse.builder()
                        .id(item.getId())
                        .numeroSinistre(item.getNumeroSinistre())
                        .statut(item.getStatut())
                        .dateSinistre(item.getDateSinistre())
                        .build())
                .toList();
    }

    @Transactional(readOnly = true)
    public List<SinistreGestionnaireResponse> listManagers(Long agenceId) {
        return utilisateurRepository.findByAgenceIdOrderByNomAscPrenomAsc(agenceId)
                .stream()
                .filter(user -> Boolean.TRUE.equals(user.getActif()))
                .map(user -> SinistreGestionnaireResponse.builder()
                        .id(user.getId())
                        .nom(user.getFullName())
                        .build())
                .toList();
    }

    @Transactional
    public SinistreDetailResponse create(
            Long agenceId,
            Long utilisateurId,
            CreateSinistreRequest request
    ) {
        return activityRecorder.perform(() -> createRecord(agenceId, utilisateurId, request), detail ->
                ClaimActivity.command(resolve(agenceId, detail.getId()), null, detail,
                        detail.getStatut() == StatutSinistre.DECLARE ? ActivityAction.VALIDATED : ActivityAction.CREATED,
                        detail.getStatut() == StatutSinistre.DECLARE ? "Sinistre créé et déclaré" : "Brouillon de sinistre créé", "CLAIM_CREATION"));
    }

    private SinistreDetailResponse createRecord(Long agenceId, Long utilisateurId, CreateSinistreRequest request) {
        validateDeclarationDates(request);
        Utilisateur acteur = resolveCurrentUser(agenceId, utilisateurId);
        SinistreCouvertureService.CouvertureResolue couverture = couvertureService.resolve(
                agenceId,
                request.getContratId(),
                request.getVehiculeId(),
                request.getDateSinistre()
        );
        Set<Long> garantiesImpliquees = request.getGarantieIds() == null
                ? Set.of()
                : new HashSet<>(request.getGarantieIds());
        validateSelectedGuarantees(couverture.garanties(), garantiesImpliquees);
        boolean declarer = Boolean.TRUE.equals(request.getDeclarer());
        if (declarer) {
            assertDeclarationReady(garantiesImpliquees);
            boolean rc = couverture.garanties().stream().anyMatch(item -> garantiesImpliquees.contains(item.getGarantie().getId())
                    && Boolean.TRUE.equals(item.getGarantie().getResponsabiliteCivile()));
            if (rc && request.getTauxResponsabilite() == null) {
                throw new BadRequestException("Renseignez la responsabilite RC (0, 50 ou 100)");
            }
        }

        Sinistre sinistre = sinistreRepository.save(Sinistre.builder()
                .agence(couverture.contrat().getAgence())
                .contrat(couverture.contrat())
                .mouvementCouverture(couverture.mouvement())
                .client(couverture.assure())
                .vehicule(couverture.vehicule())
                .compagnieAssurance(couverture.contrat().getCompagnieAssurance())
                .gestionnaire(acteur)
                .numeroSinistre(numeroService.next(agenceId, request.getDateDeclaration().getYear()))
                .statut(declarer ? StatutSinistre.DECLARE : StatutSinistre.BROUILLON)
                .dateSinistre(request.getDateSinistre())
                .dateDeclaration(request.getDateDeclaration())
                .build());

        SinistreCouverture snapshot = couvertureRepository.save(toCoverageSnapshot(sinistre, couverture));
        sinistre.setCouverture(snapshot);
        garantieRepository.saveAll(couverture.garanties().stream()
                .map(item -> toGuaranteeSnapshot(
                        sinistre,
                        item,
                        garantiesImpliquees.contains(item.getGarantie().getId())
                ))
                .toList());
        sinistre.setReferenceCompagnie(trimToNull(request.getReferenceCompagnie()));
        qualificationService.apply(sinistre, request.getTypeDommage(), request.getModeReparation(),
                request.getGarageId(), request.getTauxResponsabilite());
        if (request.getAssistanceIds() != null && !request.getAssistanceIds().isEmpty()) {
            assistanceService.select(sinistre, request.getAssistanceIds());
        }
        if (declarer) {
            List<String> blockers = SinistreQualificationService.declarationBlockers(sinistre);
            if (!blockers.isEmpty()) {
                throw new BadRequestException(String.join(". ", blockers));
            }
        }
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.CREATION,
                declarer ? "Sinistre créé et déclaré" : "Brouillon de sinistre créé"
        );
        return responseMapper.toDetail(resolve(agenceId, sinistre.getId()));
    }

    @Transactional(readOnly = true)
    public SinistreDetailResponse get(Long agenceId, Long id) {
        return responseMapper.toDetail(resolve(agenceId, id));
    }

    @Transactional(readOnly = true)
    public PagedResponse<SinistreSummaryResponse> list(
            Long agenceId,
            String query,
            Long clientId,
            Long contratId,
            Long brancheId,
            StatutSinistre statut,
            LocalDate dateDu,
            LocalDate dateAu,
            int page,
            int size
    ) {
        return list(agenceId, query, clientId, contratId, brancheId, statut, null, dateDu, dateAu, page, size);
    }

    @Transactional(readOnly = true)
    public PagedResponse<SinistreSummaryResponse> list(
            Long agenceId, String query, Long clientId, Long contratId, Long brancheId,
            StatutSinistre statut,
            com.assurance.enums.EtapeSuiviSinistre etapeSuivi, LocalDate dateDu, LocalDate dateAu,
            int page, int size
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Page<Sinistre> result = sinistreRepository.findAll(
                specification(agenceId, query, clientId, contratId, brancheId, statut, etapeSuivi, dateDu, dateAu),
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "updatedAt")
                        .and(Sort.by(Sort.Direction.DESC, "id")))
        );
        return PagedResponse.<SinistreSummaryResponse>builder()
                .items(result.getContent().stream().map(responseMapper::toSummary).toList())
                .page(PageMetadata.from(result))
                .build();
    }

    @Transactional(readOnly = true)
    public List<SinistreSummaryResponse> registre(
            Long agenceId, String query, Long clientId, Long contratId, Long brancheId,
            StatutSinistre statut,
            com.assurance.enums.EtapeSuiviSinistre etapeSuivi, LocalDate dateDu, LocalDate dateAu
    ) {
        return sinistreRepository.findAll(
                        specification(agenceId, query, clientId, contratId, brancheId, statut,
                                etapeSuivi, dateDu, dateAu),
                        Sort.by(Sort.Direction.DESC, "updatedAt").and(Sort.by(Sort.Direction.DESC, "id")))
                .stream().map(responseMapper::toSummary).toList();
    }

    @Transactional
    public SinistreDetailResponse update(
            Long agenceId,
            Long utilisateurId,
            Long id,
            UpdateSinistreRequest request
    ) {
        Utilisateur acteur = resolveCurrentUser(agenceId, utilisateurId);
        Sinistre sinistre = resolveForUpdate(agenceId, id);
        if (!workflowService.isEditable(sinistre)) {
            throw new BadRequestException("Le sinistre doit être rouvert avant modification");
        }
        var before = ClaimActivity.snapshot(responseMapper.toDetail(sinistre));
        sinistre.setReferenceCompagnie(trimToNull(request.getReferenceCompagnie()));
        qualificationService.apply(sinistre, request.getTypeDommage(), request.getModeReparation(),
                request.getGarageId(), request.getTauxResponsabilite());
        sinistre.setNotes(trimToNull(request.getNotes()));
        if (sinistre.getStatut() != StatutSinistre.BROUILLON) {
            List<String> blockers = SinistreQualificationService.declarationBlockers(sinistre);
            if (!blockers.isEmpty()) {
                throw new BadRequestException(String.join(". ", blockers));
            }
        }
        if (sinistre.getStatut() != StatutSinistre.BROUILLON && request.getTauxResponsabilite() == null
                && garantieRepository.findForDetailOrderByConfiguredDisplay(id).stream()
                .anyMatch(item -> item.isImpliquee() && item.isResponsabiliteCivile())) {
            throw new BadRequestException("Renseignez la responsabilite RC (0, 50 ou 100)");
        }
        if (request.getGestionnaireId() != null) {
            sinistre.setGestionnaire(resolveGestionnaire(agenceId, request.getGestionnaireId()));
        }
        String nextAction = trimToNull(request.getProchaineAction());
        if (request.getDateEcheanceAction() != null && nextAction == null) {
            throw new BadRequestException("Renseignez la prochaine action associée à l'échéance");
        }
        if (nextAction != null && sinistre.getGestionnaire() == null) {
            throw new BadRequestException("Affectez un gestionnaire avant de planifier une action");
        }
        sinistre.setProchaineAction(nextAction);
        sinistre.setDateEcheanceAction(request.getDateEcheanceAction());
        sinistreRepository.save(sinistre);
        sinistreRepository.flush();
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.MODIFICATION,
                "Informations générales du sinistre mises à jour"
        );
        var detail = responseMapper.toDetail(sinistre);
        activityRecorder.record(ClaimActivity.command(sinistre, before, detail, ActivityAction.UPDATED,
                "Informations du sinistre modifiées", "CLAIM_GENERAL_INFORMATION"));
        return detail;
    }

    @Transactional
    public SinistreDetailResponse transition(
            Long agenceId,
            Long utilisateurId,
            Long id,
            TransitionSinistreRequest request
    ) {
        Utilisateur acteur = resolveCurrentUser(agenceId, utilisateurId);
        Sinistre sinistre = resolveForUpdate(agenceId, id);
        List<String> blockers = readinessService.blockers(sinistre, request.getStatut());
        if (!blockers.isEmpty()) {
            throw new BadRequestException(String.join(". ", blockers));
        }
        if (requiresReason(request.getStatut()) && !hasText(request.getMotif())) {
            throw new BadRequestException("Le motif est obligatoire pour ce changement de statut");
        }
        StatutSinistre ancien = sinistre.getStatut();
        EtapeSuiviSinistre ancienneEtape = sinistre.getEtapeSuivi();
        var before = ClaimActivity.snapshot(responseMapper.toDetail(sinistre));
        workflowService.transition(sinistre, request.getStatut());
        if (request.getStatut() == StatutSinistre.CLOTURE) {
            sinistre.setEtapeSuivi(EtapeSuiviSinistre.CLOTURE);
        } else if (request.getStatut() == StatutSinistre.ROUVERT
                && ancienneEtape == EtapeSuiviSinistre.CLOTURE) {
            sinistre.setEtapeSuivi(EtapeSuiviSinistre.COMPAGNIE);
        } else if (request.getStatut() == StatutSinistre.TRANSMIS_COMPAGNIE) {
            sinistre.setEtapeSuivi(EtapeSuiviSinistre.COMPAGNIE);
        }
        sinistreRepository.save(sinistre);
        sinistreRepository.flush();
        String description = "Statut modifié de " + ancien + " vers " + request.getStatut();
        if (hasText(request.getMotif())) {
            description += " : " + request.getMotif().trim();
        }
        if (ancienneEtape != sinistre.getEtapeSuivi()) {
            evenementService.recordStage(sinistre, acteur, ancienneEtape, sinistre.getEtapeSuivi(), description);
        }
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.CHANGEMENT_STATUT,
                description,
                ancien,
                request.getStatut()
        );
        var detail = responseMapper.toDetail(sinistre);
        var command = ClaimActivity.withReason(ClaimActivity.command(sinistre, before, detail,
                ClaimActivity.transitionAction(sinistre.getStatut()), "Statut du sinistre : " + ClaimActivity.label(sinistre.getStatut()),
                "CLAIM_STATUS_TRANSITION"), request.getMotif());
        if (!command.changes().isEmpty()) activityRecorder.record(command);
        return detail;
    }

    public Sinistre resolve(Long agenceId, Long id) {
        return sinistreRepository.findByIdAndAgenceId(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Sinistre", id));
    }

    public Sinistre resolveForUpdate(Long agenceId, Long id) {
        return sinistreRepository.findByIdAndAgenceIdForUpdate(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Sinistre", id));
    }

    public Utilisateur resolveCurrentUser(Long agenceId, Long utilisateurId) {
        if (utilisateurId == null) {
            throw new BadRequestException("Utilisateur courant introuvable");
        }
        Utilisateur utilisateur = utilisateurRepository.findById(utilisateurId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", utilisateurId));
        if (utilisateur.getAgence() != null && !Objects.equals(utilisateur.getAgence().getId(), agenceId)) {
            throw new ResourceNotFoundException("Utilisateur", utilisateurId);
        }
        return utilisateur;
    }

    private SinistreCouverture toCoverageSnapshot(
            Sinistre sinistre,
            SinistreCouvertureService.CouvertureResolue couverture
    ) {
        var vehicule = couverture.vehiculeSnapshot();
        return SinistreCouverture.builder()
                .sinistre(sinistre)
                .numeroPolice(couverture.contrat().getNumeroPolice())
                .numeroDossier(couverture.contrat().getNumeroDossier())
                .brancheCode(couverture.contrat().getBrancheAssurance() == null
                        ? null
                        : couverture.contrat().getBrancheAssurance().getCode())
                .brancheLibelle(couverture.contrat().getBrancheAssurance() == null
                        ? null
                        : couverture.contrat().getBrancheAssurance().getLibelle())
                .compagnieCode(couverture.contrat().getCompagnieAssurance().getCode())
                .compagnieLibelle(couverture.contrat().getCompagnieAssurance().getNom())
                .clientCode(couverture.assure().getCodeClient())
                .assure(couverture.assure().getNomAffichage())
                .dateEffet(couverture.contrat().getDateEffet())
                .dateEcheance(couverture.contrat().getDateEcheance())
                .immatriculation(vehicule == null ? null : vehicule.getImmatriculation())
                .numeroAttestation(vehicule == null ? null : vehicule.getNumeroAttestation())
                .marque(vehicule == null || vehicule.getMarque() == null
                        ? null
                        : vehicule.getMarque().getLibelle())
                .usageCode(vehicule == null || vehicule.getUsage() == null
                        ? null
                        : vehicule.getUsage().getCode())
                .usageLibelle(vehicule == null || vehicule.getUsage() == null
                        ? null
                        : vehicule.getUsage().getLibelle())
                .build();
    }

    private SinistreGarantie toGuaranteeSnapshot(
            Sinistre sinistre,
            MouvementGarantie source,
            boolean impliquee
    ) {
        return SinistreGarantie.builder()
                .sinistre(sinistre)
                .garantie(source.getGarantie())
                .mouvementGarantieSource(source)
                .impliquee(impliquee)
                .snapshotCode(source.getGarantie().getCode())
                .snapshotLibelle(source.getGarantie().getLibelle())
                .responsabiliteCivile(Boolean.TRUE.equals(source.getGarantie().getResponsabiliteCivile()))
                .snapshotCapital(source.getCapital())
                .snapshotPrime(source.getPrime())
                .snapshotTaux(source.getTaux())
                .snapshotTauxFranchise(source.getTauxFranchise())
                .snapshotFranchiseMinimale(source.getFranchiseMinimale())
                .decisionCouverture(DecisionCouvertureSinistre.A_ETUDIER)
                .build();
    }

    private void validateSelectedGuarantees(
            List<MouvementGarantie> garanties,
            Set<Long> selectedIds
    ) {
        Set<Long> available = garanties.stream()
                .map(item -> item.getGarantie().getId())
                .collect(java.util.stream.Collectors.toSet());
        if (!available.containsAll(selectedIds)) {
            throw new BadRequestException("Une garantie sélectionnée ne couvrait pas le risque à la date du sinistre");
        }
    }

    private void assertDeclarationReady(Set<Long> garanties) {
        if (garanties.isEmpty()) {
            throw new BadRequestException("Sélectionnez au moins une garantie impliquée");
        }
    }

    private void validateDeclarationDates(CreateSinistreRequest request) {
        LocalDate today = LocalDate.now();
        if (request.getDateSinistre().isAfter(today)) {
            throw new BadRequestException("La date du sinistre ne peut pas être future");
        }
        if (request.getDateDeclaration().isAfter(today)) {
            throw new BadRequestException("La date de déclaration ne peut pas être future");
        }
        if (request.getDateDeclaration().isBefore(request.getDateSinistre())) {
            throw new BadRequestException("La date de déclaration ne peut pas précéder le sinistre");
        }
    }

    private boolean requiresReason(StatutSinistre target) {
        return target == StatutSinistre.ANNULE
                || target == StatutSinistre.REJETE
                || target == StatutSinistre.ROUVERT;
    }

    private Utilisateur resolveGestionnaire(Long agenceId, Long gestionnaireId) {
        if (gestionnaireId == null) {
            return null;
        }
        Utilisateur gestionnaire = utilisateurRepository.findById(gestionnaireId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", gestionnaireId));
        if (gestionnaire.getAgence() == null || !Objects.equals(gestionnaire.getAgence().getId(), agenceId)) {
            throw new ResourceNotFoundException("Utilisateur", gestionnaireId);
        }
        return gestionnaire;
    }

    private Specification<Sinistre> specification(
            Long agenceId,
            String query,
            Long clientId,
            Long contratId,
            Long brancheId,
            StatutSinistre statut,
            com.assurance.enums.EtapeSuiviSinistre etapeSuivi,
            LocalDate dateDu,
            LocalDate dateAu
    ) {
        if (dateDu != null && dateAu != null && dateDu.isAfter(dateAu)) {
            throw new BadRequestException("La date de debut ne peut pas depasser la date de fin");
        }
        return (root, criteriaQuery, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
            predicates.add(builder.equal(root.get("agence").get("id"), agenceId));
            if (clientId != null) {
                predicates.add(builder.equal(root.get("client").get("id"), clientId));
            }
            if (contratId != null) {
                predicates.add(builder.equal(root.get("contrat").get("id"), contratId));
            }
            if (brancheId != null) {
                predicates.add(builder.equal(root.get("contrat").get("brancheAssurance").get("id"), brancheId));
            }
            if (statut != null) {
                predicates.add(builder.equal(root.get("statut"), statut));
            }
            if (etapeSuivi != null) {
                predicates.add(builder.equal(root.get("etapeSuivi"), etapeSuivi));
            }
            if (dateDu != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("dateSinistre"), dateDu));
            }
            if (dateAu != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("dateSinistre"), dateAu));
            }
            if (hasText(query)) {
                String pattern = "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
                var couverture = root.join("couverture", JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("numeroSinistre")), pattern),
                        builder.like(builder.lower(root.get("referenceCompagnie")), pattern),
                        builder.like(builder.lower(couverture.get("numeroPolice")), pattern),
                        builder.like(builder.lower(couverture.get("numeroDossier")), pattern),
                        builder.like(builder.lower(couverture.get("assure")), pattern),
                        builder.like(builder.lower(couverture.get("immatriculation")), pattern)
                ));
            }
            criteriaQuery.distinct(true);
            return builder.and(predicates.toArray(jakarta.persistence.criteria.Predicate[]::new));
        };
    }

    private String trimToNull(String value) {
        if (!hasText(value)) {
            return null;
        }
        return value.trim();
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
