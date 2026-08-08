package com.assurance.service;

import com.assurance.dto.response.SinistreDetailResponse;
import com.assurance.dto.response.SinistreSummaryResponse;
import com.assurance.entity.MissionExpertise;
import com.assurance.entity.ProvisionSinistre;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreCouverture;
import com.assurance.entity.SinistreDocument;
import com.assurance.entity.SinistreEvenement;
import com.assurance.entity.SinistreGarantie;
import com.assurance.entity.SinistreOperation;
import com.assurance.entity.SinistrePartie;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.TypeOperationSinistre;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreCouvertureRepository;
import com.assurance.repository.SinistreDocumentRepository;
import com.assurance.repository.SinistreEvenementRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistrePartieRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;

import java.math.BigDecimal;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Component
@RequiredArgsConstructor
public class SinistreResponseMapper {

    private final SinistreCouvertureRepository couvertureRepository;
    private final SinistreGarantieRepository garantieRepository;
    private final SinistrePartieRepository partieRepository;
    private final SinistreDocumentRepository documentRepository;
    private final MissionExpertiseRepository missionRepository;
    private final ProvisionSinistreRepository provisionRepository;
    private final SinistreOperationRepository operationRepository;
    private final SinistreEvenementRepository evenementRepository;
    private final SinistreReadinessService readinessService;

    public SinistreSummaryResponse toSummary(Sinistre sinistre) {
        SinistreCouverture couverture = resolveCouverture(sinistre);
        List<ProvisionSinistre> provisions = provisionRepository
                .findBySinistreIdOrderByDateProvisionDescCreatedAtDesc(sinistre.getId());
        List<SinistreOperation> operations = operationRepository
                .findBySinistreIdOrderByDateOperationDescCreatedAtDesc(sinistre.getId());
        Totaux totaux = totals(provisions, operations);
        return SinistreSummaryResponse.builder()
                .id(sinistre.getId())
                .numeroSinistre(sinistre.getNumeroSinistre())
                .referenceCompagnie(sinistre.getReferenceCompagnie())
                .statut(sinistre.getStatut())
                .nature(sinistre.getNature())
                .dateSinistre(sinistre.getDateSinistre())
                .dateDeclaration(sinistre.getDateDeclaration())
                .numeroPolice(couverture.getNumeroPolice())
                .numeroDossier(couverture.getNumeroDossier())
                .compagnie(couverture.getCompagnieLibelle())
                .assure(couverture.getAssure())
                .immatriculation(couverture.getImmatriculation())
                .gestionnaire(fullName(sinistre.getGestionnaire()))
                .provisionCourante(totaux.provision())
                .totalRegle(totaux.reglements())
                .totalRecours(totaux.recours())
                .updatedAt(sinistre.getUpdatedAt())
                .build();
    }

