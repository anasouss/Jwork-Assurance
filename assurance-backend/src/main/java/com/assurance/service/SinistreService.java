package com.assurance.service;

import com.assurance.dto.request.CreateSinistreRequest;
import com.assurance.dto.request.TransitionSinistreRequest;
import com.assurance.dto.request.UpdateSinistreRequest;
import com.assurance.dto.response.PageMetadata;
import com.assurance.dto.response.PagedResponse;
import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.dto.response.SinistreSummaryResponse;
import com.assurance.entity.MouvementGarantie;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreCouverture;
import com.assurance.entity.SinistreGarantie;
import com.assurance.entity.Utilisateur;
import com.assurance.entity.Ville;
import com.assurance.enums.DecisionCouvertureSinistre;
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
import com.assurance.repository.VilleRepository;
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
    private final VilleRepository villeRepository;
    private final SinistreCouvertureService couvertureService;
    private final SinistreNumeroService numeroService;
    private final SinistreWorkflowService workflowService;
    private final SinistreReadinessService readinessService;
    private final SinistreEvenementService evenementService;
    private final SinistreResponseMapper responseMapper;

    @Transactional
    public SinistreDetailResponse create(
            Long agenceId,
            Long utilisateurId,
            CreateSinistreRequest request
    ) {
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
            assertDeclarationReady(request.getCirconstances(), garantiesImpliquees);
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
                .nature(request.getNature())
                .dateSinistre(request.getDateSinistre())
                .heureSinistre(request.getHeureSinistre())
                .dateDeclaration(request.getDateDeclaration())
                .ville(resolveVille(request.getVilleId()))
                .lieu(trimToNull(request.getLieu()))
                .circonstances(trimToNull(request.getCirconstances()))
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
            StatutSinistre statut,
            com.assurance.enums.NatureSinistre nature,
            LocalDate dateDu,
            LocalDate dateAu,
            int page,
            int size
    ) {
        int safePage = Math.max(page, 0);
        int safeSize = Math.min(Math.max(size, 1), 100);
        Page<Sinistre> result = sinistreRepository.findAll(
                specification(agenceId, query, clientId, statut, nature, dateDu, dateAu),
                PageRequest.of(safePage, safeSize, Sort.by(Sort.Direction.DESC, "updatedAt"))
        );
        return PagedResponse.<SinistreSummaryResponse>builder()
                .items(result.getContent().stream().map(responseMapper::toSummary).toList())
                .page(PageMetadata.from(result))
                .build();
    }

    @Transactional
    public SinistreDetailResponse update(
            Long agenceId,
            Long utilisateurId,
            Long id,
            UpdateSinistreRequest request
    ) {
        Utilisateur acteur = resolveCurrentUser(agenceId, utilisateurId);
        Sinistre sinistre = resolve(agenceId, id);
        if (!workflowService.isEditable(sinistre.getStatut())) {
            throw new BadRequestException("Un sinistre clôturé ou annulé doit être rouvert avant modification");
        }
        sinistre.setReferenceCompagnie(trimToNull(request.getReferenceCompagnie()));
        sinistre.setVille(resolveVille(request.getVilleId()));
        sinistre.setLieu(trimToNull(request.getLieu()));
        sinistre.setCirconstances(trimToNull(request.getCirconstances()));
        sinistre.setNumeroPv(trimToNull(request.getNumeroPv()));
        sinistre.setTauxResponsabilite(request.getTauxResponsabilite());
        sinistre.setNotes(trimToNull(request.getNotes()));
        sinistre.setGestionnaire(resolveGestionnaire(agenceId, request.getGestionnaireId()));
        sinistreRepository.save(sinistre);
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.MODIFICATION,
                "Informations générales du sinistre mises à jour"
        );
        return responseMapper.toDetail(sinistre);
    }

    @Transactional
    public SinistreDetailResponse transition(
            Long agenceId,
            Long utilisateurId,
            Long id,
            TransitionSinistreRequest request
    ) {
        Utilisateur acteur = resolveCurrentUser(agenceId, utilisateurId);
        Sinistre sinistre = resolve(agenceId, id);
        List<String> blockers = readinessService.blockers(sinistre, request.getStatut());
        if (!blockers.isEmpty()) {
            throw new BadRequestException(String.join(". ", blockers));
        }
        if (requiresReason(request.getStatut()) && !hasText(request.getMotif())) {
            throw new BadRequestException("Le motif est obligatoire pour ce changement de statut");
        }
        StatutSinistre ancien = sinistre.getStatut();
        workflowService.transition(sinistre, request.getStatut());
        sinistreRepository.save(sinistre);
        String description = "Statut modifié de " + ancien + " vers " + request.getStatut();
        if (hasText(request.getMotif())) {
            description += " : " + request.getMotif().trim();
        }
        evenementService.record(
                sinistre,
                acteur,
                TypeEvenementSinistre.CHANGEMENT_STATUT,
                description,
                ancien,
                request.getStatut()
        );
        return responseMapper.toDetail(sinistre);
    }

    public Sinistre resolve(Long agenceId, Long id) {
        return sinistreRepository.findByIdAndAgenceId(id, agenceId)
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
        return SinistreCouverture.builder()
                .sinistre(sinistre)
                .numeroPolice(couverture.contrat().getNumeroPolice())
                .numeroDossier(couverture.contrat().getNumeroDossier())
                .compagnieCode(couverture.contrat().getCompagnieAssurance().getCode())
                .compagnieLibelle(couverture.contrat().getCompagnieAssurance().getNom())
                .clientCode(couverture.assure().getCodeClient())
                .assure(couverture.assure().getNomAffichage())
                .dateEffet(couverture.contrat().getDateEffet())
                .dateEcheance(couverture.contrat().getDateEcheance())
                .immatriculation(couverture.vehiculeSnapshot().getImmatriculation())
                .numeroAttestation(couverture.vehiculeSnapshot().getNumeroAttestation())
                .marque(couverture.vehiculeSnapshot().getMarque() == null
                        ? null
                        : couverture.vehiculeSnapshot().getMarque().getLibelle())
                .usageCode(couverture.vehiculeSnapshot().getUsage() == null
                        ? null
                        : couverture.vehiculeSnapshot().getUsage().getCode())
                .usageLibelle(couverture.vehiculeSnapshot().getUsage() == null
                        ? null
                        : couverture.vehiculeSnapshot().getUsage().getLibelle())
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
            throw new BadRequestException("Une garantie sélectionnée ne couvrait pas le véhicule à la date du sinistre");
        }
    }

    private void assertDeclarationReady(String circonstances, Set<Long> garanties) {
        if (!hasText(circonstances)) {
            throw new BadRequestException("Les circonstances sont obligatoires pour déclarer le sinistre");
        }
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

    private Ville resolveVille(Long villeId) {
        if (villeId == null) {
            return null;
        }
        return villeRepository.findById(villeId)
                .orElseThrow(() -> new ResourceNotFoundException("Ville", villeId));
    }

    private Specification<Sinistre> specification(
            Long agenceId,
            String query,
            Long clientId,
            StatutSinistre statut,
            com.assurance.enums.NatureSinistre nature,
            LocalDate dateDu,
            LocalDate dateAu
    ) {
        return (root, criteriaQuery, builder) -> {
            List<jakarta.persistence.criteria.Predicate> predicates = new java.util.ArrayList<>();
            predicates.add(builder.equal(root.get("agence").get("id"), agenceId));
            if (clientId != null) {
                predicates.add(builder.equal(root.get("client").get("id"), clientId));
            }
            if (statut != null) {
                predicates.add(builder.equal(root.get("statut"), statut));
            }
            if (nature != null) {
                predicates.add(builder.equal(root.get("nature"), nature));
            }
            if (dateDu != null) {
                predicates.add(builder.greaterThanOrEqualTo(root.get("dateSinistre"), dateDu));
            }
            if (dateAu != null) {
                predicates.add(builder.lessThanOrEqualTo(root.get("dateSinistre"), dateAu));
            }
            if (hasText(query)) {
                String pattern = "%" + query.trim().toLowerCase(Locale.ROOT) + "%";
                var client = root.join("client", JoinType.LEFT);
                var contrat = root.join("contrat", JoinType.LEFT);
                predicates.add(builder.or(
                        builder.like(builder.lower(root.get("numeroSinistre")), pattern),
                        builder.like(builder.lower(root.get("referenceCompagnie")), pattern),
                        builder.like(builder.lower(contrat.get("numeroPolice")), pattern),
                        builder.like(builder.lower(contrat.get("numeroDossier")), pattern),
                        builder.like(builder.lower(client.get("nom")), pattern),
                        builder.like(builder.lower(client.get("prenom")), pattern),
                        builder.like(builder.lower(client.get("raisonSociale")), pattern)
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