    public SinistreDetailResponse toDetail(Sinistre sinistre) {
        SinistreCouverture couverture = resolveCouverture(sinistre);
        List<SinistreGarantie> garanties = garantieRepository
                .findBySinistreIdOrderBySnapshotCode(sinistre.getId());
        List<SinistrePartie> parties = partieRepository
                .findBySinistreIdOrderByCreatedAt(sinistre.getId());
        List<SinistreDocument> documents = documentRepository
                .findBySinistreIdOrderByCreatedAtDesc(sinistre.getId());
        List<MissionExpertise> missions = missionRepository
                .findBySinistreIdOrderByDateMissionDescCreatedAtDesc(sinistre.getId());
        List<ProvisionSinistre> provisions = provisionRepository
                .findBySinistreIdOrderByDateProvisionDescCreatedAtDesc(sinistre.getId());
        List<SinistreOperation> operations = operationRepository
                .findBySinistreIdOrderByDateOperationDescCreatedAtDesc(sinistre.getId());
        List<SinistreEvenement> evenements = evenementRepository
                .findBySinistreIdOrderByCreatedAtDesc(sinistre.getId());
        Totaux totaux = totals(provisions, operations);
        BigDecimal totalIndemnisable = readinessService.totalIndemnisable(sinistre.getId());

        return SinistreDetailResponse.builder()
                .id(sinistre.getId())
                .version(sinistre.getVersion())
                .numeroSinistre(sinistre.getNumeroSinistre())
                .referenceCompagnie(sinistre.getReferenceCompagnie())
                .statut(sinistre.getStatut())
                .nature(sinistre.getNature())
                .dateSinistre(sinistre.getDateSinistre())
                .heureSinistre(sinistre.getHeureSinistre())
                .dateDeclaration(sinistre.getDateDeclaration())
                .dateTransmission(sinistre.getDateTransmission())
                .dateCloture(sinistre.getDateCloture())
                .villeId(sinistre.getVille() == null ? null : sinistre.getVille().getId())
                .ville(sinistre.getVille() == null ? null : sinistre.getVille().getNom())
                .lieu(sinistre.getLieu())
                .circonstances(sinistre.getCirconstances())
                .numeroPv(sinistre.getNumeroPv())
                .tauxResponsabilite(sinistre.getTauxResponsabilite())
                .notes(sinistre.getNotes())
                .gestionnaireId(sinistre.getGestionnaire() == null ? null : sinistre.getGestionnaire().getId())
                .gestionnaire(fullName(sinistre.getGestionnaire()))
                .couverture(toCoverage(sinistre, couverture))
                .totaux(SinistreDetailResponse.Totaux.builder()
                        .provisionCourante(totaux.provision())
                        .totalIndemnisable(totalIndemnisable)
                        .totalRegle(totaux.reglements())
                        .totalFrais(totaux.frais())
                        .totalRecours(totaux.recours())
                        .resteARegler(remaining(totalIndemnisable, totaux.reglements()))
                        .build())
                .garanties(garanties.stream().map(this::toGuarantee).toList())
                .parties(parties.stream().map(this::toParty).toList())
                .documents(documents.stream().map(this::toDocument).toList())
                .missionsExpertise(missions.stream().map(this::toMission).toList())
                .provisions(provisions.stream().map(this::toProvision).toList())
                .operations(operations.stream().map(this::toOperation).toList())
                .evenements(evenements.stream().map(this::toEvent).toList())
                .workflow(toWorkflow(sinistre, documents))
                .build();
    }

    private SinistreDetailResponse.Workflow toWorkflow(
            Sinistre sinistre,
            List<SinistreDocument> documents
    ) {
        return SinistreDetailResponse.Workflow.builder()
                .transitions(readinessService.transitions(sinistre).stream()
                        .map(item -> SinistreDetailResponse.Workflow.Transition.builder()
                                .statut(item.statut())
                                .autorisee(item.allowed())
                                .blocages(item.blockers())
                                .build())
                        .toList())
                .documentsRecus((int) documents.stream()
                        .filter(item -> item.getStatut() == com.assurance.enums.StatutDocumentSinistre.RECU)
                        .count())
                .documentsRejetes((int) documents.stream()
                        .filter(item -> item.getStatut() == com.assurance.enums.StatutDocumentSinistre.REJETE)
                        .count())
                .build();
    }

    private BigDecimal remaining(BigDecimal indemnity, BigDecimal paid) {
        BigDecimal result = indemnity.subtract(paid);
        return result.signum() < 0 ? BigDecimal.ZERO : result;
    }

    private SinistreCouverture resolveCouverture(Sinistre sinistre) {
        if (sinistre.getCouverture() != null) {
            return sinistre.getCouverture();
        }
        return couvertureRepository.findBySinistreId(sinistre.getId())
                .orElseThrow(() -> new IllegalStateException(
                        "Le snapshot de couverture du sinistre " + sinistre.getId() + " est absent"
                ));
    }

    private SinistreDetailResponse.Couverture toCoverage(
            Sinistre sinistre,
            SinistreCouverture couverture
    ) {
        return SinistreDetailResponse.Couverture.builder()
                .contratId(sinistre.getContrat().getId())
                .mouvementId(sinistre.getMouvementCouverture().getId())
                .numeroMouvement(sinistre.getMouvementCouverture().getNumeroMouvement())
                .numeroDossier(couverture.getNumeroDossier())
                .numeroPolice(couverture.getNumeroPolice())
                .compagnie(couverture.getCompagnieLibelle())
                .clientCode(couverture.getClientCode())
                .assure(couverture.getAssure())
                .dateEffet(couverture.getDateEffet())
                .dateEcheance(couverture.getDateEcheance())
                .vehiculeId(sinistre.getVehicule() == null ? null : sinistre.getVehicule().getId())
                .immatriculation(couverture.getImmatriculation())
                .numeroAttestation(couverture.getNumeroAttestation())
                .marque(couverture.getMarque())
                .usageCode(couverture.getUsageCode())
                .usageLibelle(couverture.getUsageLibelle())
                .build();
    }

    private SinistreDetailResponse.Garantie toGuarantee(SinistreGarantie item) {
        return SinistreDetailResponse.Garantie.builder()
                .id(item.getId())
                .garantieId(item.getGarantie().getId())
                .code(item.getSnapshotCode())
                .libelle(item.getSnapshotLibelle())
                .impliquee(item.isImpliquee())
                .capital(item.getSnapshotCapital())
                .prime(item.getSnapshotPrime())
                .taux(item.getSnapshotTaux())
                .tauxFranchise(item.getSnapshotTauxFranchise())
                .franchiseMinimale(item.getSnapshotFranchiseMinimale())
                .decisionCouverture(item.getDecisionCouverture())
                .franchiseAppliquee(item.getFranchiseAppliquee())
                .montantIndemnisable(item.getMontantIndemnisable())
                .build();
    }

    private SinistreDetailResponse.Partie toParty(SinistrePartie item) {
        return SinistreDetailResponse.Partie.builder()
                .id(item.getId())
                .type(item.getType())
                .nom(item.getNom())
                .telephone(item.getTelephone())
                .cin(item.getCin())
                .numeroPermis(item.getNumeroPermis())
                .immatriculation(item.getImmatriculation())
                .compagnieAdverse(item.getCompagnieAdverse())
                .numeroPoliceAdverse(item.getNumeroPoliceAdverse())
                .notes(item.getNotes())
                .build();
    }

    private SinistreDetailResponse.Document toDocument(SinistreDocument item) {
        return SinistreDetailResponse.Document.builder()
                .id(item.getId())
                .type(item.getType())
                .statut(item.getStatut())
                .nomFichier(item.getNomFichier())
                .contentType(item.getContentType())
                .tailleOctets(item.getTailleOctets())
                .commentaire(item.getCommentaire())
                .deposePar(fullName(item.getDeposePar()))
                .validePar(fullName(item.getValidePar()))
                .createdAt(item.getCreatedAt())
                .dateValidation(item.getDateValidation())
                .build();
    }

    private SinistreDetailResponse.Mission toMission(MissionExpertise item) {
        return SinistreDetailResponse.Mission.builder()
                .id(item.getId())
                .expertId(item.getExpert().getId())
                .expert(item.getExpertNomSnapshot())
                .garageId(item.getGarage() == null ? null : item.getGarage().getId())
                .garage(item.getGarageNomSnapshot())
                .referenceMission(item.getReferenceMission())
                .dateMission(item.getDateMission())
                .dateRapport(item.getDateRapport())
                .montantEstime(item.getMontantEstime())
                .montantAccepte(item.getMontantAccepte())
                .statut(item.getStatut())
                .notes(item.getNotes())
                .build();
    }

    private SinistreDetailResponse.Provision toProvision(ProvisionSinistre item) {
        return SinistreDetailResponse.Provision.builder()
                .id(item.getId())
                .dateProvision(item.getDateProvision())
                .montant(item.getMontant())
                .motif(item.getMotif())
                .saisiePar(fullName(item.getSaisiePar()))
                .createdAt(item.getCreatedAt())
                .build();
    }

    private SinistreDetailResponse.Operation toOperation(SinistreOperation item) {
        String counterparty = item.getContrepartieNomSnapshot();
        return SinistreDetailResponse.Operation.builder()
                .id(item.getId())
                .type(item.getType())
                .dateOperation(item.getDateOperation())
                .montant(item.getMontant())
                .reference(item.getReference())
                .compagnieAssuranceId(item.getCompagnieAssurance() == null
                        ? null
                        : item.getCompagnieAssurance().getId())
                .compagnieAssurance(item.getCompagnieAssurance() == null
                        ? null
                        : item.getCompagnieAssurance().getNom())
                .typeContrepartie(item.getTypeContrepartie())
                .contrepartieId(counterpartyId(item))
                .contrepartie(counterparty)
                .justificationContrepartieLibre(item.getJustificationContrepartieLibre())
                .beneficiaire(counterparty)
                .modeReglement(item.getModeReglement())
                .notes(item.getNotes())
                .operationAnnuleeId(item.getOperationAnnulee() == null ? null : item.getOperationAnnulee().getId())
                .saisiePar(fullName(item.getSaisiPar()))
                .createdAt(item.getCreatedAt())
                .build();
    }

    private Long counterpartyId(SinistreOperation item) {
        if (item.getTypeContrepartie() == null) {
            return null;
        }
        return switch (item.getTypeContrepartie()) {
            case CLIENT -> item.getContrepartieClient() == null
                    ? null
                    : item.getContrepartieClient().getId();
            case PARTIE -> item.getContrepartiePartie() == null
                    ? null
                    : item.getContrepartiePartie().getId();
            case EXPERT -> item.getContrepartieExpert() == null
                    ? null
                    : item.getContrepartieExpert().getId();
            case GARAGE -> item.getContrepartieGarage() == null
                    ? null
                    : item.getContrepartieGarage().getId();
            case AUTRE -> null;
        };
    }

    private SinistreDetailResponse.Evenement toEvent(SinistreEvenement item) {
        return SinistreDetailResponse.Evenement.builder()
                .id(item.getId())
                .type(item.getType())
                .description(item.getDescription())
                .ancienStatut(item.getAncienStatut())
                .nouveauStatut(item.getNouveauStatut())
                .utilisateur(fullName(item.getUtilisateur()))
                .createdAt(item.getCreatedAt())
                .build();
    }

    private Totaux totals(
            List<ProvisionSinistre> provisions,
            List<SinistreOperation> operations
    ) {
        Set<Long> cancelled = new HashSet<>();
        operations.stream()
                .filter(item -> item.getType() == TypeOperationSinistre.ANNULATION)
                .filter(item -> item.getOperationAnnulee() != null)
                .map(item -> item.getOperationAnnulee().getId())
                .forEach(cancelled::add);
        List<SinistreOperation> active = operations.stream()
                .filter(item -> item.getType() != TypeOperationSinistre.ANNULATION)
                .filter(item -> !cancelled.contains(item.getId()))
                .toList();
        BigDecimal provision = provisions.isEmpty() ? BigDecimal.ZERO : provisions.get(0).getMontant();
        BigDecimal reglements = sum(active, TypeOperationSinistre.REGLEMENT);
        BigDecimal frais = sum(active, TypeOperationSinistre.FRAIS);
        BigDecimal recours = sum(active, TypeOperationSinistre.RECOURS);
        return new Totaux(provision, reglements, frais, recours);
    }

    private BigDecimal sum(List<SinistreOperation> operations, TypeOperationSinistre type) {
        return operations.stream()
                .filter(item -> item.getType() == type)
                .map(SinistreOperation::getMontant)
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    private String fullName(Utilisateur utilisateur) {
        return utilisateur == null ? null : utilisateur.getFullName();
    }

    private record Totaux(
            BigDecimal provision,
            BigDecimal reglements,
            BigDecimal frais,
            BigDecimal recours
    ) {
    }
}
