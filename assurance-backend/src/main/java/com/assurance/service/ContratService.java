package com.assurance.service;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.request.ConvertirProspectionRequest;
import com.assurance.dto.request.AvenantRequest;
import com.assurance.dto.request.MouvementContratRequest;
import com.assurance.dto.request.UpsertAssistanceContratRequest;
import com.assurance.dto.response.AssistanceContratResponse;
import com.assurance.dto.response.AvenantDraftSummaryResponse;
import com.assurance.dto.response.ClientResponse;
import com.assurance.dto.response.ContratResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.entity.*;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.ModeTermeRenouvellement;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
import com.assurance.enums.TypeMouvementStockAttestation;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.text.Normalizer;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class ContratService {

    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final ConventionRepository conventionRepository;
    private final ClientRepository clientRepository;
    private final ContratRepository contratRepository;
    private final NumeroDossierSequenceRepository numeroDossierSequenceRepository;
    private final ContratClientRepository contratClientRepository;
    private final VehiculeRepository vehiculeRepository;
    private final RemorqueRepository remorqueRepository;
    private final GarantieRepository garantieRepository;
    private final ContratGarantieRepository contratGarantieRepository;
    private final LigneGrilleTarifaireRepository ligneGrilleTarifaireRepository;
    private final UsageRepository usageRepository;
    private final GrilleTarifaireRepository grilleTarifaireRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final CategorieTransportRepository categorieTransportRepository;
    private final FormuleGarantiePersonneRepository formuleGarantiePersonneRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final AssistanceContratService assistanceContratService;
    private final ClientService clientService;
    private final GroupeClientService groupeClientService;
    private final CalculGarantieService calculGarantieService;
    private final QuittanceCalculService quittanceCalculService;
    private final ElementFacturableCibleService elementFacturableCibleService;
    private final MouvementContratService mouvementContratService;
    private final MouvementContratRepository mouvementContratRepository;
    private final AvenantDraftRepository avenantDraftRepository;
    private final AvenantDraftService avenantDraftService;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final MouvementRemorqueRepository mouvementRemorqueRepository;
    private final MouvementGarantieRepository mouvementGarantieRepository;
    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final ElementFacturableRepository elementFacturableRepository;
    private final ElementFacturableCibleRepository elementFacturableCibleRepository;
    private final PieceJointeRepository pieceJointeRepository;
    private final CarteVerteRepository carteVerteRepository;
    private final MouvementStockAttestationRepository mouvementStockAttestationRepository;
    private final AttestationStockService attestationStockService;
    private final EcheanceService echeanceService;

    @Transactional
    public ContratResponse create(CreateContratRequest request) {
        return createContrat(request);
    }

    @Transactional
    public ContratResponse createRenouvellementDraft(
            Long agenceId,
            Long contratOrigineId,
            ModeTermeRenouvellement modeTerme
    ) {
        Contrat source = contratRepository.findByAgenceIdAndId(agenceId, contratOrigineId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratOrigineId));
        validateRenewalSource(source, modeTerme);

        Contrat existingDraft = contratRepository
                .findFirstByAgenceIdAndContratOrigineIdAndStatutAndBrouillonTrueOrderByCreatedAtDesc(
                        agenceId,
                        contratOrigineId,
                        StatutContrat.DRAFT
                )
                .orElse(null);
        if (existingDraft != null) {
            return toResponse(existingDraft);
        }

        List<DraftAssistanceSnapshot> assistanceSnapshots = snapshotDraftAssistances(source);
        CreateContratRequest request = buildRenewalDraftRequest(source, modeTerme);
        Contrat draft = Contrat.builder()
                .agence(source.getAgence())
                .contratOrigine(source)
                .typeContrat(source.getTypeContrat())
                .modeTermeRenouvellement(modeTerme)
                .statut(StatutContrat.DRAFT)
                .brouillon(true)
                .prospection(false)
                .build();
        draft = contratRepository.save(draft);
        applyDraftRequest(draft, request);
        restoreRenewalDraftAssistances(draft, activeVehicules(draft), assistanceSnapshots);
        return toResponse(draft);
    }

    @Transactional
    public ContratResponse createDraft(CreateContratRequest request) {
        if (request.getAgenceId() == null) {
            throw new BadRequestException("L'agence est obligatoire");
        }
        if (request.getTypeContrat() == null) {
            throw new BadRequestException("Le type de contrat est obligatoire");
        }
        Agence agence = agenceRepository.findById(request.getAgenceId())
                .orElseThrow(() -> new ResourceNotFoundException("Agence", request.getAgenceId()));
        Contrat contrat = Contrat.builder()
                .agence(agence)
                .typeContrat(request.getTypeContrat())
                .statut(StatutContrat.DRAFT)
                .brouillon(true)
                .build();
        contrat = contratRepository.save(contrat);
        applyDraftRequest(contrat, request);
        return toResponse(contrat);
    }

    @Transactional(readOnly = true)
    public ContratResponse getDraft(Long agenceId, Long contratId) {
        Contrat contrat = resolveEditableContrat(agenceId, contratId);
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse updateDraft(Long agenceId, Long contratId, CreateContratRequest request) {
        Contrat contrat = resolveEditableContrat(agenceId, contratId);
        request.setAgenceId(agenceId);
        enforceRenewalPeriod(contrat, request);
        if (isCorrectionAffaireNouvelle(contrat)) {
            return appliquerCorrectionAffaireNouvelle(contrat, request);
        }
        applyDraftRequest(contrat, request);
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse saveDraftVehicule(Long agenceId, Long contratId, int index, CreateContratRequest.VehiculeInput input) {
        Contrat contrat = resolveEditableContrat(agenceId, contratId);
        enforceRenewalPeriod(contrat, input);
        saveVehiculeTarget(contrat, index, input);
        rafraichirCorrectionAffaireNouvelleSiNecessaire(contrat, null);
        return toResponse(contrat);
    }

    private ContratResponse saveVehiculeTarget(Contrat contrat, int index, CreateContratRequest.VehiculeInput input) {
        if (index < 0) {
            throw new BadRequestException("Index vehicule invalide");
        }
        validateDraftVehiculeInput(contrat, input);
        List<Vehicule> existing = vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        if (index > existing.size()) {
            throw new BadRequestException("Enregistrez les vehicules dans l'ordre");
        }
        Vehicule vehicule = index < existing.size() ? existing.get(index) : new Vehicule();
        vehicule.setContrat(contrat);
        applyVehiculeInput(contrat, vehicule, input);
        vehicule.setActif(true);
        vehiculeRepository.save(vehicule);
        if (!contrat.getVehicules().contains(vehicule)) {
            contrat.getVehicules().add(vehicule);
        }
        contrat.setNombreVehicules(Math.max(contrat.getNombreVehicules() == null ? 0 : contrat.getNombreVehicules(), index + 1));
        contratRepository.save(contrat);
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse saveDraftVehiculeGaranties(Long agenceId, Long contratId, int index, List<CreateContratRequest.GarantieInput> inputs) {
        Contrat contrat = resolveEditableContrat(agenceId, contratId);
        MouvementContrat mouvementInitial = preparerCorrectionAffaireNouvelleSiNecessaire(contrat);
        saveVehiculeGarantiesTarget(contrat, index, inputs);
        rafraichirCorrectionAffaireNouvelleSiNecessaire(contrat, mouvementInitial);
        return toResponse(contrat);
    }

    private ContratResponse saveVehiculeGarantiesTarget(Contrat contrat, int index, List<CreateContratRequest.GarantieInput> inputs) {
        List<Vehicule> existing = vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        Vehicule vehicule = resolveVehicule(existing, index, "Vehicule");
        contratGarantieRepository.deleteByContratIdAndVehiculeId(contrat.getId(), vehicule.getId());
        contratGarantieRepository.flush();
        contrat.getGaranties().removeIf(garantie -> garantie.getVehicule() != null && vehicule.getId().equals(garantie.getVehicule().getId()));
        for (CreateContratRequest.GarantieInput input : inputs == null ? List.<CreateContratRequest.GarantieInput>of() : inputs) {
            if (input.getGarantieId() == null) {
                continue;
            }
            ContratGarantie contratGarantie = saveCalculatedDraftGarantieForTarget(contrat, input, vehicule, null);
            contrat.getGaranties().add(contratGarantie);
        }
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse saveDraftRemorque(Long agenceId, Long contratId, int index, CreateContratRequest.RemorqueInput input) {
        Contrat contrat = resolveEditableContrat(agenceId, contratId);
        enforceRenewalPeriod(contrat, input);
        saveRemorqueTarget(contrat, index, input);
        rafraichirCorrectionAffaireNouvelleSiNecessaire(contrat, null);
        return toResponse(contrat);
    }

    private ContratResponse saveRemorqueTarget(Contrat contrat, int index, CreateContratRequest.RemorqueInput input) {
        if (index < 0) {
            throw new BadRequestException("Index remorque invalide");
        }
        validateDraftRemorqueInput(input);
        List<Remorque> existing = remorqueRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        if (index > existing.size()) {
            throw new BadRequestException("Enregistrez les remorques dans l'ordre");
        }
        Remorque remorque = index < existing.size() ? existing.get(index) : new Remorque();
        remorque.setContrat(contrat);
        applyRemorqueInput(contrat, remorque, input);
        remorque.setActif(true);
        remorqueRepository.save(remorque);
        if (!contrat.getRemorques().contains(remorque)) {
            contrat.getRemorques().add(remorque);
        }
        contrat.setNombreRemorques(Math.max(contrat.getNombreRemorques() == null ? 0 : contrat.getNombreRemorques(), index + 1));
        contratRepository.save(contrat);
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse saveDraftRemorqueGaranties(Long agenceId, Long contratId, int index, List<CreateContratRequest.GarantieInput> inputs) {
        Contrat contrat = resolveEditableContrat(agenceId, contratId);
        MouvementContrat mouvementInitial = preparerCorrectionAffaireNouvelleSiNecessaire(contrat);
        saveRemorqueGarantiesTarget(contrat, index, inputs);
        rafraichirCorrectionAffaireNouvelleSiNecessaire(contrat, mouvementInitial);
        return toResponse(contrat);
    }

    private ContratResponse saveRemorqueGarantiesTarget(Contrat contrat, int index, List<CreateContratRequest.GarantieInput> inputs) {
        List<Remorque> existing = remorqueRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        Remorque remorque = resolveRemorque(existing, index, "Remorque");
        contratGarantieRepository.deleteByContratIdAndRemorqueId(contrat.getId(), remorque.getId());
        contratGarantieRepository.flush();
        contrat.getGaranties().removeIf(garantie -> garantie.getRemorque() != null && remorque.getId().equals(garantie.getRemorque().getId()));
        for (CreateContratRequest.GarantieInput input : inputs == null ? List.<CreateContratRequest.GarantieInput>of() : inputs) {
            if (input.getGarantieId() == null) {
                continue;
            }
            ContratGarantie contratGarantie = saveCalculatedDraftGarantieForTarget(contrat, input, null, remorque);
            contrat.getGaranties().add(contratGarantie);
        }
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse finalizeDraft(Long agenceId, Long contratId, CreateContratRequest request) {
        Contrat contrat = resolveEditableContrat(agenceId, contratId);
        request.setAgenceId(agenceId);
        Contrat contratOrigine = contrat.getContratOrigine();
        boolean correctionContratActif = isCorrectionAffaireNouvelle(contrat);
        if (contratOrigine != null) {
            request.setModeTermeRenouvellement(contrat.getModeTermeRenouvellement());
            enforceRenewalPeriod(contrat, request);
            if (!correctionContratActif) {
                validateRenewalSource(contratOrigine, contrat.getModeTermeRenouvellement());
            }
        }
        if (hasText(request.getNumeroContrat())
                && contratRepository.existsByAgenceIdAndNumeroContratAndIdNot(agenceId, request.getNumeroContrat(), contrat.getId())) {
            throw new BadRequestException("Numero de contrat deja utilise pour cette agence");
        }
        if (correctionContratActif) {
            return appliquerCorrectionAffaireNouvelle(contrat, request);
        }
        PersistedDraftGraph graph = applyFinalRequestToExistingContrat(contrat, request);
        if (!hasText(contrat.getNumeroDossier())) {
            contrat.setNumeroDossier(nextNumeroDossier(contrat.getAgence(), contrat.getCompagnieAssurance(), contrat.getDateEffet()));
        }
        boolean prospection = Boolean.TRUE.equals(request.getProspection());
        if (prospection && !hasText(contrat.getNumeroDevis())) {
            contrat.setNumeroDevis(nextNumeroDevis(contrat.getAgence(), contrat.getCompagnieAssurance()));
        }
        contrat.setProspection(prospection);
        contrat.setStatut(prospection ? StatutContrat.DRAFT : StatutContrat.ACTIVE);
        contrat.setBrouillon(false);
        contratRepository.save(contrat);
        refreshDraftAssistanceReferences(contrat, graph.assistances());
        if (!prospection) {
            if (contratOrigine == null) {
                mouvementContratService.creerAffaireNouvelle(
                        contrat,
                        graph.vehicules(),
                        graph.remorques(),
                        graph.garanties(),
                        graph.quittanceManuelle()
                );
            } else {
                mouvementContratService.creerRenouvellement(
                        contrat,
                        contratOrigine,
                        graph.vehicules(),
                        graph.remorques(),
                        graph.garanties()
                );
                contratOrigine.setRenouvele(true);
                contratOrigine.setStatut(StatutContrat.RENEWED);
                contratRepository.save(contratOrigine);
            }
        }
        return toResponse(contrat);
    }

    private ContratResponse createContrat(CreateContratRequest request) {
        validateContractReference(request);
        validateConventionReglement(request);
        if (hasText(request.getNumeroContrat()) && contratRepository.existsByAgenceIdAndNumeroContrat(request.getAgenceId(), request.getNumeroContrat())) {
            throw new BadRequestException("Numero de contrat deja utilise pour cette agence");
        }

        Agence agence = agenceRepository.findById(request.getAgenceId())
                .orElseThrow(() -> new ResourceNotFoundException("Agence", request.getAgenceId()));
        CompagnieAssurance compagnie = request.getCompagnieAssuranceId() == null ? null :
                compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                        .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        Convention convention = request.getConventionId() == null ? null :
                conventionRepository.findByAgenceIdAndId(request.getAgenceId(), request.getConventionId())
                        .orElseThrow(() -> new ResourceNotFoundException("Convention", request.getConventionId()));
        Usage usageContrat = request.getUsageId() == null ? null :
                usageRepository.findById(request.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        GrilleTarifaire grilleTarifaire = request.getGrilleTarifaireId() == null ? null :
                grilleTarifaireRepository.findById(request.getGrilleTarifaireId())
                        .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", request.getGrilleTarifaireId()));
        ModeSaisieGarantieContrat modeSaisieGaranties = resolveModeSaisieGaranties(request);
        boolean saisiePrimeNette = Boolean.TRUE.equals(request.getSaisiePrimeNette())
                || modeSaisieGaranties == ModeSaisieGarantieContrat.MANUELLE_AVEC_PRIME_NETTE;
        validateModeSaisiePourTypeContrat(request, modeSaisieGaranties, convention);
        if (modeSaisieGaranties == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE && grilleTarifaire == null) {
            throw new BadRequestException("Une grille tarifaire est obligatoire pour un contrat convention ou flotte");
        }
        ContractDates contractDates = resolveContractDates(request);

        Contrat contrat = Contrat.builder()
                .agence(agence)
                .compagnieAssurance(compagnie)
                .convention(convention)
                .usage(usageContrat)
                .grilleTarifaire(grilleTarifaire)
                .modeTermeRenouvellement(request.getModeTermeRenouvellement())
                .typeContrat(request.getTypeContrat())
                .numeroContrat(request.getNumeroContrat())
                .numeroDevis(request.getNumeroDevis())
                .numeroDossier(nextNumeroDossier(agence, compagnie, contractDates.dateEffet()))
                .numeroPolice(request.getNumeroPolice())
                .numeroAttestation(request.getNumeroAttestation())
                .dateEffet(contractDates.dateEffet())
                .dateEcheance(contractDates.dateEcheance())
                .echeance(contractDates.echeance())
                .typeRenouvellement(blankToNull(request.getTypeRenouvellement()))
                .modePaiement(request.getModePaiement())
                .modeReglement(request.getModeReglement())
                .numeroBonCommande(request.getNumeroBonCommande())
                .montantBulletin(request.getMontantBulletin())
                .periodicite(request.getPeriodicite())
                .fractionnement(request.getFractionnement())
                .tauxRc(request.getTauxRc())
                .modeSaisieGaranties(modeSaisieGaranties)
                .saisiePrimeNette(saisiePrimeNette)
                .nombreVehicules(request.getNombreVehicules())
                .nombreRemorques(request.getNombreRemorques())
                .prospection(request.getProspection() == null ? false : request.getProspection())
                .assistance(request.getAssistance() == null ? false : request.getAssistance())
                .crmPartage(request.getCrmPartage() == null ? false : request.getCrmPartage())
                .crmPartageValeur(request.getCrmPartageValeur())
                .notes(request.getNotes())
                .build();
        if (Boolean.TRUE.equals(contrat.getProspection()) && !hasText(contrat.getNumeroDevis())) {
            contrat.setNumeroDevis(nextNumeroDevis(agence, compagnie));
        }
        contrat = contratRepository.save(contrat);

        saveClientLinks(contrat, request.getClients(), request.getAgenceId(), Map.of(), true);
        applyContractBilling(contrat, request, true);

        List<Vehicule> vehiculesCrees = new ArrayList<>();
        for (CreateContratRequest.VehiculeInput input : request.getVehicules() == null ? List.<CreateContratRequest.VehiculeInput>of() : request.getVehicules()) {
            Usage usage = input.getUsageId() == null ? usageContrat : usageRepository.findById(input.getUsageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
            Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), true);
            Carrosserie carrosserie = resolveCarrosserie(input.getCarrosserieId(), input.getCarrosserieLibelle(), true);
            CategorieTransport categorieTransport = resolveCategorieTransport(input.getCategorieTransportId());
            validateCategorieTransport(usage, categorieTransport);
            Vehicule vehicule = vehiculeRepository.save(Vehicule.builder()
                    .contrat(contrat)
                    .typeVehicule(input.getTypeVehicule())
                    .usage(usage)
                    .marque(marque)
                    .carrosserie(carrosserie)
                    .categorieTransport(categorieTransport)
                    .immatriculation(input.getImmatriculation())
                    .immatriculationProvisoire(input.getImmatriculationProvisoire())
                    .carburant(input.getCarburant())
                    .puissanceFiscale(input.getPuissanceFiscale())
                    .nombrePlaces(input.getNombrePlaces())
                    .sousClasse(input.getSousClasse())
                    .ptc(input.getPtc())
                    .datePremiereCirculation(input.getDatePremiereCirculation())
                    .dateExpirationCarteGrise(input.getDateExpirationCarteGrise())
                    .dateEffet(firstNonNull(input.getDateEffet(), contractDates.dateEffet()))
                    .dateEcheance(firstNonNull(input.getDateEcheance(), contractDates.dateEcheance()))
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .remorque(input.getRemorque() == null ? false : input.getRemorque())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurVenale(input.getValeurVenale())
                    .valeurNeuf(input.getValeurNeuf())
                    .valeurGlace(input.getValeurGlace())
                    .organismeCredit(input.getOrganismeCredit() == null ? false : input.getOrganismeCredit())
                    .nomOrganismeCredit(input.getNomOrganismeCredit())
                    .montantCredit(input.getMontantCredit())
                    .dateFinCredit(input.getDateFinCredit())
                    .build());
            vehiculesCrees.add(vehicule);
            contrat.getVehicules().add(vehicule);
        }

        List<Remorque> remorquesCreees = new ArrayList<>();
        for (CreateContratRequest.RemorqueInput input : request.getRemorques() == null ? List.<CreateContratRequest.RemorqueInput>of() : request.getRemorques()) {
            Usage usage = input.getUsageId() == null ? usageContrat : usageRepository.findById(input.getUsageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
            Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), true);
            Remorque remorque = remorqueRepository.save(Remorque.builder()
                    .contrat(contrat)
                    .usage(usage)
                    .marque(marque)
                    .immatriculation(input.getImmatriculation())
                    .ptc(input.getPtc())
                    .dateMiseEnCirculation(input.getDateMiseEnCirculation())
                    .dateEffet(firstNonNull(input.getDateEffet(), contractDates.dateEffet()))
                    .dateEcheance(firstNonNull(input.getDateEcheance(), contractDates.dateEcheance()))
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurAssuree(input.getValeurAssuree())
                    .build());
            remorquesCreees.add(remorque);
            contrat.getRemorques().add(remorque);
        }

        List<ContratGarantie> garantiesCreees = new ArrayList<>();
        for (CreateContratRequest.GarantieInput input : request.getGaranties() == null ? List.<CreateContratRequest.GarantieInput>of() : request.getGaranties()) {
            Garantie garantie = garantieRepository.findById(input.getGarantieId())
                    .orElseThrow(() -> new ResourceNotFoundException("Garantie", input.getGarantieId()));
            Client client = input.getClientId() == null ? null :
                    clientRepository.findByAgenceIdAndId(request.getAgenceId(), input.getClientId())
                            .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
            Vehicule vehicule = input.getVehiculeIndex() == null ? null : resolveVehicule(vehiculesCrees, input.getVehiculeIndex(), "Garantie");
            Remorque remorque = input.getRemorqueIndex() == null ? null : resolveRemorque(remorquesCreees, input.getRemorqueIndex(), "Garantie");
            Usage usageCible = resolveUsageCible(contrat, vehicule, remorque);
            LigneGrilleTarifaire ligneGrilleTarifaire = resolveLigneGrilleTarifaire(contrat, garantie, input, usageCible, vehicule, remorque);
            ModeTarificationGarantie modeSelectionne = resolveModeSelectionne(garantie, ligneGrilleTarifaire, input);
            SourceValeurGarantie sourceValeurSelectionnee = resolveSourceValeurSelectionnee(garantie, input, modeSelectionne, remorque);
            FormuleGarantiePersonne formuleGarantiePersonne = resolveFormuleGarantiePersonne(input.getFormuleGarantiePersonneId(), contrat, garantie, usageCible);
            GarantieMontants montants = resolveGarantieMontants(contrat, input, garantie, ligneGrilleTarifaire, vehicule, remorque, usageCible, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne);
            validateGarantieTarget(garantie, vehicule, remorque, client);
            validateGarantieConfiguration(contrat, garantie, input, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne, ligneGrilleTarifaire, montants);
            validateLigneGrilleTarifaire(contrat, garantie, ligneGrilleTarifaire, modeSelectionne, usageCible, vehicule);
            ContratGarantie contratGarantie = contratGarantieRepository.save(ContratGarantie.builder()
                    .contrat(contrat)
                    .garantie(garantie)
                    .vehicule(vehicule)
                    .remorque(remorque)
                    .client(client)
                    .ligneGrilleTarifaire(ligneGrilleTarifaire)
                    .modeSelectionne(modeSelectionne)
                    .sourceValeurSelectionnee(sourceValeurSelectionnee)
                    .formuleGarantiePersonne(formuleGarantiePersonne)
                    .valeurVenale(montants.valeurVenale())
                    .valeurNeuf(montants.valeurNeuf())
                    .valeurGlace(montants.valeurGlace())
                    .formule(montants.formule())
                    .montantDeces(montants.montantDeces())
                    .montantInvalidite(montants.montantInvalidite())
                    .montantFraisMedicaux(montants.montantFraisMedicaux())
                    .montantFraisHospitalisation(montants.montantFraisHospitalisation())
                    .montantFraisFuneraires(montants.montantFraisFuneraires())
                    .montantFraisChirurgie(montants.montantFraisChirurgie())
                    .accessoire(montants.accessoire())
                    .capital(montants.capital())
                    .taux(montants.taux())
                    .prime(montants.prime())
                    .tauxFranchise(montants.tauxFranchise())
                    .franchiseMinimale(montants.franchiseMinimale())
                .build());
            garantiesCreees.add(contratGarantie);
            contrat.getGaranties().add(contratGarantie);
        }

        QuittanceCalculService.Resultat quittanceManuelle = buildManualQuittanceResult(request);
        if (!Boolean.TRUE.equals(contrat.getProspection())) {
            mouvementContratService.creerAffaireNouvelle(
                    contrat,
                    vehiculesCrees,
                    remorquesCreees,
                    garantiesCreees,
                    quittanceManuelle
            );
        }

        return toResponse(contrat);
    }

    private Contrat resolveDraft(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        boolean editableProspection = Boolean.TRUE.equals(contrat.getProspection())
                && contrat.getTypeContrat() == TypeContrat.FLOTTE
                && contrat.getStatut() == StatutContrat.DRAFT;
        if ((!Boolean.TRUE.equals(contrat.getBrouillon()) && !editableProspection)
                || contrat.getStatut() != StatutContrat.DRAFT) {
            throw new BadRequestException("Ce contrat n'est pas un brouillon modifiable");
        }
        return contrat;
    }

    private Contrat resolveEditableContrat(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        boolean editableProspection = Boolean.TRUE.equals(contrat.getProspection())
                && contrat.getTypeContrat() == TypeContrat.FLOTTE
                && contrat.getStatut() == StatutContrat.DRAFT;
        boolean editableDraft = contrat.getStatut() == StatutContrat.DRAFT
                && (Boolean.TRUE.equals(contrat.getBrouillon()) || editableProspection);
        if (editableDraft) {
            return contrat;
        }
        if (isCorrectionAffaireNouvelle(contrat)) {
            mouvementContratService.assertCorrectionInitialeAutorisee(contrat);
            return contrat;
        }
        throw new BadRequestException("Ce contrat n'est pas modifiable directement");
    }

    private boolean isCorrectionAffaireNouvelle(Contrat contrat) {
        return contrat.getStatut() == StatutContrat.ACTIVE
                && !Boolean.TRUE.equals(contrat.getBrouillon())
                && !Boolean.TRUE.equals(contrat.getProspection());
    }

    private ContratResponse appliquerCorrectionAffaireNouvelle(Contrat contrat, CreateContratRequest request) {
        request.setProspection(false);
        if (hasText(request.getNumeroContrat())
                && contratRepository.existsByAgenceIdAndNumeroContratAndIdNot(request.getAgenceId(), request.getNumeroContrat(), contrat.getId())) {
            throw new BadRequestException("Numero de contrat deja utilise pour cette agence");
        }
        appliquerScalairesFinaux(contrat, request);
        contrat.setStatut(StatutContrat.ACTIVE);
        contrat.setBrouillon(false);
        contrat.setProspection(false);
        contratRepository.save(contrat);

        MouvementContrat mouvementInitial = mouvementContratService.preparerCorrectionInitiale(contrat);
        remplacerLiensClientsCorrection(contrat, request);
        List<Vehicule> vehiculesActifs = remplacerVehiculesCorrection(contrat, request);
        List<Remorque> remorquesActives = remplacerRemorquesCorrection(contrat, request);
        contratGarantieRepository.deleteByContratId(contrat.getId());
        contratGarantieRepository.flush();
        contrat.getGaranties().clear();
        List<ContratGarantie> garantiesActives = replaceFinalGaranties(contrat, request, vehiculesActifs, remorquesActives);
        updateTargetCounts(contrat);
        mouvementContratService.rafraichirCorrectionInitiale(
                contrat,
                mouvementInitial,
                vehiculesActifs,
                remorquesActives,
                garantiesActives,
                buildManualQuittanceResult(request)
        );
        return toResponse(contrat);
    }

    private void appliquerScalairesFinaux(Contrat contrat, CreateContratRequest request) {
        if (request.getAgenceId() == null) {
            throw new BadRequestException("L'agence est obligatoire");
        }
        if (request.getTypeContrat() == null) {
            throw new BadRequestException("Le type de contrat est obligatoire");
        }
        validateContractReference(request);
        validateConventionReglement(request);
        CompagnieAssurance compagnie = request.getCompagnieAssuranceId() == null ? null :
                compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                        .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        Convention convention = request.getConventionId() == null ? null :
                conventionRepository.findByAgenceIdAndId(request.getAgenceId(), request.getConventionId())
                        .orElseThrow(() -> new ResourceNotFoundException("Convention", request.getConventionId()));
        Usage usageContrat = request.getUsageId() == null ? null :
                usageRepository.findById(request.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        GrilleTarifaire grilleTarifaire = request.getGrilleTarifaireId() == null ? null :
                grilleTarifaireRepository.findById(request.getGrilleTarifaireId())
                        .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", request.getGrilleTarifaireId()));
        ModeSaisieGarantieContrat modeSaisieGaranties = resolveModeSaisieGaranties(request);
        boolean saisiePrimeNette = Boolean.TRUE.equals(request.getSaisiePrimeNette())
                || modeSaisieGaranties == ModeSaisieGarantieContrat.MANUELLE_AVEC_PRIME_NETTE;
        validateModeSaisiePourTypeContrat(request, modeSaisieGaranties, convention);
        if (modeSaisieGaranties == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE && grilleTarifaire == null) {
            throw new BadRequestException("Une grille tarifaire est obligatoire pour un contrat convention ou flotte");
        }
        applyContratScalars(
                contrat,
                request,
                compagnie,
                convention,
                usageContrat,
                grilleTarifaire,
                modeSaisieGaranties,
                saisiePrimeNette,
                resolveContractDates(request)
        );
    }

    private void remplacerLiensClientsCorrection(Contrat contrat, CreateContratRequest request) {
        Map<String, Client> existingClients = new HashMap<>();
        for (ContratClient link : contrat.getClients()) {
            existingClients.put(clientDraftKey(link.getRole(), Boolean.TRUE.equals(link.getPrincipalPourRole())), link.getClient());
        }
        contratClientRepository.deleteByContratId(contrat.getId());
        contratClientRepository.flush();
        contrat.getClients().clear();
        saveClientLinks(contrat, request.getClients(), request.getAgenceId(), existingClients, true);
    }

    private List<Vehicule> remplacerVehiculesCorrection(Contrat contrat, CreateContratRequest request) {
        List<Vehicule> existing = vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        List<Vehicule> actifs = new ArrayList<>();
        List<CreateContratRequest.VehiculeInput> inputs = request.getVehicules() == null ? List.of() : request.getVehicules();
        for (int index = 0; index < inputs.size(); index++) {
            CreateContratRequest.VehiculeInput input = inputs.get(index);
            validateDraftVehiculeInput(contrat, input);
            Vehicule vehicule = index < existing.size() ? existing.get(index) : new Vehicule();
            vehicule.setContrat(contrat);
            applyVehiculeInput(contrat, vehicule, input);
            vehicule.setActif(true);
            vehiculeRepository.save(vehicule);
            actifs.add(vehicule);
            if (!contrat.getVehicules().contains(vehicule)) {
                contrat.getVehicules().add(vehicule);
            }
        }
        for (int index = inputs.size(); index < existing.size(); index++) {
            Vehicule vehicule = existing.get(index);
            vehicule.setActif(false);
            vehiculeRepository.save(vehicule);
        }
        return actifs;
    }

    private List<Remorque> remplacerRemorquesCorrection(Contrat contrat, CreateContratRequest request) {
        List<Remorque> existing = remorqueRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId());
        List<Remorque> actifs = new ArrayList<>();
        List<CreateContratRequest.RemorqueInput> inputs = request.getRemorques() == null ? List.of() : request.getRemorques();
        for (int index = 0; index < inputs.size(); index++) {
            CreateContratRequest.RemorqueInput input = inputs.get(index);
            validateDraftRemorqueInput(input);
            Remorque remorque = index < existing.size() ? existing.get(index) : new Remorque();
            remorque.setContrat(contrat);
            applyRemorqueInput(contrat, remorque, input);
            remorque.setActif(true);
            remorqueRepository.save(remorque);
            actifs.add(remorque);
            if (!contrat.getRemorques().contains(remorque)) {
                contrat.getRemorques().add(remorque);
            }
        }
        for (int index = inputs.size(); index < existing.size(); index++) {
            Remorque remorque = existing.get(index);
            remorque.setActif(false);
            remorqueRepository.save(remorque);
        }
        return actifs;
    }

    private MouvementContrat preparerCorrectionAffaireNouvelleSiNecessaire(Contrat contrat) {
        return isCorrectionAffaireNouvelle(contrat) ? mouvementContratService.preparerCorrectionInitiale(contrat) : null;
    }

    private void rafraichirCorrectionAffaireNouvelleSiNecessaire(Contrat contrat, MouvementContrat mouvementInitial) {
        if (!isCorrectionAffaireNouvelle(contrat)) {
            return;
        }
        MouvementContrat mouvement = mouvementInitial == null ? mouvementContratService.preparerCorrectionInitiale(contrat) : mouvementInitial;
        mouvementContratService.rafraichirCorrectionInitiale(
                contrat,
                mouvement,
                activeVehicules(contrat),
                activeRemorques(contrat),
                activeGaranties(contrat),
                null
        );
    }

    private void applyDraftRequest(Contrat contrat, CreateContratRequest request) {
        applyDraftScalars(contrat, request);
        contrat = contratRepository.save(contrat);
        replaceDraftChildren(contrat, request, false);
    }

    private PersistedDraftGraph applyFinalRequestToExistingContrat(Contrat contrat, CreateContratRequest request) {
        if (request.getAgenceId() == null) {
            throw new BadRequestException("L'agence est obligatoire");
        }
        if (request.getTypeContrat() == null) {
            throw new BadRequestException("Le type de contrat est obligatoire");
        }
        validateContractReference(request);
        validateConventionReglement(request);
        CompagnieAssurance compagnie = request.getCompagnieAssuranceId() == null ? null :
                compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                        .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        Convention convention = request.getConventionId() == null ? null :
                conventionRepository.findByAgenceIdAndId(request.getAgenceId(), request.getConventionId())
                        .orElseThrow(() -> new ResourceNotFoundException("Convention", request.getConventionId()));
        Usage usageContrat = request.getUsageId() == null ? null :
                usageRepository.findById(request.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        GrilleTarifaire grilleTarifaire = request.getGrilleTarifaireId() == null ? null :
                grilleTarifaireRepository.findById(request.getGrilleTarifaireId())
                        .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", request.getGrilleTarifaireId()));
        ModeSaisieGarantieContrat modeSaisieGaranties = resolveModeSaisieGaranties(request);
        boolean saisiePrimeNette = Boolean.TRUE.equals(request.getSaisiePrimeNette())
                || modeSaisieGaranties == ModeSaisieGarantieContrat.MANUELLE_AVEC_PRIME_NETTE;
        validateModeSaisiePourTypeContrat(request, modeSaisieGaranties, convention);
        if (modeSaisieGaranties == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE && grilleTarifaire == null) {
            throw new BadRequestException("Une grille tarifaire est obligatoire pour un contrat convention ou flotte");
        }
        ContractDates contractDates = resolveContractDates(request);
        applyContratScalars(
                contrat,
                request,
                compagnie,
                convention,
                usageContrat,
                grilleTarifaire,
                modeSaisieGaranties,
                saisiePrimeNette,
                contractDates
        );
        contratRepository.save(contrat);
        return replaceDraftChildren(contrat, request, true);
    }

    private void applyDraftScalars(Contrat contrat, CreateContratRequest request) {
        if (hasText(request.getNumeroContrat())
                && contratRepository.existsByAgenceIdAndNumeroContratAndIdNot(request.getAgenceId(), request.getNumeroContrat(), contrat.getId())) {
            throw new BadRequestException("Numero de contrat deja utilise pour cette agence");
        }
        CompagnieAssurance compagnie = request.getCompagnieAssuranceId() == null ? null :
                compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                        .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        Convention convention = request.getConventionId() == null ? null :
                conventionRepository.findByAgenceIdAndId(request.getAgenceId(), request.getConventionId())
                        .orElseThrow(() -> new ResourceNotFoundException("Convention", request.getConventionId()));
        Usage usageContrat = request.getUsageId() == null ? null :
                usageRepository.findById(request.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        GrilleTarifaire grilleTarifaire = request.getGrilleTarifaireId() == null ? null :
                grilleTarifaireRepository.findById(request.getGrilleTarifaireId())
                        .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", request.getGrilleTarifaireId()));
        ModeSaisieGarantieContrat modeSaisieGaranties = resolveModeSaisieGaranties(request);
        boolean saisiePrimeNette = Boolean.TRUE.equals(request.getSaisiePrimeNette())
                || modeSaisieGaranties == ModeSaisieGarantieContrat.MANUELLE_AVEC_PRIME_NETTE;
        ContractDates contractDates = new ContractDates(request.getDateEffet(), request.getDateEcheance(), blankToNull(request.getEcheance()));
        applyContratScalars(
                contrat,
                request,
                compagnie,
                convention,
                usageContrat,
                grilleTarifaire,
                modeSaisieGaranties,
                saisiePrimeNette,
                contractDates
        );
    }

    private void applyContratScalars(
            Contrat contrat,
            CreateContratRequest request,
            CompagnieAssurance compagnie,
            Convention convention,
            Usage usageContrat,
            GrilleTarifaire grilleTarifaire,
            ModeSaisieGarantieContrat modeSaisieGaranties,
            boolean saisiePrimeNette,
            ContractDates contractDates
    ) {
        contrat.setCompagnieAssurance(compagnie);
        contrat.setConvention(convention);
        contrat.setUsage(usageContrat);
        contrat.setGrilleTarifaire(grilleTarifaire);
        contrat.setTypeContrat(request.getTypeContrat());
        contrat.setNumeroContrat(blankToNull(request.getNumeroContrat()));
        String numeroDevis = blankToNull(request.getNumeroDevis());
        if (numeroDevis != null || !hasText(contrat.getNumeroDevis())) {
            contrat.setNumeroDevis(numeroDevis);
        }
        contrat.setNumeroPolice(blankToNull(request.getNumeroPolice()));
        contrat.setNumeroAttestation(blankToNull(request.getNumeroAttestation()));
        contrat.setDateEffet(contractDates.dateEffet());
        contrat.setDateEcheance(contractDates.dateEcheance());
        contrat.setEcheance(contractDates.echeance());
        contrat.setTypeRenouvellement(blankToNull(request.getTypeRenouvellement()));
        if (contrat.getContratOrigine() == null || request.getModeTermeRenouvellement() != null) {
            contrat.setModeTermeRenouvellement(request.getModeTermeRenouvellement());
        }
        contrat.setModePaiement(blankToNull(request.getModePaiement()));
        contrat.setModeReglement(blankToNull(request.getModeReglement()));
        contrat.setNumeroBonCommande(blankToNull(request.getNumeroBonCommande()));
        contrat.setMontantBulletin(request.getMontantBulletin());
        contrat.setPeriodicite(blankToNull(request.getPeriodicite()));
        contrat.setFractionnement(request.getFractionnement());
        contrat.setTauxRc(request.getTauxRc());
        contrat.setModeSaisieGaranties(modeSaisieGaranties);
        contrat.setSaisiePrimeNette(saisiePrimeNette);
        contrat.setNombreVehicules(request.getNombreVehicules());
        contrat.setNombreRemorques(request.getNombreRemorques());
        contrat.setProspection(request.getProspection() == null ? false : request.getProspection());
        contrat.setAssistance(request.getAssistance() == null ? false : request.getAssistance());
        contrat.setCrmPartage(request.getCrmPartage() == null ? false : request.getCrmPartage());
        contrat.setCrmPartageValeur(blankToNull(request.getCrmPartageValeur()));
        contrat.setNotes(request.getNotes());
    }

    private PersistedDraftGraph replaceDraftChildren(Contrat contrat, CreateContratRequest request, boolean finalMode) {
        Map<String, Client> existingClients = new HashMap<>();
        for (ContratClient link : contrat.getClients()) {
            existingClients.put(clientDraftKey(link.getRole(), Boolean.TRUE.equals(link.getPrincipalPourRole())), link.getClient());
        }
        List<DraftAssistanceSnapshot> assistanceSnapshots = snapshotDraftAssistances(contrat);
        clearDraftChildren(contrat);

        saveClientLinks(contrat, request.getClients(), request.getAgenceId(), existingClients, finalMode);
        applyContractBilling(contrat, request, finalMode);

        Usage usageContrat = contrat.getUsage();
        List<Vehicule> vehiculesCrees = new ArrayList<>();
        for (CreateContratRequest.VehiculeInput input : request.getVehicules() == null ? List.<CreateContratRequest.VehiculeInput>of() : request.getVehicules()) {
            if (input.getTypeVehicule() == null) {
                if (finalMode) {
                    throw new BadRequestException("Le type vehicule est obligatoire");
                }
                continue;
            }
            Usage usage = input.getUsageId() == null ? usageContrat : usageRepository.findById(input.getUsageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
            Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), true);
            Carrosserie carrosserie = resolveCarrosserie(input.getCarrosserieId(), input.getCarrosserieLibelle(), true);
            CategorieTransport categorieTransport = resolveCategorieTransport(input.getCategorieTransportId());
            validateCategorieTransport(usage, categorieTransport);
            Vehicule vehicule = vehiculeRepository.save(Vehicule.builder()
                    .contrat(contrat)
                    .typeVehicule(input.getTypeVehicule())
                    .usage(usage)
                    .marque(marque)
                    .carrosserie(carrosserie)
                    .categorieTransport(categorieTransport)
                    .immatriculation(input.getImmatriculation())
                    .immatriculationProvisoire(input.getImmatriculationProvisoire())
                    .carburant(input.getCarburant())
                    .puissanceFiscale(input.getPuissanceFiscale())
                    .nombrePlaces(input.getNombrePlaces())
                    .sousClasse(input.getSousClasse())
                    .ptc(input.getPtc())
                    .datePremiereCirculation(input.getDatePremiereCirculation())
                    .dateExpirationCarteGrise(input.getDateExpirationCarteGrise())
                    .dateEffet(firstNonNull(input.getDateEffet(), contrat.getDateEffet()))
                    .dateEcheance(firstNonNull(input.getDateEcheance(), contrat.getDateEcheance()))
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .remorque(input.getRemorque() == null ? false : input.getRemorque())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurVenale(input.getValeurVenale())
                    .valeurNeuf(input.getValeurNeuf())
                    .valeurGlace(input.getValeurGlace())
                    .organismeCredit(input.getOrganismeCredit() == null ? false : input.getOrganismeCredit())
                    .nomOrganismeCredit(input.getNomOrganismeCredit())
                    .montantCredit(input.getMontantCredit())
                    .dateFinCredit(input.getDateFinCredit())
                    .build());
            vehiculesCrees.add(vehicule);
            contrat.getVehicules().add(vehicule);
        }

        List<Remorque> remorquesCreees = new ArrayList<>();
        for (CreateContratRequest.RemorqueInput input : request.getRemorques() == null ? List.<CreateContratRequest.RemorqueInput>of() : request.getRemorques()) {
            Usage usage = input.getUsageId() == null ? usageContrat : usageRepository.findById(input.getUsageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
            Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), true);
            Remorque remorque = remorqueRepository.save(Remorque.builder()
                    .contrat(contrat)
                    .usage(usage)
                    .marque(marque)
                    .immatriculation(input.getImmatriculation())
                    .ptc(input.getPtc())
                    .dateMiseEnCirculation(input.getDateMiseEnCirculation())
                    .dateEffet(firstNonNull(input.getDateEffet(), contrat.getDateEffet()))
                    .dateEcheance(firstNonNull(input.getDateEcheance(), contrat.getDateEcheance()))
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurAssuree(input.getValeurAssuree())
                    .build());
            remorquesCreees.add(remorque);
            contrat.getRemorques().add(remorque);
        }

        List<ContratGarantie> garantiesCreees = finalMode
                ? replaceFinalGaranties(contrat, request, vehiculesCrees, remorquesCreees)
                : replaceRawDraftGaranties(contrat, request, vehiculesCrees, remorquesCreees);
        List<AssistanceContrat> assistancesCreees = restoreDraftAssistances(contrat, vehiculesCrees, assistanceSnapshots);
        return new PersistedDraftGraph(vehiculesCrees, remorquesCreees, garantiesCreees, assistancesCreees, buildManualQuittanceResult(request));
    }

    private void clearDraftChildren(Contrat contrat) {
        List<AssistanceContrat> assistances = assistanceContratRepository.findByContratIdOrderByCreatedAtDesc(contrat.getId());
        List<ElementFacturable> assistanceElements = assistances.stream()
                .map(AssistanceContrat::getElementFacturable)
                .filter(element -> element != null)
                .toList();
        assistanceContratRepository.deleteAll(assistances);
        assistanceContratRepository.flush();
        if (!assistanceElements.isEmpty()) {
            elementFacturableRepository.deleteAll(assistanceElements);
            elementFacturableRepository.flush();
        }
        contratGarantieRepository.deleteByContratId(contrat.getId());
        contratClientRepository.deleteByContratId(contrat.getId());
        remorqueRepository.deleteByContratId(contrat.getId());
        vehiculeRepository.deleteByContratId(contrat.getId());
        contratGarantieRepository.flush();
        contratClientRepository.flush();
        remorqueRepository.flush();
        vehiculeRepository.flush();
        contrat.getGaranties().clear();
        contrat.getClients().clear();
        contrat.getRemorques().clear();
        contrat.getVehicules().clear();
        contrat.getAssistances().clear();
        contrat.getElementsFacturables().removeAll(assistanceElements);
    }

    private List<DraftAssistanceSnapshot> snapshotDraftAssistances(Contrat contrat) {
        List<Vehicule> vehicules = activeVehicules(contrat);
        Map<Long, Integer> vehiculeIndexById = new HashMap<>();
        for (int index = 0; index < vehicules.size(); index++) {
            vehiculeIndexById.put(vehicules.get(index).getId(), index);
        }
        List<DraftAssistanceSnapshot> snapshots = new ArrayList<>();
        Set<Long> vehiculeIdsTraites = new HashSet<>();
        for (AssistanceContrat assistance : assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(contrat.getId())) {
            Long vehiculeId = assistance.getVehicule() == null ? null : assistance.getVehicule().getId();
            Integer vehiculeIndex = vehiculeId == null ? null : vehiculeIndexById.get(vehiculeId);
            if (vehiculeIndex == null || !vehiculeIdsTraites.add(vehiculeId)) {
                continue;
            }
            snapshots.add(new DraftAssistanceSnapshot(
                    vehiculeIndex,
                    assistance.getCompagnieAssuranceContrat(),
                    assistance.getCompagnieAssistance(),
                    assistance.getProduitAssistance(),
                    assistance.getTarifProduitAssistance(),
                    assistance.getProduit(),
                    assistance.getDateSouscription(),
                    assistance.getDateEffet(),
                    assistance.getDateEcheance(),
                    assistance.getEcheanceCode(),
                    assistance.getDuree(),
                    assistance.getUnite(),
                    assistance.getNumeroContratOuQuittance(),
                    assistance.getTypeQuittance(),
                    assistance.getPrimeNette(),
                    assistance.getPrimeTotale()
            ));
        }
        return snapshots;
    }

    private List<AssistanceContrat> restoreDraftAssistances(
            Contrat contrat,
            List<Vehicule> vehicules,
            List<DraftAssistanceSnapshot> snapshots
    ) {
        List<AssistanceContrat> restored = new ArrayList<>();
        for (DraftAssistanceSnapshot snapshot : snapshots) {
            if (snapshot.vehiculeIndex() < 0 || snapshot.vehiculeIndex() >= vehicules.size()) {
                continue;
            }
            Vehicule vehicule = vehicules.get(snapshot.vehiculeIndex());
            AssistanceContrat assistance = AssistanceContrat.builder()
                    .contrat(contrat)
                    .vehicule(vehicule)
                    .compagnieAssuranceContrat(firstNonNull(snapshot.compagnieAssuranceContrat(), contrat.getCompagnieAssurance()))
                    .compagnieAssistance(snapshot.compagnieAssistance())
                    .produitAssistance(snapshot.produitAssistance())
                    .tarifProduitAssistance(snapshot.tarifProduitAssistance())
                    .produit(snapshot.produit())
                    .dateSouscription(snapshot.dateSouscription())
                    .dateEffet(snapshot.dateEffet())
                    .dateEcheance(snapshot.dateEcheance())
                    .echeanceCode(snapshot.echeanceCode())
                    .duree(snapshot.duree())
                    .unite(snapshot.unite())
                    .numeroDossier(contrat.getNumeroDossier())
                    .numeroPoliceContrat(contrat.getNumeroPolice())
                    .numeroContratOuQuittance(snapshot.numeroContratOuQuittance())
                    .typeQuittance(snapshot.typeQuittance())
                    .primeNette(snapshot.primeNette())
                    .primeTotale(snapshot.primeTotale())
                    .actif(true)
                    .build();
            assistance = assistanceContratRepository.save(assistance);
            ElementFacturable element = ElementFacturable.builder()
                    .agence(contrat.getAgence())
                    .contrat(contrat)
                    .compagnieAssurance(contrat.getCompagnieAssurance())
                    .nature(NatureElementFacturable.ASSISTANCE)
                    .statut(StatutElementFacturable.A_QUITTANCER)
                    .referenceSource(String.valueOf(assistance.getId()))
                    .libelle("Assistance - " + firstNonNull(snapshot.produit(), ""))
                    .dateDebut(snapshot.dateEffet())
                    .dateFin(snapshot.dateEcheance())
                    .primeNette(zeroIfNull(snapshot.primeNette()))
                    .taxe(zeroIfNull(snapshot.primeTotale()).subtract(zeroIfNull(snapshot.primeNette())).max(BigDecimal.ZERO))
                    .taxeParafiscale(BigDecimal.ZERO)
                    .accessoire(BigDecimal.ZERO)
                    .cnpac(BigDecimal.ZERO)
                    .primeTotale(zeroIfNull(snapshot.primeTotale()))
                    .actif(true)
                    .build();
            element = elementFacturableRepository.save(element);
            assistance.setElementFacturable(element);
            assistance = assistanceContratRepository.save(assistance);
            restored.add(assistance);
            contrat.getAssistances().add(assistance);
            contrat.getElementsFacturables().add(element);
        }
        contrat.setAssistance(!restored.isEmpty());
        contratRepository.save(contrat);
        return restored;
    }

    private void restoreRenewalDraftAssistances(
            Contrat contrat,
            List<Vehicule> vehicules,
            List<DraftAssistanceSnapshot> snapshots
    ) {
        for (DraftAssistanceSnapshot snapshot : snapshots) {
            if (snapshot.vehiculeIndex() < 0
                    || snapshot.vehiculeIndex() >= vehicules.size()
                    || snapshot.compagnieAssistance() == null
                    || snapshot.produitAssistance() == null) {
                continue;
            }
            UpsertAssistanceContratRequest request = new UpsertAssistanceContratRequest();
            request.setVehiculeId(vehicules.get(snapshot.vehiculeIndex()).getId());
            request.setCompagnieAssistanceId(snapshot.compagnieAssistance().getId());
            request.setProduitAssistanceId(snapshot.produitAssistance().getId());
            request.setDateSouscription(contrat.getDateEffet());
            request.setDateEffet(contrat.getDateEffet());
            request.setEcheanceCode(contrat.getEcheance());
            request.setNumeroContratOuQuittance(snapshot.numeroContratOuQuittance());
            request.setTypeQuittance(snapshot.typeQuittance());
            assistanceContratService.upsert(contrat.getAgence().getId(), contrat.getId(), request);
        }
    }

    private void refreshDraftAssistanceReferences(Contrat contrat, List<AssistanceContrat> assistances) {
        if (assistances == null || assistances.isEmpty()) {
            contrat.setAssistance(false);
            contratRepository.save(contrat);
            return;
        }
        for (AssistanceContrat assistance : assistances) {
            assistance.setNumeroDossier(contrat.getNumeroDossier());
            assistance.setNumeroPoliceContrat(contrat.getNumeroPolice());
            ElementFacturable element = assistance.getElementFacturable();
            if (element != null) {
                element.setContrat(contrat);
                element.setCompagnieAssurance(contrat.getCompagnieAssurance());
                elementFacturableRepository.save(element);
            }
        }
        assistanceContratRepository.saveAll(assistances);
        contrat.setAssistance(true);
        contratRepository.save(contrat);
    }

    private void validateDraftVehiculeInput(Contrat contrat, CreateContratRequest.VehiculeInput input) {
        if (input == null) {
            throw new BadRequestException("Vehicule obligatoire");
        }
        if (input.getTypeVehicule() == null) {
            throw new BadRequestException("Type vehicule obligatoire");
        }
        if (!hasText(input.getImmatriculation())) {
            throw new BadRequestException("Immatriculation obligatoire");
        }
        if (input.getUsageId() == null && contrat.getUsage() == null) {
            throw new BadRequestException("Usage vehicule obligatoire");
        }
        if (input.getMarqueId() == null && !hasText(input.getMarqueLibelle())) {
            throw new BadRequestException("Marque obligatoire");
        }
        if (input.getCarrosserieId() == null && !hasText(input.getCarrosserieLibelle())) {
            throw new BadRequestException("Carrosserie obligatoire");
        }
        if (!hasText(input.getNombrePlaces())) {
            throw new BadRequestException("Nombre de places obligatoire");
        }
        if (!hasText(input.getCrm())) {
            throw new BadRequestException("CRM obligatoire");
        }
        Usage usage = input.getUsageId() == null
                ? contrat.getUsage()
                : usageRepository.findById(input.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
        if (usage == null) {
            throw new BadRequestException("Usage vehicule obligatoire");
        }
        if (Boolean.TRUE.equals(usage.getByCarburantAndPf())
                && (!hasText(input.getCarburant()) || !hasText(input.getPuissanceFiscale()))) {
            throw new BadRequestException("Carburant et puissance fiscale obligatoires pour cet usage");
        }
        if (Boolean.TRUE.equals(usage.getBySousClasse()) && !hasText(input.getSousClasse())) {
            throw new BadRequestException("Sous-classe obligatoire pour cet usage");
        }
        if (Boolean.TRUE.equals(usage.getByPtc()) && !hasText(input.getPtc())) {
            throw new BadRequestException("PTC obligatoire pour cet usage");
        }
        if (Boolean.TRUE.equals(usage.getByCategorieTransport()) && input.getCategorieTransportId() == null) {
            throw new BadRequestException("Categorie transport obligatoire pour cet usage");
        }
    }

    private void applyVehiculeInput(Contrat contrat, Vehicule vehicule, CreateContratRequest.VehiculeInput input) {
        Usage usage = input.getUsageId() == null ? contrat.getUsage() : usageRepository.findById(input.getUsageId())
                .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
        Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), true);
        Carrosserie carrosserie = resolveCarrosserie(input.getCarrosserieId(), input.getCarrosserieLibelle(), true);
        CategorieTransport categorieTransport = resolveCategorieTransport(input.getCategorieTransportId());
        validateCategorieTransport(usage, categorieTransport);
        vehicule.setTypeVehicule(input.getTypeVehicule());
        vehicule.setUsage(usage);
        vehicule.setMarque(marque);
        vehicule.setCarrosserie(carrosserie);
        vehicule.setCategorieTransport(categorieTransport);
        vehicule.setImmatriculation(input.getImmatriculation());
        vehicule.setImmatriculationProvisoire(input.getImmatriculationProvisoire());
        vehicule.setCarburant(input.getCarburant());
        vehicule.setPuissanceFiscale(input.getPuissanceFiscale());
        vehicule.setNombrePlaces(input.getNombrePlaces());
        vehicule.setSousClasse(input.getSousClasse());
        vehicule.setPtc(input.getPtc());
        vehicule.setDatePremiereCirculation(input.getDatePremiereCirculation());
        vehicule.setDateExpirationCarteGrise(input.getDateExpirationCarteGrise());
        vehicule.setDateEffet(firstNonNull(input.getDateEffet(), contrat.getDateEffet()));
        vehicule.setDateEcheance(firstNonNull(input.getDateEcheance(), contrat.getDateEcheance()));
        vehicule.setCrm(input.getCrm());
        vehicule.setNumeroAttestation(input.getNumeroAttestation());
        vehicule.setRemorque(input.getRemorque() == null ? false : input.getRemorque());
        vehicule.setCoefficientProrata(input.getCoefficientProrata());
        vehicule.setValeurVenale(input.getValeurVenale());
        vehicule.setValeurNeuf(input.getValeurNeuf());
        vehicule.setValeurGlace(input.getValeurGlace());
        vehicule.setOrganismeCredit(input.getOrganismeCredit() == null ? false : input.getOrganismeCredit());
        vehicule.setNomOrganismeCredit(input.getNomOrganismeCredit());
        vehicule.setMontantCredit(input.getMontantCredit());
        vehicule.setDateFinCredit(input.getDateFinCredit());
    }

    private void validateDraftRemorqueInput(CreateContratRequest.RemorqueInput input) {
        if (input == null) {
            throw new BadRequestException("Informations remorque obligatoires");
        }
        if (input.getUsageId() == null) {
            throw new BadRequestException("Usage remorque obligatoire");
        }
    }

    private void applyRemorqueInput(Contrat contrat, Remorque remorque, CreateContratRequest.RemorqueInput input) {
        Usage usage = input.getUsageId() == null ? contrat.getUsage() : usageRepository.findById(input.getUsageId())
                .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
        Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), false);
        remorque.setUsage(usage);
        remorque.setMarque(marque);
        remorque.setImmatriculation(input.getImmatriculation());
        remorque.setPtc(input.getPtc());
        remorque.setDateMiseEnCirculation(input.getDateMiseEnCirculation());
        remorque.setDateEffet(firstNonNull(input.getDateEffet(), contrat.getDateEffet()));
        remorque.setDateEcheance(firstNonNull(input.getDateEcheance(), contrat.getDateEcheance()));
        remorque.setCrm(input.getCrm());
        remorque.setNumeroAttestation(input.getNumeroAttestation());
        remorque.setCoefficientProrata(input.getCoefficientProrata());
        remorque.setValeurAssuree(input.getValeurAssuree());
    }

    private void saveClientLinks(
            Contrat contrat,
            List<CreateContratRequest.ClientInput> inputs,
            Long agenceId,
            Map<String, Client> existingClients,
            boolean finalMode
    ) {
        Map<com.assurance.enums.RoleClientContrat, Client> resolvedByRole = new HashMap<>();
        List<CreateContratRequest.ClientInput> aliasInputs = new ArrayList<>();
        for (CreateContratRequest.ClientInput input : inputs == null ? List.<CreateContratRequest.ClientInput>of() : inputs) {
            if (input.getRole() == null) {
                if (finalMode) {
                    throw new BadRequestException("Le role client est obligatoire");
                }
                continue;
            }
            if (input.getSameAsRole() != null) {
                aliasInputs.add(input);
                continue;
            }
            Client client = resolveClientForDraft(agenceId, input, existingClients, finalMode);
            if (client == null) {
                continue;
            }
            applyClientGroupAssignment(agenceId, input, client, contrat.getDateEffet());
            saveClientLink(contrat, input, client);
            resolvedByRole.put(input.getRole(), client);
        }
        for (CreateContratRequest.ClientInput input : aliasInputs) {
            Client client = resolvedByRole.get(input.getSameAsRole());
            if (client == null) {
                client = existingClientForRole(existingClients, input.getSameAsRole());
            }
            if (client == null) {
                if (finalMode) {
                    throw new BadRequestException("Le role " + input.getRole() + " reference un client non resolu: " + input.getSameAsRole());
                }
                continue;
            }
            if (input.getClient() != null) {
                if (input.getClient().getAgenceId() == null) {
                    input.getClient().setAgenceId(agenceId);
                }
                client = clientService.updateEntity(agenceId, client.getId(), input.getClient());
            }
            applyClientGroupAssignment(agenceId, input, client, contrat.getDateEffet());
            saveClientLink(contrat, input, client);
            resolvedByRole.put(input.getRole(), client);
        }
    }

    private void saveClientLink(Contrat contrat, CreateContratRequest.ClientInput input, Client client) {
        ContratClient link = contratClientRepository.save(ContratClient.builder()
                .contrat(contrat)
                .client(client)
                .role(input.getRole())
                .principalPourRole(input.isPrincipalPourRole())
                .build());
        contrat.getClients().add(link);
    }

    private void applyClientGroupAssignment(
            Long agenceId,
            CreateContratRequest.ClientInput input,
            Client client,
            LocalDate dateEffetContrat
    ) {
        if (Boolean.TRUE.equals(input.getRetirerGroupesActifs())) {
            if (input.getGroupeClientId() != null) {
                throw new BadRequestException("Le retrait des groupes ne peut pas etre combine avec un rattachement");
            }
            groupeClientService.endActiveMemberships(agenceId, client.getId());
            return;
        }
        if (input.getGroupeClientId() == null) {
            return;
        }
        groupeClientService.assign(
                agenceId,
                client.getId(),
                input.getGroupeClientId(),
                input.getRelationGroupe(),
                true,
                dateEffetContrat == null ? LocalDate.now() : dateEffetContrat
        );
    }

    private void applyContractBilling(Contrat contrat, CreateContratRequest request, boolean finalMode) {
        Client souscripteur = contrat.getClients().stream()
                .filter(link -> link.getRole() == com.assurance.enums.RoleClientContrat.SOUSCRIPTEUR)
                .map(ContratClient::getClient)
                .findFirst()
                .orElse(null);
        if (souscripteur == null) {
            if (finalMode && (request.getTypePayeurPrime() != null || request.getPayeurPrimeClientId() != null)) {
                throw new BadRequestException("Le souscripteur doit etre enregistre avant le payeur");
            }
            return;
        }

        TypePayeurPrime typePayeur = request.getTypePayeurPrime() == null
                ? TypePayeurPrime.SOUSCRIPTEUR
                : request.getTypePayeurPrime();
        LocalDate billingDate = firstNonNull(request.getDateEffet(), contrat.getDateEffet(), LocalDate.now());
        ClientResponse.GroupeView groupeSouscripteur = groupeClientService.activePrincipalMembership(
                contrat.getAgence().getId(),
                souscripteur.getId(),
                billingDate
        );
        Long groupeId = request.getGroupeFacturationId() != null
                ? request.getGroupeFacturationId()
                : groupeSouscripteur == null ? null : groupeSouscripteur.getId();
        GroupeClient groupe = groupeId == null
                ? null
                : groupeClientService.requireGroupe(contrat.getAgence().getId(), groupeId);
        if (groupe != null && !groupeClientService.isActiveMember(
                contrat.getAgence().getId(),
                groupe.getId(),
                souscripteur.getId(),
                billingDate
        )) {
            throw new BadRequestException("Le souscripteur n'appartient pas au groupe de facturation");
        }

        Client payeur;
        switch (typePayeur) {
            case SOUSCRIPTEUR -> payeur = souscripteur;
            case TRESORERIE_GROUPE -> {
                if (groupe == null || groupe.getClientTresorerie() == null) {
                    throw new BadRequestException("La tresorerie du groupe doit etre configuree");
                }
                payeur = groupe.getClientTresorerie();
            }
            case MEMBRE_GROUPE -> {
                if (groupe == null || request.getPayeurPrimeClientId() == null) {
                    throw new BadRequestException("Le groupe et le membre payeur sont obligatoires");
                }
                payeur = requireBillingClient(contrat, request.getPayeurPrimeClientId());
                if (!groupeClientService.isActiveMember(
                        contrat.getAgence().getId(),
                        groupe.getId(),
                        payeur.getId(),
                        billingDate
                )) {
                    throw new BadRequestException("Le payeur selectionne n'appartient pas au groupe");
                }
            }
            case TIERS_MANDATE -> {
                if (request.getPayeurPrimeClientId() == null || !hasText(request.getReferenceMandatPayeur())) {
                    throw new BadRequestException("Le tiers payeur et la reference du mandat sont obligatoires");
                }
                payeur = requireBillingClient(contrat, request.getPayeurPrimeClientId());
            }
            default -> throw new BadRequestException("Type de payeur non supporte");
        }

        ModeFacturationContrat modeFacturation = request.getModeFacturation();
        if (modeFacturation == null) {
            modeFacturation = groupe != null && Boolean.TRUE.equals(groupe.getFacturationConsolideeDefaut())
                    ? ModeFacturationContrat.CONSOLIDEE_GROUPE
                    : ModeFacturationContrat.DIRECTE;
        }
        if (modeFacturation == ModeFacturationContrat.CONSOLIDEE_GROUPE && groupe == null) {
            throw new BadRequestException("Un groupe est obligatoire pour la facturation consolidee");
        }

        contrat.setTypePayeurPrime(typePayeur);
        contrat.setPayeurPrime(payeur);
        contrat.setGroupeFacturation(groupe);
        contrat.setModeFacturation(modeFacturation);
        contrat.setReferenceMandatPayeur(
                typePayeur == TypePayeurPrime.TIERS_MANDATE
                        ? blankToNull(request.getReferenceMandatPayeur())
                        : null
        );
        contratRepository.save(contrat);
    }

    private Client requireBillingClient(Contrat contrat, Long clientId) {
        return clientRepository.findByAgenceIdAndId(contrat.getAgence().getId(), clientId)
                .orElseThrow(() -> new ResourceNotFoundException("Client payeur", clientId));
    }

    private void buildPreviewClientLinks(Contrat contrat, List<CreateContratRequest.ClientInput> inputs, Long agenceId) {
        Map<com.assurance.enums.RoleClientContrat, Client> resolvedByRole = new HashMap<>();
        List<CreateContratRequest.ClientInput> aliasInputs = new ArrayList<>();
        for (CreateContratRequest.ClientInput input : inputs == null ? List.<CreateContratRequest.ClientInput>of() : inputs) {
            if (input.getRole() == null) {
                continue;
            }
            if (input.getSameAsRole() != null) {
                aliasInputs.add(input);
                continue;
            }
            Client client = resolveClientForPreview(agenceId, input);
            if (client == null) {
                continue;
            }
            addPreviewClientLink(contrat, input, client);
            resolvedByRole.put(input.getRole(), client);
        }
        for (CreateContratRequest.ClientInput input : aliasInputs) {
            Client client = resolvedByRole.get(input.getSameAsRole());
            if (client == null) {
                continue;
            }
            addPreviewClientLink(contrat, input, client);
            resolvedByRole.put(input.getRole(), client);
        }
    }

    private void addPreviewClientLink(Contrat contrat, CreateContratRequest.ClientInput input, Client client) {
        contrat.getClients().add(ContratClient.builder()
                .contrat(contrat)
                .client(client)
                .role(input.getRole())
                .principalPourRole(input.isPrincipalPourRole())
                .build());
    }

    private Client resolveClientForDraft(
            Long agenceId,
            CreateContratRequest.ClientInput input,
            Map<String, Client> existingClients,
            boolean finalMode
    ) {
        if (input.getRole() == null) {
            if (finalMode) {
                throw new BadRequestException("Le role client est obligatoire");
            }
            return null;
        }
        if (input.getClientId() != null) {
            return clientRepository.findByAgenceIdAndId(agenceId, input.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
        }
        if (input.getClient() == null) {
            if (finalMode) {
                throw new BadRequestException("Le role " + input.getRole() + " doit renseigner clientId ou client");
            }
            return null;
        }
        if (input.getClient().getAgenceId() == null) {
            input.getClient().setAgenceId(agenceId);
        }
        if (!agenceId.equals(input.getClient().getAgenceId())) {
            throw new BadRequestException("Le client inline doit appartenir a l'agence du contrat");
        }
        Client existing = existingClients.get(clientDraftKey(input.getRole(), input.isPrincipalPourRole()));
        if (existing != null) {
            return clientService.updateEntity(agenceId, existing.getId(), input.getClient());
        }
        return clientService.createEntity(input.getClient());
    }

    private String clientDraftKey(com.assurance.enums.RoleClientContrat role, boolean principal) {
        return role.name() + ":" + principal;
    }

    private Client existingClientForRole(Map<String, Client> existingClients, com.assurance.enums.RoleClientContrat role) {
        Client principal = existingClients.get(clientDraftKey(role, true));
        if (principal != null) {
            return principal;
        }
        return existingClients.get(clientDraftKey(role, false));
    }

    private List<ContratGarantie> replaceFinalGaranties(
            Contrat contrat,
            CreateContratRequest request,
            List<Vehicule> vehiculesCrees,
            List<Remorque> remorquesCreees
    ) {
        List<ContratGarantie> garantiesCreees = new ArrayList<>();
        for (CreateContratRequest.GarantieInput input : request.getGaranties() == null ? List.<CreateContratRequest.GarantieInput>of() : request.getGaranties()) {
            Garantie garantie = garantieRepository.findById(input.getGarantieId())
                    .orElseThrow(() -> new ResourceNotFoundException("Garantie", input.getGarantieId()));
            Client client = input.getClientId() == null ? null :
                    clientRepository.findByAgenceIdAndId(request.getAgenceId(), input.getClientId())
                            .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
            Vehicule vehicule = input.getVehiculeIndex() == null ? null : resolveVehicule(vehiculesCrees, input.getVehiculeIndex(), "Garantie");
            Remorque remorque = input.getRemorqueIndex() == null ? null : resolveRemorque(remorquesCreees, input.getRemorqueIndex(), "Garantie");
            Usage usageCible = resolveUsageCible(contrat, vehicule, remorque);
            LigneGrilleTarifaire ligneGrilleTarifaire = resolveLigneGrilleTarifaire(contrat, garantie, input, usageCible, vehicule, remorque);
            ModeTarificationGarantie modeSelectionne = resolveModeSelectionne(garantie, ligneGrilleTarifaire, input);
            SourceValeurGarantie sourceValeurSelectionnee = resolveSourceValeurSelectionnee(garantie, input, modeSelectionne, remorque);
            FormuleGarantiePersonne formuleGarantiePersonne = resolveFormuleGarantiePersonne(input.getFormuleGarantiePersonneId(), contrat, garantie, usageCible);
            GarantieMontants montants = resolveGarantieMontants(contrat, input, garantie, ligneGrilleTarifaire, vehicule, remorque, usageCible, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne);
            validateGarantieTarget(garantie, vehicule, remorque, client);
            validateGarantieConfiguration(contrat, garantie, input, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne, ligneGrilleTarifaire, montants);
            validateLigneGrilleTarifaire(contrat, garantie, ligneGrilleTarifaire, modeSelectionne, usageCible, vehicule);
            ContratGarantie contratGarantie = saveContratGarantie(
                    contrat,
                    garantie,
                    vehicule,
                    remorque,
                    client,
                    ligneGrilleTarifaire,
                    modeSelectionne,
                    sourceValeurSelectionnee,
                    formuleGarantiePersonne,
                    montants
            );
            garantiesCreees.add(contratGarantie);
            contrat.getGaranties().add(contratGarantie);
        }
        return garantiesCreees;
    }

    private List<ContratGarantie> replaceRawDraftGaranties(
            Contrat contrat,
            CreateContratRequest request,
            List<Vehicule> vehiculesCrees,
            List<Remorque> remorquesCreees
    ) {
        List<ContratGarantie> garantiesCreees = new ArrayList<>();
        for (CreateContratRequest.GarantieInput input : request.getGaranties() == null ? List.<CreateContratRequest.GarantieInput>of() : request.getGaranties()) {
            if (input.getGarantieId() == null) {
                continue;
            }
            Garantie garantie = garantieRepository.findById(input.getGarantieId())
                    .orElseThrow(() -> new ResourceNotFoundException("Garantie", input.getGarantieId()));
            Client client = input.getClientId() == null ? null :
                    clientRepository.findByAgenceIdAndId(request.getAgenceId(), input.getClientId())
                            .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
            Vehicule vehicule = input.getVehiculeIndex() == null ? null : resolveVehicule(vehiculesCrees, input.getVehiculeIndex(), "Garantie");
            Remorque remorque = input.getRemorqueIndex() == null ? null : resolveRemorque(remorquesCreees, input.getRemorqueIndex(), "Garantie");
            LigneGrilleTarifaire ligne = input.getLigneGrilleTarifaireId() == null ? null :
                        ligneGrilleTarifaireRepository.findById(input.getLigneGrilleTarifaireId())
                            .orElseThrow(() -> new ResourceNotFoundException("LigneGrilleTarifaire", input.getLigneGrilleTarifaireId()));
            FormuleGarantiePersonne formule = input.getFormuleGarantiePersonneId() == null ? null :
                    formuleGarantiePersonneRepository.findById(input.getFormuleGarantiePersonneId())
                            .orElseThrow(() -> new ResourceNotFoundException("FormuleGarantiePersonne", input.getFormuleGarantiePersonneId()));
            ModeTarificationGarantie mode = parseMode(input.getModeSelectionne());
            SourceValeurGarantie source = parseSource(input.getSourceValeurSelectionnee());
            ContratGarantie contratGarantie = contratGarantieRepository.save(ContratGarantie.builder()
                    .contrat(contrat)
                    .garantie(garantie)
                    .vehicule(vehicule)
                    .remorque(remorque)
                    .client(client)
                    .ligneGrilleTarifaire(ligne)
                    .modeSelectionne(mode)
                    .sourceValeurSelectionnee(source)
                    .formuleGarantiePersonne(formule)
                    .valeurVenale(input.getValeurVenale())
                    .valeurNeuf(input.getValeurNeuf())
                    .valeurGlace(input.getValeurGlace())
                    .formule(input.getFormule())
                    .montantDeces(input.getMontantDeces())
                    .montantInvalidite(input.getMontantInvalidite())
                    .montantFraisMedicaux(input.getMontantFraisMedicaux())
                    .montantFraisHospitalisation(input.getMontantFraisHospitalisation())
                    .montantFraisFuneraires(input.getMontantFraisFuneraires())
                    .montantFraisChirurgie(input.getMontantFraisChirurgie())
                    .accessoire(input.getAccessoire())
                    .capital(firstNonNull(input.getCapital(), input.getValeurAssuree()))
                    .taux(input.getTaux())
                    .prime(input.getPrime())
                    .tauxFranchise(input.getTauxFranchise())
                    .franchiseMinimale(input.getFranchiseMinimale())
                    .build());
            garantiesCreees.add(contratGarantie);
            contrat.getGaranties().add(contratGarantie);
        }
        return garantiesCreees;
    }

    private ContratGarantie saveCalculatedDraftGarantieForTarget(
            Contrat contrat,
            CreateContratRequest.GarantieInput input,
            Vehicule vehicule,
            Remorque remorque
    ) {
        Garantie garantie = garantieRepository.findById(input.getGarantieId())
                .orElseThrow(() -> new ResourceNotFoundException("Garantie", input.getGarantieId()));
        Client client = input.getClientId() == null ? null :
                clientRepository.findByAgenceIdAndId(contrat.getAgence().getId(), input.getClientId())
                        .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
        Usage usageCible = resolveUsageCible(contrat, vehicule, remorque);
        LigneGrilleTarifaire ligneGrilleTarifaire = resolveLigneGrilleTarifaire(contrat, garantie, input, usageCible, vehicule, remorque);
        ModeTarificationGarantie modeSelectionne = resolveModeSelectionne(garantie, ligneGrilleTarifaire, input);
        SourceValeurGarantie sourceValeurSelectionnee = resolveSourceValeurSelectionnee(garantie, input, modeSelectionne, remorque);
        FormuleGarantiePersonne formuleGarantiePersonne = resolveFormuleGarantiePersonne(input.getFormuleGarantiePersonneId(), contrat, garantie, usageCible);
        GarantieMontants montants = resolveGarantieMontants(contrat, input, garantie, ligneGrilleTarifaire, vehicule, remorque, usageCible, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne);
        validateGarantieTarget(garantie, vehicule, remorque, client);
        validateGarantieConfiguration(contrat, garantie, input, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne, ligneGrilleTarifaire, montants);
        validateLigneGrilleTarifaire(contrat, garantie, ligneGrilleTarifaire, modeSelectionne, usageCible, vehicule);
        return saveContratGarantie(
                contrat,
                garantie,
                vehicule,
                remorque,
                client,
                ligneGrilleTarifaire,
                modeSelectionne,
                sourceValeurSelectionnee,
                formuleGarantiePersonne,
                montants
        );
    }

    private ContratGarantie saveContratGarantie(
            Contrat contrat,
            Garantie garantie,
            Vehicule vehicule,
            Remorque remorque,
            Client client,
            LigneGrilleTarifaire ligneGrilleTarifaire,
            ModeTarificationGarantie modeSelectionne,
            SourceValeurGarantie sourceValeurSelectionnee,
            FormuleGarantiePersonne formuleGarantiePersonne,
            GarantieMontants montants
    ) {
        return contratGarantieRepository.save(ContratGarantie.builder()
                .contrat(contrat)
                .garantie(garantie)
                .vehicule(vehicule)
                .remorque(remorque)
                .client(client)
                .ligneGrilleTarifaire(ligneGrilleTarifaire)
                .modeSelectionne(modeSelectionne)
                .sourceValeurSelectionnee(sourceValeurSelectionnee)
                .formuleGarantiePersonne(formuleGarantiePersonne)
                .valeurVenale(montants.valeurVenale())
                .valeurNeuf(montants.valeurNeuf())
                .valeurGlace(montants.valeurGlace())
                .formule(montants.formule())
                .montantDeces(montants.montantDeces())
                .montantInvalidite(montants.montantInvalidite())
                .montantFraisMedicaux(montants.montantFraisMedicaux())
                .montantFraisHospitalisation(montants.montantFraisHospitalisation())
                .montantFraisFuneraires(montants.montantFraisFuneraires())
                .montantFraisChirurgie(montants.montantFraisChirurgie())
                .accessoire(montants.accessoire())
                .capital(montants.capital())
                .taux(montants.taux())
                .prime(montants.prime())
                .tauxFranchise(montants.tauxFranchise())
                .franchiseMinimale(montants.franchiseMinimale())
                .build());
    }

    @Transactional
    public List<ContratResponse> list(Long agenceId) {
        Map<Long, List<AvenantDraftSummaryResponse>> draftsByContrat = avenantDraftService.listSummaries(agenceId).stream()
                .collect(java.util.stream.Collectors.groupingBy(AvenantDraftSummaryResponse::getContratId));
        return contratRepository.findByAgenceIdAndProspectionFalseOrderByCreatedAtDesc(agenceId).stream()
                .map(this::ensureNumeroDossier)
                .sorted(Comparator.<Contrat, LocalDateTime>comparing(
                        contrat -> latestContratActivityAt(contrat, draftsByContrat.getOrDefault(contrat.getId(), List.of())),
                        Comparator.nullsLast(Comparator.naturalOrder())
                ).reversed())
                .map(contrat -> {
                    ContratResponse response = toListResponse(contrat);
                    response.setAvenantDrafts(draftsByContrat.getOrDefault(contrat.getId(), List.of()));
                    return response;
                })
                .toList();
    }

    private LocalDateTime latestContratActivityAt(
            Contrat contrat,
            List<AvenantDraftSummaryResponse> drafts
    ) {
        LocalDateTime latestMouvement = (contrat.getMouvements() == null ? List.<MouvementContrat>of() : contrat.getMouvements()).stream()
                .map(MouvementContrat::getCreatedAt)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        LocalDateTime latestDraft = drafts.stream()
                .map(AvenantDraftSummaryResponse::getUpdatedAt)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
        return java.util.stream.Stream.of(contrat.getCreatedAt(), latestMouvement, latestDraft)
                .filter(java.util.Objects::nonNull)
                .max(Comparator.naturalOrder())
                .orElse(null);
    }

    @Transactional
    public List<ContratResponse> listProspections(Long agenceId) {
        return contratRepository.findByAgenceIdAndProspectionTrueAndTypeContratOrderByCreatedAtDesc(agenceId, TypeContrat.FLOTTE).stream()
                .map(this::ensureNumeroDevis)
                .map(this::ensureNumeroDossier)
                .map(this::toListResponse)
                .toList();
    }

    @Transactional
    public ContratResponse convertirProspection(Long agenceId, Long contratId, ConvertirProspectionRequest request) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (!Boolean.TRUE.equals(contrat.getProspection())) {
            throw new BadRequestException("Ce devis est deja converti en contrat");
        }
        if (contrat.getTypeContrat() != TypeContrat.FLOTTE) {
            throw new BadRequestException("La prospection est disponible uniquement pour les flottes");
        }
        if (contrat.getCompagnieAssurance() == null) {
            throw new BadRequestException("La compagnie est obligatoire pour convertir le devis");
        }
        if (contrat.getDateEffet() == null || contrat.getDateEcheance() == null) {
            throw new BadRequestException("Les dates du contrat sont obligatoires pour convertir le devis");
        }
        if ((contrat.getVehicules() == null || contrat.getVehicules().isEmpty())
                && (contrat.getRemorques() == null || contrat.getRemorques().isEmpty())) {
            throw new BadRequestException("Au moins un vehicule ou une remorque est obligatoire pour convertir le devis");
        }
        if (contrat.getGaranties() == null || contrat.getGaranties().isEmpty()) {
            throw new BadRequestException("Au moins une garantie est obligatoire pour convertir le devis");
        }
        if (request == null || !hasText(request.getNumeroPolice())) {
            throw new BadRequestException("Numero de police obligatoire pour convertir le devis");
        }
        contrat.setNumeroPolice(blankToNull(request.getNumeroPolice()));
        if (!hasText(contrat.getNumeroDevis())) {
            contrat.setNumeroDevis(nextNumeroDevis(contrat.getAgence(), contrat.getCompagnieAssurance()));
        }
        appliquerAttestationsProspection(contrat, request);
        appliquerReferencesAssistanceProspection(contrat, request);
        if (!hasText(contrat.getNumeroDossier())) {
            contrat.setNumeroDossier(nextNumeroDossier(contrat.getAgence(), contrat.getCompagnieAssurance(), contrat.getDateEffet()));
        }
        contrat.setProspection(false);
        contrat.setBrouillon(false);
        contrat.setStatut(StatutContrat.ACTIVE);
        contrat = contratRepository.save(contrat);
        if (contrat.getMouvements() == null || contrat.getMouvements().isEmpty()) {
            mouvementContratService.creerAffaireNouvelle(
                    contrat,
                    contrat.getVehicules(),
                    contrat.getRemorques(),
                    contrat.getGaranties()
            );
        }
        return toResponse(contrat);
    }

    private void appliquerAttestationsProspection(Contrat contrat, ConvertirProspectionRequest request) {
        Map<Long, String> attestationsVehicules = new HashMap<>();
        Map<Long, String> attestationsRemorques = new HashMap<>();
        if (request != null && request.getVehicules() != null) {
            for (ConvertirProspectionRequest.AttestationVehicule ligne : request.getVehicules()) {
                if (ligne.getVehiculeId() != null) {
                    attestationsVehicules.put(ligne.getVehiculeId(), blankToNull(ligne.getNumeroAttestation()));
                }
            }
        }
        if (request != null && request.getRemorques() != null) {
            for (ConvertirProspectionRequest.AttestationRemorque ligne : request.getRemorques()) {
                if (ligne.getRemorqueId() != null) {
                    attestationsRemorques.put(ligne.getRemorqueId(), blankToNull(ligne.getNumeroAttestation()));
                }
            }
        }

        for (Vehicule vehicule : contrat.getVehicules() == null ? List.<Vehicule>of() : contrat.getVehicules()) {
            String numero = attestationsVehicules.containsKey(vehicule.getId())
                    ? attestationsVehicules.get(vehicule.getId())
                    : blankToNull(vehicule.getNumeroAttestation());
            if (vehiculeConsommeAttestation(vehicule) && !hasText(numero)) {
                throw new BadRequestException("Le numero d'attestation est obligatoire pour le vehicule " + libelleVehicule(vehicule));
            }
            vehicule.setNumeroAttestation(numero);
        }

        for (Remorque remorque : contrat.getRemorques() == null ? List.<Remorque>of() : contrat.getRemorques()) {
            String numero = attestationsRemorques.containsKey(remorque.getId())
                    ? attestationsRemorques.get(remorque.getId())
                    : blankToNull(remorque.getNumeroAttestation());
            if (remorqueConsommeAttestation(remorque) && !hasText(numero)) {
                throw new BadRequestException("Le numero d'attestation est obligatoire pour la remorque " + libelleRemorque(remorque));
            }
            remorque.setNumeroAttestation(numero);
        }
    }

    private void appliquerReferencesAssistanceProspection(Contrat contrat, ConvertirProspectionRequest request) {
        Map<Long, String> references = new HashMap<>();
        if (request != null && request.getAssistances() != null) {
            for (ConvertirProspectionRequest.Assistance ligne : request.getAssistances()) {
                if (ligne.getAssistanceId() != null) {
                    references.put(ligne.getAssistanceId(), blankToNull(ligne.getNumeroContratOuQuittance()));
                }
            }
        }

        for (AssistanceContrat assistance : contrat.getAssistances() == null ? List.<AssistanceContrat>of() : contrat.getAssistances()) {
            if (!Boolean.TRUE.equals(assistance.getActif())) {
                continue;
            }
            String reference = references.containsKey(assistance.getId())
                    ? references.get(assistance.getId())
                    : blankToNull(assistance.getNumeroContratOuQuittance());
            if (!hasText(reference)) {
                throw new BadRequestException("Le numero de contrat/quittance assistance est obligatoire");
            }
            assistance.setNumeroContratOuQuittance(reference);
            assistance.setNumeroPoliceContrat(contrat.getNumeroPolice());
            assistanceContratRepository.save(assistance);
        }
    }

    private boolean vehiculeConsommeAttestation(Vehicule vehicule) {
        return vehicule != null && vehicule.getUsage() != null && Boolean.TRUE.equals(vehicule.getUsage().getConsommeAttestation());
    }

    private boolean remorqueConsommeAttestation(Remorque remorque) {
        return remorque != null && remorque.getUsage() != null && Boolean.TRUE.equals(remorque.getUsage().getConsommeAttestation());
    }

    private String libelleVehicule(Vehicule vehicule) {
        if (vehicule == null) {
            return "";
        }
        return hasText(vehicule.getImmatriculation()) ? vehicule.getImmatriculation() : "#" + vehicule.getId();
    }

    private String libelleRemorque(Remorque remorque) {
        if (remorque == null) {
            return "";
        }
        return hasText(remorque.getImmatriculation()) ? remorque.getImmatriculation() : "#" + remorque.getId();
    }

    @Transactional
    public ContratResponse get(Long agenceId, Long contratId) {
        return get(agenceId, contratId, null);
    }

    @Transactional
    public ContratResponse get(Long agenceId, Long contratId, Long mouvementId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        return toResponse(ensureNumeroDossier(ensureNumeroDevis(contrat)), true, mouvementId);
    }

    @Transactional
    public ContratResponse getAvenantContext(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        return toResponse(ensureNumeroDossier(ensureNumeroDevis(contrat)), true, null, false);
    }

    @Transactional(readOnly = true)
    public AvenantRequest getAvenantRectification(Long agenceId, Long contratId, Long mouvementId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        MouvementContrat mouvement = resolveRectifiableMovement(agenceId, contrat, mouvementId);
        return toAvenantRequest(mouvement);
    }

    @Transactional
    public QuittanceResponse rectifierAvenant(
            Long agenceId,
            Long contratId,
            Long mouvementId,
            AvenantRequest request
    ) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        MouvementContrat mouvement = resolveRectifiableMovement(agenceId, contrat, mouvementId);
        String originalCode = mouvement.getTypeMouvement().getCode();
        if (request == null || !originalCode.equalsIgnoreCase(request.getCodeTypeMouvement())) {
            throw new BadRequestException("Le type de l'avenant rectifie ne peut pas etre modifie");
        }
        if (pieceJointeRepository.countByMouvementContratId(mouvementId) > 0) {
            throw new BadRequestException("Cet avenant contient des pieces jointes. Retirez-les avant la rectification.");
        }
        if (carteVerteRepository.countByMouvementContratIdAndActifTrue(mouvementId) > 0) {
            throw new BadRequestException("Cet avenant contient une carte verte. Retirez-la avant la rectification.");
        }
        if (quittanceRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvementId).stream()
                .anyMatch(quittance -> Boolean.TRUE.equals(quittance.getPayee()))) {
            throw new BadRequestException("Une quittance de cet avenant est payee. Utilisez un mouvement comptable de correction.");
        }
        if (isModificationGarantiesAvenant(request)
                && mouvementGarantieRepository.findByMouvementContratId(mouvementId).stream()
                .noneMatch(snapshot -> snapshot.getNature() == NatureSnapshotMouvement.AVANT)) {
            throw new BadRequestException("Cet ancien avenant ne contient pas l'etat garanties avant modification et ne peut pas etre rectifie automatiquement.");
        }

        libererStockMouvement(contrat, mouvement);
        desactiverDependancesMouvement(mouvementId);
        rollbackCurrentStateForMovementDeletion(mouvement);
        mouvement.setStatut(StatutMouvementContrat.ANNULE);
        mouvement.setNotes(appendNote(mouvement.getNotes(), "Rectifie le " + LocalDate.now()));
        mouvementContratRepository.save(mouvement);
        refreshContratStatusAfterMovementDeletion(contrat);

        request.setNumeroMouvement(null);
        request.setNotes(appendNote(request.getNotes(), "Rectification du mouvement " + mouvement.getNumeroMouvement()));
        return creerAvenant(agenceId, contratId, request);
    }

    private MouvementContrat resolveRectifiableMovement(Long agenceId, Contrat contrat, Long mouvementId) {
        MouvementContrat mouvement = mouvementContratRepository.findByContratIdAndId(contrat.getId(), mouvementId)
                .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", mouvementId));
        if (mouvement.getAgence() == null || !agenceId.equals(mouvement.getAgence().getId())) {
            throw new ResourceNotFoundException("MouvementContrat", mouvementId);
        }
        List<MouvementContrat> actifs = mouvementsActifsChronologiquesDesc(contrat);
        if (actifs.isEmpty() || !mouvementId.equals(actifs.get(0).getId())) {
            throw new BadRequestException("Seul le dernier avenant valide peut etre rectifie");
        }
        if (mouvement.getStatut() != StatutMouvementContrat.VALIDE
                || mouvement.getTypeMouvement() == null
                || mouvement.getTypeMouvement().getCategorie() == CategorieMouvementContrat.AFFAIRE_NOUVELLE
                || Boolean.TRUE.equals(mouvement.getTypeMouvement().getClotureContrat())) {
            throw new BadRequestException("Ce mouvement ne peut pas etre rectifie");
        }
        return mouvement;
    }

    private AvenantRequest toAvenantRequest(MouvementContrat mouvement) {
        AvenantRequest request = new AvenantRequest();
        request.setCodeTypeMouvement(mouvement.getTypeMouvement().getCode());
        request.setDateEffet(mouvement.getDateEffet());
        request.setDateEcheance(mouvement.getDateEcheance());
        request.setNotes(mouvement.getNotes());

        List<MouvementVehicule> vehiculeSnapshots = mouvementVehiculeRepository
                .findByMouvementContratId(mouvement.getId()).stream()
                .sorted(Comparator.comparing(MouvementVehicule::getId))
                .toList();
        List<MouvementRemorque> remorqueSnapshots = mouvementRemorqueRepository
                .findByMouvementContratId(mouvement.getId()).stream()
                .sorted(Comparator.comparing(MouvementRemorque::getId))
                .toList();
        List<MouvementGarantie> garantieSnapshots = mouvementGarantieRepository
                .findByMouvementContratId(mouvement.getId()).stream()
                .filter(snapshot -> snapshot.getNature() != NatureSnapshotMouvement.AVANT)
                .sorted(Comparator.comparing(MouvementGarantie::getId))
                .toList();

        boolean creationCibles = "INC_F".equalsIgnoreCase(request.getCodeTypeMouvement())
                || "EXR_M".equalsIgnoreCase(request.getCodeTypeMouvement());
        if (creationCibles) {
            request.setVehicules(vehiculeSnapshots.stream().map(this::toVehiculeInput).toList());
            request.setRemorques(remorqueSnapshots.stream().map(this::toRemorqueInput).toList());
        } else {
            request.setVehiculeIds(distinctIds(vehiculeSnapshots.stream()
                    .map(MouvementVehicule::getVehicule).toList()));
            request.setRemorqueIds(distinctIds(remorqueSnapshots.stream()
                    .map(MouvementRemorque::getRemorque).toList()));
        }

        Map<Long, Integer> vehiculeIndexes = targetIndexes(
                creationCibles ? vehiculeSnapshots.stream().map(MouvementVehicule::getVehicule).toList()
                        : activeVehicules(mouvement.getContrat())
        );
        Map<Long, Integer> remorqueIndexes = targetIndexes(
                creationCibles ? remorqueSnapshots.stream().map(MouvementRemorque::getRemorque).toList()
                        : activeRemorques(mouvement.getContrat())
        );
        request.setGaranties(garantieSnapshots.stream()
                .map(snapshot -> toGarantieInput(snapshot, vehiculeIndexes, remorqueIndexes))
                .toList());
        request.setAssistances(toAssistanceInputs(mouvement.getId(), vehiculeIndexes));

        if ("PRI_F".equalsIgnoreCase(request.getCodeTypeMouvement())
                || "PRI_M".equalsIgnoreCase(request.getCodeTypeMouvement())) {
            request.setPrecisions(toPrecisionInputs(vehiculeSnapshots, remorqueSnapshots));
        }
        return request;
    }

    private CreateContratRequest.VehiculeInput toVehiculeInput(MouvementVehicule snapshot) {
        CreateContratRequest.VehiculeInput input = new CreateContratRequest.VehiculeInput();
        input.setTypeVehicule(snapshot.getTypeVehicule());
        input.setUsageId(snapshot.getUsage() != null ? snapshot.getUsage().getId() : null);
        input.setMarqueId(snapshot.getMarque() != null ? snapshot.getMarque().getId() : null);
        input.setCarrosserieId(snapshot.getCarrosserie() != null ? snapshot.getCarrosserie().getId() : null);
        input.setCategorieTransportId(snapshot.getCategorieTransport() != null ? snapshot.getCategorieTransport().getId() : null);
        input.setImmatriculation(snapshot.getImmatriculation());
        input.setImmatriculationProvisoire(snapshot.getImmatriculationProvisoire());
        input.setCarburant(snapshot.getCarburant());
        input.setPuissanceFiscale(snapshot.getPuissanceFiscale());
        input.setNombrePlaces(snapshot.getNombrePlaces());
        input.setSousClasse(snapshot.getSousClasse());
        input.setPtc(snapshot.getPtc());
        input.setDatePremiereCirculation(snapshot.getDatePremiereCirculation());
        input.setDateExpirationCarteGrise(snapshot.getDateExpirationCarteGrise());
        input.setDateEffet(snapshot.getDateEffet());
        input.setDateEcheance(snapshot.getDateEcheance());
        input.setCrm(snapshot.getCrm());
        input.setNumeroAttestation(snapshot.getNumeroAttestation());
        input.setCoefficientProrata(snapshot.getCoefficientProrata());
        input.setValeurVenale(snapshot.getValeurVenale());
        input.setValeurNeuf(snapshot.getValeurNeuf());
        input.setValeurGlace(snapshot.getValeurGlace());
        input.setOrganismeCredit(snapshot.getOrganismeCredit());
        input.setNomOrganismeCredit(snapshot.getNomOrganismeCredit());
        input.setMontantCredit(snapshot.getMontantCredit());
        input.setDateFinCredit(snapshot.getDateFinCredit());
        return input;
    }

    private CreateContratRequest.RemorqueInput toRemorqueInput(MouvementRemorque snapshot) {
        CreateContratRequest.RemorqueInput input = new CreateContratRequest.RemorqueInput();
        input.setUsageId(snapshot.getUsage() != null ? snapshot.getUsage().getId() : null);
        input.setMarqueId(snapshot.getMarque() != null ? snapshot.getMarque().getId() : null);
        input.setImmatriculation(snapshot.getImmatriculation());
        input.setPtc(snapshot.getPtc());
        input.setDateMiseEnCirculation(snapshot.getDateMiseEnCirculation());
        input.setDateEffet(snapshot.getDateEffet());
        input.setDateEcheance(snapshot.getDateEcheance());
        input.setCrm(snapshot.getCrm());
        input.setNumeroAttestation(snapshot.getNumeroAttestation());
        input.setCoefficientProrata(snapshot.getCoefficientProrata());
        input.setValeurAssuree(snapshot.getValeurAssuree());
        return input;
    }

    private CreateContratRequest.GarantieInput toGarantieInput(
            MouvementGarantie snapshot,
            Map<Long, Integer> vehiculeIndexes,
            Map<Long, Integer> remorqueIndexes
    ) {
        CreateContratRequest.GarantieInput input = new CreateContratRequest.GarantieInput();
        input.setGarantieId(snapshot.getGarantie().getId());
        input.setLigneGrilleTarifaireId(snapshot.getLigneGrilleTarifaire() != null ? snapshot.getLigneGrilleTarifaire().getId() : null);
        input.setClientId(snapshot.getClient() != null ? snapshot.getClient().getId() : null);
        input.setVehiculeIndex(snapshot.getVehicule() != null ? vehiculeIndexes.get(snapshot.getVehicule().getId()) : null);
        input.setRemorqueIndex(snapshot.getRemorque() != null ? remorqueIndexes.get(snapshot.getRemorque().getId()) : null);
        input.setModeSelectionne(snapshot.getModeSelectionne() != null ? snapshot.getModeSelectionne().name() : null);
        input.setSourceValeurSelectionnee(snapshot.getSourceValeurSelectionnee() != null ? snapshot.getSourceValeurSelectionnee().name() : null);
        input.setFormuleGarantiePersonneId(snapshot.getFormuleGarantiePersonne() != null ? snapshot.getFormuleGarantiePersonne().getId() : null);
        input.setValeurVenale(snapshot.getValeurVenale());
        input.setValeurNeuf(snapshot.getValeurNeuf());
        input.setValeurGlace(snapshot.getValeurGlace());
        input.setValeurAssuree(snapshot.getCapital());
        input.setFormule(snapshot.getFormule());
        input.setMontantDeces(snapshot.getMontantDeces());
        input.setMontantInvalidite(snapshot.getMontantInvalidite());
        input.setMontantFraisMedicaux(snapshot.getMontantFraisMedicaux());
        input.setMontantFraisHospitalisation(snapshot.getMontantFraisHospitalisation());
        input.setMontantFraisFuneraires(snapshot.getMontantFraisFuneraires());
        input.setMontantFraisChirurgie(snapshot.getMontantFraisChirurgie());
        input.setAccessoire(snapshot.getAccessoire());
        input.setCapital(snapshot.getCapital());
        input.setTaux(snapshot.getTaux());
        input.setPrime(snapshot.getPrime());
        input.setTauxFranchise(snapshot.getTauxFranchise());
        input.setFranchiseMinimale(snapshot.getFranchiseMinimale());
        return input;
    }

    private List<AvenantRequest.AssistanceInput> toAssistanceInputs(
            Long mouvementId,
            Map<Long, Integer> vehiculeIndexes
    ) {
        return assistanceContratRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvementId).stream()
                .filter(assistance -> Boolean.TRUE.equals(assistance.getActif()))
                .filter(assistance -> assistance.getVehicule() != null
                        && vehiculeIndexes.containsKey(assistance.getVehicule().getId()))
                .map(assistance -> {
                    AvenantRequest.AssistanceInput input = new AvenantRequest.AssistanceInput();
                    input.setAssistanceId(assistance.getId());
                    input.setVehiculeIndex(vehiculeIndexes.get(assistance.getVehicule().getId()));
                    input.setEnabled(true);
                    input.setCompagnieAssistanceId(assistance.getCompagnieAssistance() != null
                            ? assistance.getCompagnieAssistance().getId() : null);
                    input.setProduitAssistanceId(assistance.getProduitAssistance() != null
                            ? assistance.getProduitAssistance().getId() : null);
                    input.setDateSouscription(assistance.getDateSouscription());
                    input.setDateEffet(assistance.getDateEffet());
                    input.setEcheanceCode(assistance.getEcheanceCode());
                    input.setNumeroContratOuQuittance(assistance.getNumeroContratOuQuittance());
                    input.setTypeQuittance(assistance.getTypeQuittance());
                    return input;
                })
                .toList();
    }

    private List<AvenantRequest.TargetPrecision> toPrecisionInputs(
            List<MouvementVehicule> vehicules,
            List<MouvementRemorque> remorques
    ) {
        List<AvenantRequest.TargetPrecision> result = new ArrayList<>();
        for (MouvementVehicule snapshot : vehicules) {
            if (snapshot.getVehicule() == null) {
                continue;
            }
            AvenantRequest.TargetPrecision precision = new AvenantRequest.TargetPrecision();
            precision.setVehiculeId(snapshot.getVehicule().getId());
            precision.setImmatriculation(snapshot.getVehicule().getImmatriculation());
            precision.setImmatriculationProvisoire(snapshot.getVehicule().getImmatriculationProvisoire());
            precision.setNumeroAttestation(snapshot.getVehicule().getNumeroAttestation());
            result.add(precision);
        }
        for (MouvementRemorque snapshot : remorques) {
            if (snapshot.getRemorque() == null) {
                continue;
            }
            AvenantRequest.TargetPrecision precision = new AvenantRequest.TargetPrecision();
            precision.setRemorqueId(snapshot.getRemorque().getId());
            precision.setImmatriculation(snapshot.getRemorque().getImmatriculation());
            precision.setNumeroAttestation(snapshot.getRemorque().getNumeroAttestation());
            result.add(precision);
        }
        return result;
    }

    private <T extends BaseEntity> List<Long> distinctIds(List<T> targets) {
        return targets.stream()
                .filter(target -> target != null && target.getId() != null)
                .map(BaseEntity::getId)
                .distinct()
                .toList();
    }

    private <T extends BaseEntity> Map<Long, Integer> targetIndexes(List<T> targets) {
        Map<Long, Integer> indexes = new HashMap<>();
        for (int index = 0; index < targets.size(); index++) {
            T target = targets.get(index);
            if (target != null && target.getId() != null) {
                indexes.putIfAbsent(target.getId(), index);
            }
        }
        return indexes;
    }

    private void libererStockMouvement(Contrat contrat, MouvementContrat mouvement) {
        Set<Long> liberated = new LinkedHashSet<>();
        for (MouvementStockAttestation stockMovement
                : mouvementStockAttestationRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvement.getId())) {
            if (stockMovement.getTypeMouvement() != TypeMouvementStockAttestation.UTILISATION
                    || stockMovement.getAttestationStock() == null
                    || !liberated.add(stockMovement.getAttestationStock().getId())) {
                continue;
            }
            AttestationStock attestation = stockMovement.getAttestationStock();
            attestationStockService.liberer(
                    contrat,
                    mouvement,
                    attestation.getNumero(),
                    attestation.getUsageRepresentatif()
            );
        }
    }

    private void desactiverDependancesMouvement(Long mouvementId) {
        for (AssistanceContrat assistance
                : assistanceContratRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvementId)) {
            assistance.setActif(false);
            if (assistance.getElementFacturable() != null) {
                assistance.getElementFacturable().setActif(false);
                assistance.getElementFacturable().setStatut(StatutElementFacturable.ANNULE);
                elementFacturableRepository.save(assistance.getElementFacturable());
            }
            assistanceContratRepository.save(assistance);
        }
        for (ElementFacturable element
                : elementFacturableRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvementId)) {
            element.setActif(false);
            element.setStatut(StatutElementFacturable.ANNULE);
            elementFacturableRepository.save(element);
        }
    }

    private String appendNote(String current, String addition) {
        return hasText(current) ? current.trim() + "\n" + addition : addition;
    }

    @Transactional
    public void deleteContrat(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (!mouvementsChronologiquesDesc(contrat).isEmpty()) {
            throw new BadRequestException("Impossible de supprimer ce contrat: supprimez ou annulez d'abord ses mouvements.");
        }
        if (!isDraftLike(contrat)) {
            throw new BadRequestException("Impossible de supprimer un contrat valide. Utilisez un avenant d'annulation ou de resiliation.");
        }
        contratRepository.delete(contrat);
    }

    @Transactional
    public void deleteMouvement(Long agenceId, Long contratId, Long mouvementId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        MouvementContrat mouvement = mouvementContratRepository.findByContratIdAndId(contrat.getId(), mouvementId)
                .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", mouvementId));
        if (mouvement.getAgence() == null || !agenceId.equals(mouvement.getAgence().getId())) {
            throw new ResourceNotFoundException("MouvementContrat", mouvementId);
        }
        List<MouvementContrat> mouvements = mouvementsActifsChronologiquesDesc(contrat);
        if (mouvements.isEmpty() || !mouvement.getId().equals(mouvements.get(0).getId())) {
            throw new BadRequestException("Impossible de supprimer ce mouvement: supprimez d'abord les mouvements plus recents.");
        }
        if (mouvement.getTypeMouvement() == null || mouvement.getTypeMouvement().getCategorie() == CategorieMouvementContrat.AFFAIRE_NOUVELLE) {
            throw new BadRequestException("L'affaire nouvelle ne se supprime pas depuis les actions. Supprimez le contrat brouillon ou creez un avenant d'annulation.");
        }
        assertNoBlockingMovementReferences(mouvement.getId());
        libererStockMouvement(contrat, mouvement);
        rollbackCurrentStateForMovementDeletion(mouvement);
        deleteMovementGeneratedData(mouvement.getId());
        contrat.getMouvements().removeIf(item -> mouvement.getId().equals(item.getId()));
        mouvementContratRepository.delete(mouvement);
        refreshContratStatusAfterMovementDeletion(contrat);
    }

    private List<MouvementContrat> mouvementsChronologiquesDesc(Contrat contrat) {
        return (contrat.getMouvements() == null ? List.<MouvementContrat>of() : contrat.getMouvements()).stream()
                .sorted(Comparator.comparing(MouvementContrat::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(MouvementContrat::getId, Comparator.nullsLast(Comparator.naturalOrder()))
                        .reversed())
                .toList();
    }

    private List<MouvementContrat> mouvementsActifsChronologiquesDesc(Contrat contrat) {
        return mouvementsChronologiquesDesc(contrat).stream()
                .filter(mouvement -> mouvement.getStatut() != StatutMouvementContrat.ANNULE)
                .toList();
    }

    private boolean isDraftLike(Contrat contrat) {
        return contrat.getStatut() == StatutContrat.DRAFT || Boolean.TRUE.equals(contrat.getBrouillon()) || Boolean.TRUE.equals(contrat.getProspection());
    }

    private void assertNoBlockingMovementReferences(Long mouvementId) {
        if (pieceJointeRepository.countByMouvementContratId(mouvementId) > 0) {
            throw new BadRequestException("Impossible de supprimer ce mouvement: des pieces jointes y sont liees.");
        }
        if (assistanceContratRepository.countByMouvementContratIdAndActifTrue(mouvementId) > 0) {
            throw new BadRequestException("Impossible de supprimer ce mouvement : supprimez d’abord l’assistance active qui y est liée.");
        }
        if (carteVerteRepository.countByMouvementContratIdAndActifTrue(mouvementId) > 0) {
            throw new BadRequestException("Impossible de supprimer ce mouvement : supprimez d’abord la carte verte active qui y est liée.");
        }
        if (quittanceRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvementId).stream()
                .anyMatch(quittance -> Boolean.TRUE.equals(quittance.getPayee()))) {
            throw new BadRequestException("Impossible de supprimer ce mouvement : une quittance est déjà payée.");
        }
    }

    private void deleteMovementGeneratedData(Long mouvementId) {
        List<AssistanceContrat> assistances = assistanceContratRepository
                .findByMouvementContratIdOrderByCreatedAtDesc(mouvementId);
        if (!assistances.isEmpty()) {
            assistanceContratRepository.deleteAll(assistances);
            assistanceContratRepository.flush();
        }
        List<CarteVerte> cartesVertes = carteVerteRepository
                .findByMouvementContratIdOrderByCreatedAtDesc(mouvementId);
        if (!cartesVertes.isEmpty()) {
            carteVerteRepository.deleteAll(cartesVertes);
            carteVerteRepository.flush();
        }
        for (Quittance quittance : quittanceRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvementId)) {
            ligneQuittanceRepository.deleteByQuittanceId(quittance.getId());
            quittanceRepository.delete(quittance);
        }
        for (ElementFacturable element : elementFacturableRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvementId)) {
            elementFacturableCibleRepository.deleteByElementFacturableId(element.getId());
            elementFacturableRepository.delete(element);
        }
        mouvementGarantieRepository.deleteByMouvementContratId(mouvementId);
        mouvementRemorqueRepository.deleteByMouvementContratId(mouvementId);
        mouvementVehiculeRepository.deleteByMouvementContratId(mouvementId);
        mouvementStockAttestationRepository.deleteByMouvementContratId(mouvementId);
        mouvementStockAttestationRepository.flush();
    }

    private void rollbackCurrentStateForMovementDeletion(MouvementContrat mouvement) {
        if (mouvement == null || mouvement.getId() == null) {
            return;
        }
        List<MouvementVehicule> vehiculeSnapshots = mouvementVehiculeRepository.findByMouvementContratId(mouvement.getId());
        List<MouvementRemorque> remorqueSnapshots = mouvementRemorqueRepository.findByMouvementContratId(mouvement.getId());
        List<MouvementGarantie> garantieSnapshots = mouvementGarantieRepository.findByMouvementContratId(mouvement.getId());

        List<Vehicule> vehiculesToSave = new ArrayList<>();
        for (MouvementVehicule snapshot : vehiculeSnapshots) {
            if (snapshot.getVehicule() == null) {
                continue;
            }
            Boolean actif = actifApresSuppressionSnapshot(snapshot.getNature());
            if (actif != null) {
                snapshot.getVehicule().setActif(actif);
            }
            if (snapshot.getNature() == NatureSnapshotMouvement.COURANT
                    || snapshot.getNature() == NatureSnapshotMouvement.AVANT) {
                restoreVehiculeSnapshot(snapshot);
            }
            vehiculesToSave.add(snapshot.getVehicule());
        }
        if (!vehiculesToSave.isEmpty()) {
            vehiculeRepository.saveAll(vehiculesToSave);
        }

        List<Remorque> remorquesToSave = new ArrayList<>();
        for (MouvementRemorque snapshot : remorqueSnapshots) {
            if (snapshot.getRemorque() == null) {
                continue;
            }
            Boolean actif = actifApresSuppressionSnapshot(snapshot.getNature());
            if (actif != null) {
                snapshot.getRemorque().setActif(actif);
            }
            if (snapshot.getNature() == NatureSnapshotMouvement.COURANT
                    || snapshot.getNature() == NatureSnapshotMouvement.AVANT) {
                restoreRemorqueSnapshot(snapshot);
            }
            remorquesToSave.add(snapshot.getRemorque());
        }
        if (!remorquesToSave.isEmpty()) {
            remorqueRepository.saveAll(remorquesToSave);
        }

        List<ContratGarantie> garantiesToSave = new ArrayList<>();
        for (MouvementGarantie snapshot : garantieSnapshots) {
            if (snapshot.getContratGarantie() == null) {
                continue;
            }
            Boolean actif = actifApresSuppressionSnapshot(snapshot.getNature());
            if (actif != null) {
                snapshot.getContratGarantie().setActif(actif);
            }
            if (snapshot.getNature() == NatureSnapshotMouvement.AVANT) {
                snapshot.getContratGarantie().setActif(true);
            } else if (snapshot.getNature() == NatureSnapshotMouvement.APRES) {
                snapshot.getContratGarantie().setActif(false);
            }
            garantiesToSave.add(snapshot.getContratGarantie());
        }
        if (!garantiesToSave.isEmpty()) {
            contratGarantieRepository.saveAll(garantiesToSave);
        }
        updateTargetCounts(mouvement.getContrat());
    }

    private void restoreVehiculeSnapshot(MouvementVehicule snapshot) {
        Vehicule vehicule = snapshot.getVehicule();
        vehicule.setTypeVehicule(snapshot.getTypeVehicule());
        vehicule.setUsage(snapshot.getUsage());
        vehicule.setMarque(snapshot.getMarque());
        vehicule.setCarrosserie(snapshot.getCarrosserie());
        vehicule.setCategorieTransport(snapshot.getCategorieTransport());
        vehicule.setImmatriculation(snapshot.getImmatriculation());
        vehicule.setImmatriculationProvisoire(snapshot.getImmatriculationProvisoire());
        vehicule.setCarburant(snapshot.getCarburant());
        vehicule.setPuissanceFiscale(snapshot.getPuissanceFiscale());
        vehicule.setNombrePlaces(snapshot.getNombrePlaces());
        vehicule.setSousClasse(snapshot.getSousClasse());
        vehicule.setPtc(snapshot.getPtc());
        vehicule.setDatePremiereCirculation(snapshot.getDatePremiereCirculation());
        vehicule.setDateExpirationCarteGrise(snapshot.getDateExpirationCarteGrise());
        vehicule.setDateEffet(snapshot.getDateEffet());
        vehicule.setDateEcheance(snapshot.getDateEcheance());
        vehicule.setCrm(snapshot.getCrm());
        vehicule.setNumeroAttestation(snapshot.getNumeroAttestation());
        vehicule.setCoefficientProrata(snapshot.getCoefficientProrata());
        vehicule.setValeurVenale(snapshot.getValeurVenale());
        vehicule.setValeurNeuf(snapshot.getValeurNeuf());
        vehicule.setValeurGlace(snapshot.getValeurGlace());
        vehicule.setOrganismeCredit(snapshot.getOrganismeCredit());
        vehicule.setNomOrganismeCredit(snapshot.getNomOrganismeCredit());
        vehicule.setMontantCredit(snapshot.getMontantCredit());
        vehicule.setDateFinCredit(snapshot.getDateFinCredit());
    }

    private void restoreRemorqueSnapshot(MouvementRemorque snapshot) {
        Remorque remorque = snapshot.getRemorque();
        remorque.setUsage(snapshot.getUsage());
        remorque.setMarque(snapshot.getMarque());
        remorque.setImmatriculation(snapshot.getImmatriculation());
        remorque.setPtc(snapshot.getPtc());
        remorque.setDateMiseEnCirculation(snapshot.getDateMiseEnCirculation());
        remorque.setDateEffet(snapshot.getDateEffet());
        remorque.setDateEcheance(snapshot.getDateEcheance());
        remorque.setCrm(snapshot.getCrm());
        remorque.setNumeroAttestation(snapshot.getNumeroAttestation());
        remorque.setCoefficientProrata(snapshot.getCoefficientProrata());
        remorque.setValeurAssuree(snapshot.getValeurAssuree());
    }

    private Boolean actifApresSuppressionSnapshot(NatureSnapshotMouvement nature) {
        if (nature == NatureSnapshotMouvement.RETRAIT) {
            return true;
        }
        if (nature == NatureSnapshotMouvement.AJOUT) {
            return false;
        }
        if (nature == NatureSnapshotMouvement.AVANT) {
            return true;
        }
        if (nature == NatureSnapshotMouvement.APRES) {
            return false;
        }
        return null;
    }

    private void refreshContratStatusAfterMovementDeletion(Contrat contrat) {
        List<MouvementContrat> actifs = (contrat.getMouvements() == null ? List.<MouvementContrat>of() : contrat.getMouvements()).stream()
                .filter(mouvement -> mouvement.getStatut() != StatutMouvementContrat.ANNULE)
                .sorted(Comparator.comparing(MouvementContrat::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder())).reversed())
                .toList();
        MouvementContrat latest = actifs.isEmpty() ? null : actifs.get(0);
        if (latest != null && latest.getTypeMouvement() != null && Boolean.TRUE.equals(latest.getTypeMouvement().getClotureContrat())) {
            contrat.setStatut(StatutContrat.CANCELLED);
        } else if (!Boolean.TRUE.equals(contrat.getBrouillon()) && !Boolean.TRUE.equals(contrat.getProspection())) {
            contrat.setStatut(StatutContrat.ACTIVE);
        }
        contratRepository.save(contrat);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse previsualiserAvenant(Long agenceId, Long contratId, AvenantRequest request) {
        if (isModificationGarantiesAvenant(request)) {
            AvenantModificationGraph graph = resolveModificationGarantiesAvenant(agenceId, contratId, request, false);
            validateAvenantAssistances(request, graph.vehicules());
            QuittanceResponse quittance = mouvementContratService.previsualiserMouvementSpecialise(
                    graph.contrat(),
                    graph.typeMouvement(),
                    toMouvementRequest(request, graph.contrat()),
                    graph.nouvellesGaranties(),
                    graph.vehicules(),
                    graph.remorques(),
                    graph.differentiel(),
                    graph.garantiesDifferentielles()
            );
            quittance.setAssistances(previewAvenantAssistances(graph.contrat(), graph.vehicules(), request));
            return quittance;
        }
        AvenantGraph graph = resolveAvenantGraph(agenceId, contratId, request, false);
        validateAvenantAssistances(request, graph.vehicules());
        QuittanceCalculService.Resultat retourPrime = calculerRetourPrime(graph, request);
        if (retourPrime != null) {
            QuittanceResponse quittance = mouvementContratService.previsualiserMouvementSpecialise(
                    graph.contrat(),
                    graph.typeMouvement(),
                    toMouvementRequest(request, graph.contrat()),
                    graph.garanties(),
                    graph.vehicules(),
                    graph.remorques(),
                    retourPrime
            );
            quittance.setAssistances(previewAvenantAssistances(graph.contrat(), graph.vehicules(), request));
            return quittance;
        }
        QuittanceResponse quittance = mouvementContratService.previsualiserMouvementSpecialise(
                graph.contrat(),
                graph.typeMouvement(),
                toMouvementRequest(request, graph.contrat()),
                graph.garanties(),
                graph.vehicules(),
                graph.remorques()
        );
        quittance.setAssistances(previewAvenantAssistances(graph.contrat(), graph.vehicules(), request));
        return quittance;
    }

    @Transactional
    public QuittanceResponse creerAvenant(Long agenceId, Long contratId, AvenantRequest request) {
        if (isModificationGarantiesAvenant(request)) {
            AvenantModificationGraph graph = resolveModificationGarantiesAvenant(agenceId, contratId, request, true);
            validateAvenantAssistances(request, graph.vehicules());
            QuittanceResponse quittance = mouvementContratService.creerMouvementSpecialise(
                    graph.contrat(),
                    graph.typeMouvement(),
                    toMouvementRequest(request, graph.contrat()),
                    graph.nouvellesGaranties(),
                    graph.vehicules(),
                    graph.remorques(),
                    NatureSnapshotMouvement.COURANT,
                    graph.differentiel()
            );
            if (quittance.getMouvementContratId() != null) {
                mouvementContratService.remplacerSnapshotsGaranties(
                        quittance.getMouvementContratId(),
                        graph.anciennesGaranties(),
                        graph.nouvellesGaranties()
                );
            }
            quittance.setAssistances(persistAvenantAssistances(
                    graph.contrat(),
                    graph.vehicules(),
                    request,
                    quittance.getMouvementContratId()
            ));
            deleteAvenantDraft(graph.contrat(), request);
            return quittance;
        }
        AvenantGraph graph = resolveAvenantGraph(agenceId, contratId, request, true);
        validateAvenantAssistances(request, graph.vehicules());
        QuittanceCalculService.Resultat retourPrime = calculerRetourPrime(graph, request);
        QuittanceResponse quittance = retourPrime == null
                ? mouvementContratService.creerMouvementSpecialise(
                        graph.contrat(),
                        graph.typeMouvement(),
                        toMouvementRequest(request, graph.contrat()),
                        graph.garanties(),
                        graph.vehicules(),
                        graph.remorques(),
                        graph.snapshotNature()
                )
                : mouvementContratService.creerMouvementSpecialise(
                        graph.contrat(),
                        graph.typeMouvement(),
                        toMouvementRequest(request, graph.contrat()),
                        graph.garanties(),
                        graph.vehicules(),
                        graph.remorques(),
                        graph.snapshotNature(),
                        retourPrime
                );
        quittance.setAssistances(persistAvenantAssistances(
                graph.contrat(),
                graph.vehicules(),
                request,
                quittance.getMouvementContratId()
        ));
        applyAvenantCurrentState(graph, request);
        deleteAvenantDraft(graph.contrat(), request);
        return quittance;
    }

    private void deleteAvenantDraft(Contrat contrat, AvenantRequest request) {
        if (contrat == null) {
            return;
        }
        if (contrat.getStatut() != StatutContrat.ACTIVE) {
            avenantDraftRepository.deleteByContratId(contrat.getId());
            return;
        }
        if (request != null && hasText(request.getCodeTypeMouvement())) {
            avenantDraftRepository.deleteByContratIdAndTypeMouvementCodeIgnoreCase(
                    contrat.getId(),
                    request.getCodeTypeMouvement().trim()
            );
        }
    }

    private AvenantGraph resolveAvenantGraph(Long agenceId, Long contratId, AvenantRequest request, boolean persistIncorporation) {
        if (request == null || !hasText(request.getCodeTypeMouvement())) {
            throw new BadRequestException("Le type d'avenant est obligatoire");
        }
        if (request.getDateEffet() == null) {
            throw new BadRequestException("La date d'effet de l'avenant est obligatoire");
        }
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (Boolean.TRUE.equals(contrat.getBrouillon()) || Boolean.TRUE.equals(contrat.getProspection()) || contrat.getStatut() != StatutContrat.ACTIVE) {
            throw new BadRequestException("Le contrat doit etre actif pour creer un avenant");
        }
        validateAvenantDates(contrat, request);
        TypeMouvementContrat typeMouvement = mouvementContratService.resolveTypeMouvementPourContrat(request.getCodeTypeMouvement(), contrat.getTypeContrat());
        String code = typeMouvement.getCode() == null ? "" : typeMouvement.getCode().trim().toUpperCase(Locale.ROOT);
        return switch (code) {
            case "INC_F" -> resolveIncorporationAvenant(contrat, typeMouvement, request, persistIncorporation);
            case "RET_F" -> resolveRetraitAvenant(contrat, typeMouvement, request);
            case "EXR_F" -> resolveExtensionRemorqueAvenant(contrat, typeMouvement, request);
            case "RES_F" -> resolveResiliationAvenant(contrat, typeMouvement);
            case "RCH_F" -> resolveResiliationEcheanceAvenant(contrat, typeMouvement);
            case "PRI_F" -> resolvePrecisionAvenant(contrat, typeMouvement, request);
            case "DUP_F" -> resolveDuplicataAvenant(contrat, typeMouvement, request);
            case "EXR_M" -> resolveIncorporationAvenant(contrat, typeMouvement, request, persistIncorporation);
            case "RES_M", "ANN_M" -> resolveResiliationAvenant(contrat, typeMouvement);
            case "RCH_M" -> resolveResiliationEcheanceAvenant(contrat, typeMouvement);
            case "PRI_M" -> resolvePrecisionAvenant(contrat, typeMouvement, request);
            case "DUP_M" -> resolveDuplicataAvenant(contrat, typeMouvement, request);
            default -> throw new BadRequestException("Le type d'avenant " + typeMouvement.getCode() + " n'est pas encore pris en charge par l'API specialisee");
        };
    }

    private AvenantGraph resolveIncorporationAvenant(Contrat contrat, TypeMouvementContrat typeMouvement, AvenantRequest request, boolean persist) {
        if ((request.getVehicules() == null || request.getVehicules().isEmpty())
                && (request.getRemorques() == null || request.getRemorques().isEmpty())) {
            throw new BadRequestException("Au moins un vehicule ou une remorque est obligatoire pour l'incorporation");
        }
        AvenantTargets targets = persist
                ? persistAvenantTargets(contrat, request)
                : buildAvenantTargetsPreview(contrat, request);
        if (targets.garanties().isEmpty()) {
            throw new BadRequestException("Au moins une garantie est obligatoire pour l'incorporation");
        }
        validateAvenantAssistances(request, targets.vehicules());
        return new AvenantGraph(contrat, typeMouvement, targets.vehicules(), targets.remorques(), targets.garanties(), NatureSnapshotMouvement.AJOUT);
    }

    private void validateAvenantAssistances(AvenantRequest request, List<Vehicule> vehicules) {
        for (AvenantRequest.AssistanceInput input : request.getAssistances() == null
                ? List.<AvenantRequest.AssistanceInput>of()
                : request.getAssistances()) {
            if (input.getVehiculeIndex() == null
                    || input.getVehiculeIndex() < 0
                    || input.getVehiculeIndex() >= vehicules.size()) {
                throw new BadRequestException("L'assistance cible un vehicule invalide");
            }
            if (!Boolean.FALSE.equals(input.getEnabled())
                    && (input.getCompagnieAssistanceId() == null || input.getProduitAssistanceId() == null)) {
                throw new BadRequestException("La compagnie et le produit d'assistance sont obligatoires");
            }
        }
    }

    private List<AssistanceContratResponse> previewAvenantAssistances(
            Contrat contrat,
            List<Vehicule> vehicules,
            AvenantRequest request
    ) {
        List<AssistanceContratResponse> responses = new ArrayList<>();
        for (AvenantRequest.AssistanceInput input : request.getAssistances() == null
                ? List.<AvenantRequest.AssistanceInput>of()
                : request.getAssistances()) {
            if (Boolean.FALSE.equals(input.getEnabled())) {
                continue;
            }
            Vehicule vehicule = vehicules.get(input.getVehiculeIndex());
            responses.add(assistanceContratService.preview(
                    contrat,
                    vehicule,
                    toAssistanceUpsertRequest(input, request, vehicule.getId(), null)
            ));
        }
        return responses;
    }

    private List<AssistanceContratResponse> persistAvenantAssistances(
            Contrat contrat,
            List<Vehicule> vehicules,
            AvenantRequest request,
            Long mouvementContratId
    ) {
        List<AvenantRequest.AssistanceInput> inputs = request.getAssistances() == null
                ? List.of()
                : request.getAssistances();
        if (inputs.isEmpty()) {
            return List.of();
        }
        if (mouvementContratId == null) {
            throw new BadRequestException("Le mouvement de l'avenant est requis pour enregistrer l'assistance");
        }
        List<AssistanceContratResponse> responses = new ArrayList<>();
        for (AvenantRequest.AssistanceInput input : inputs) {
            if (input.getVehiculeIndex() == null
                    || input.getVehiculeIndex() < 0
                    || input.getVehiculeIndex() >= vehicules.size()) {
                throw new BadRequestException("L'assistance cible un vehicule invalide");
            }
            Vehicule vehicule = vehicules.get(input.getVehiculeIndex());
            if (Boolean.FALSE.equals(input.getEnabled())) {
                if (input.getAssistanceId() != null) {
                    assistanceContratService.deactivate(
                            contrat.getAgence().getId(),
                            contrat.getId(),
                            input.getAssistanceId()
                    );
                }
                continue;
            }
            if (input.getCompagnieAssistanceId() == null || input.getProduitAssistanceId() == null) {
                throw new BadRequestException("La compagnie et le produit d'assistance sont obligatoires");
            }
            responses.add(assistanceContratService.upsert(
                    contrat.getAgence().getId(),
                    contrat.getId(),
                    toAssistanceUpsertRequest(input, request, vehicule.getId(), mouvementContratId)
            ));
        }
        return responses;
    }

    private UpsertAssistanceContratRequest toAssistanceUpsertRequest(
            AvenantRequest.AssistanceInput input,
            AvenantRequest request,
            Long vehiculeId,
            Long mouvementContratId
    ) {
        UpsertAssistanceContratRequest assistanceRequest = new UpsertAssistanceContratRequest();
        assistanceRequest.setMouvementContratId(mouvementContratId);
        assistanceRequest.setVehiculeId(vehiculeId);
        assistanceRequest.setCompagnieAssistanceId(input.getCompagnieAssistanceId());
        assistanceRequest.setProduitAssistanceId(input.getProduitAssistanceId());
        assistanceRequest.setDateSouscription(input.getDateSouscription());
        assistanceRequest.setDateEffet(firstNonNull(input.getDateEffet(), request.getDateEffet()));
        assistanceRequest.setEcheanceCode(input.getEcheanceCode());
        assistanceRequest.setNumeroContratOuQuittance(input.getNumeroContratOuQuittance());
        assistanceRequest.setTypeQuittance(hasText(input.getTypeQuittance()) ? input.getTypeQuittance() : "AVENANT");
        return assistanceRequest;
    }

    private AvenantGraph resolveRetraitAvenant(Contrat contrat, TypeMouvementContrat typeMouvement, AvenantRequest request) {
        List<Vehicule> vehicules = selectedActiveVehicules(contrat, request.getVehiculeIds(), false);
        List<Remorque> remorques = selectedActiveRemorques(contrat, request.getRemorqueIds(), false);
        if (vehicules.isEmpty() && remorques.isEmpty()) {
            throw new BadRequestException("Selectionnez au moins un vehicule ou une remorque a retirer");
        }
        List<ContratGarantie> garanties = activeGarantiesForTargets(contrat, vehicules, remorques);
        return new AvenantGraph(contrat, typeMouvement, vehicules, remorques, garanties, NatureSnapshotMouvement.RETRAIT);
    }

    private AvenantGraph resolveExtensionRemorqueAvenant(Contrat contrat, TypeMouvementContrat typeMouvement, AvenantRequest request) {
        List<Remorque> remorques = selectedActiveRemorques(contrat, request.getRemorqueIds(), false);
        if (remorques.isEmpty()) {
            throw new BadRequestException("Selectionnez au moins une remorque pour l'extension");
        }
        List<ContratGarantie> garanties = activeGarantiesForTargets(contrat, List.of(), remorques);
        return new AvenantGraph(contrat, typeMouvement, List.of(), remorques, garanties, NatureSnapshotMouvement.COURANT);
    }

    private AvenantGraph resolveResiliationAvenant(Contrat contrat, TypeMouvementContrat typeMouvement) {
        List<Vehicule> vehicules = activeVehicules(contrat);
        List<Remorque> remorques = activeRemorques(contrat);
        List<ContratGarantie> garanties = activeGaranties(contrat);
        return new AvenantGraph(contrat, typeMouvement, vehicules, remorques, garanties, NatureSnapshotMouvement.RETRAIT);
    }

    private AvenantGraph resolveResiliationEcheanceAvenant(Contrat contrat, TypeMouvementContrat typeMouvement) {
        return new AvenantGraph(contrat, typeMouvement, activeVehicules(contrat), activeRemorques(contrat), List.of(), NatureSnapshotMouvement.COURANT);
    }

    private AvenantGraph resolvePrecisionAvenant(Contrat contrat, TypeMouvementContrat typeMouvement, AvenantRequest request) {
        SelectionIds ids = precisionSelectionIds(request);
        List<Vehicule> vehicules = selectedActiveVehicules(contrat, ids.vehiculeIds(), false);
        List<Remorque> remorques = selectedActiveRemorques(contrat, ids.remorqueIds(), false);
        if (vehicules.isEmpty() && remorques.isEmpty()) {
            throw new BadRequestException("Selectionnez au moins un vehicule ou une remorque pour la precision");
        }
        return new AvenantGraph(contrat, typeMouvement, vehicules, remorques, List.of(), NatureSnapshotMouvement.COURANT);
    }

    private AvenantGraph resolveDuplicataAvenant(Contrat contrat, TypeMouvementContrat typeMouvement, AvenantRequest request) {
        List<Vehicule> vehicules = selectedActiveVehicules(contrat, request.getVehiculeIds(), true);
        List<Remorque> remorques = selectedActiveRemorques(contrat, request.getRemorqueIds(), true);
        return new AvenantGraph(contrat, typeMouvement, vehicules, remorques, List.of(), NatureSnapshotMouvement.COURANT);
    }

    private void applyAvenantCurrentState(AvenantGraph graph, AvenantRequest request) {
        String code = graph.typeMouvement().getCode() == null ? "" : graph.typeMouvement().getCode().trim().toUpperCase(Locale.ROOT);
        if ("RET_F".equals(code)) {
            desactiverTargets(graph.contrat(), graph.vehicules(), graph.remorques(), graph.garanties());
            return;
        }
        if ("RES_F".equals(code) || "RES_M".equals(code) || "ANN_M".equals(code)) {
            desactiverTargets(graph.contrat(), graph.vehicules(), graph.remorques(), graph.garanties());
            graph.contrat().setStatut(StatutContrat.CANCELLED);
            contratRepository.save(graph.contrat());
            return;
        }
        if ("PRI_F".equals(code) || "PRI_M".equals(code)) {
            appliquerPrecisionAvenant(graph.contrat(), request);
        }
    }

    private void validateAvenantDates(Contrat contrat, AvenantRequest request) {
        LocalDate dateEffet = request.getDateEffet();
        LocalDate dateEcheance = contrat.getDateEcheance();
        if (dateEcheance != null && dateEffet.isAfter(dateEcheance)) {
            throw new BadRequestException("La date d'effet de l'avenant doit etre inferieure ou egale a sa date d'echeance");
        }
        if (contrat.getDateEffet() != null && dateEffet.isBefore(contrat.getDateEffet())) {
            throw new BadRequestException("La date d'effet de l'avenant ne peut pas etre avant la date d'effet du contrat");
        }
        if (contrat.getDateEcheance() != null && dateEffet.isAfter(contrat.getDateEcheance())) {
            throw new BadRequestException("La date d'effet de l'avenant ne peut pas etre apres l'echeance du contrat");
        }
    }

    private boolean isModificationGarantiesAvenant(AvenantRequest request) {
        String code = request != null && hasText(request.getCodeTypeMouvement())
                ? request.getCodeTypeMouvement().trim().toUpperCase(Locale.ROOT)
                : "";
        return "MOG_F".equals(code) || "MOG_M".equals(code) || "EXG_M".equals(code);
    }

    private AvenantModificationGraph resolveModificationGarantiesAvenant(Long agenceId, Long contratId, AvenantRequest request, boolean persist) {
        if (request == null || request.getDateEffet() == null) {
            throw new BadRequestException("La date d'effet de l'avenant est obligatoire");
        }
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (Boolean.TRUE.equals(contrat.getBrouillon()) || Boolean.TRUE.equals(contrat.getProspection()) || contrat.getStatut() != StatutContrat.ACTIVE) {
            throw new BadRequestException("Le contrat doit etre actif pour creer un avenant");
        }
        validateAvenantDates(contrat, request);
        TypeMouvementContrat typeMouvement = mouvementContratService.resolveTypeMouvementPourContrat(request.getCodeTypeMouvement(), contrat.getTypeContrat());
        if (!isModificationGarantiesAvenant(request)) {
            throw new BadRequestException("Le type d'avenant doit modifier les garanties");
        }
        if (request.getGaranties() == null || request.getGaranties().isEmpty()) {
            throw new BadRequestException("Au moins une garantie est obligatoire pour la modification");
        }
        List<Vehicule> vehicules = activeVehicules(contrat);
        List<Remorque> remorques = activeRemorques(contrat);
        List<ContratGarantie> anciennesGaranties = activeGaranties(contrat);
        if (vehicules.isEmpty() && remorques.isEmpty()) {
            throw new BadRequestException("Aucune cible active disponible pour cet avenant");
        }
        CreateContratRequest createRequest = avenantCreateRequest(contrat, request);
        List<ContratGarantie> nouvellesGaranties = buildGarantiesPreview(createRequest, contrat, vehicules, remorques);
        if (nouvellesGaranties.isEmpty()) {
            throw new BadRequestException("Au moins une garantie est obligatoire pour la modification");
        }
        QuittanceCalculService.Resultat avant = calculerMontantsAvenant(contrat, typeMouvement, anciennesGaranties, vehicules, remorques);
        QuittanceCalculService.Resultat apres = calculerMontantsAvenant(contrat, typeMouvement, nouvellesGaranties, vehicules, remorques);
        QuittanceCalculService.Resultat differentiel = quittanceCalculService.difference(apres, avant);
        List<ContratGarantie> garantiesDifferentielles = garantiesDifferentielles(anciennesGaranties, nouvellesGaranties);
        if (persist) {
            for (ContratGarantie garantie : anciennesGaranties) {
                garantie.setActif(false);
            }
            contratGarantieRepository.saveAll(anciennesGaranties);
            nouvellesGaranties = replaceFinalGaranties(contrat, createRequest, vehicules, remorques);
        }
        return new AvenantModificationGraph(contrat, typeMouvement, vehicules, remorques, anciennesGaranties, nouvellesGaranties, differentiel, garantiesDifferentielles);
    }

    private List<ContratGarantie> garantiesDifferentielles(
            List<ContratGarantie> anciennesGaranties,
            List<ContratGarantie> nouvellesGaranties
    ) {
        List<ContratGarantie> result = new ArrayList<>();
        Set<ContratGarantie> anciennesConsommees = new LinkedHashSet<>();
        for (ContratGarantie nouvelle : nouvellesGaranties == null ? List.<ContratGarantie>of() : nouvellesGaranties) {
            ContratGarantie ancienne = findMatchingGarantie(anciennesGaranties, nouvelle, anciennesConsommees);
            if (ancienne != null) {
                anciennesConsommees.add(ancienne);
            }
            BigDecimal prime = zeroIfNull(nouvelle.getPrime()).subtract(zeroIfNull(ancienne == null ? null : ancienne.getPrime()));
            result.add(copierGarantieAvecPrime(nouvelle, scale(prime)));
        }
        for (ContratGarantie ancienne : anciennesGaranties == null ? List.<ContratGarantie>of() : anciennesGaranties) {
            if (!anciennesConsommees.contains(ancienne)) {
                result.add(copierGarantieAvecPrime(ancienne, scale(zeroIfNull(ancienne.getPrime()).negate())));
            }
        }
        return result;
    }

    private ContratGarantie findMatchingGarantie(
            List<ContratGarantie> garanties,
            ContratGarantie cible,
            Set<ContratGarantie> exclude
    ) {
        for (ContratGarantie garantie : garanties == null ? List.<ContratGarantie>of() : garanties) {
            if (exclude.contains(garantie)) {
                continue;
            }
            if (sameGarantieCible(garantie, cible)) {
                return garantie;
            }
        }
        return null;
    }

    private boolean sameGarantieCible(ContratGarantie left, ContratGarantie right) {
        Long leftGarantieId = left.getGarantie() == null ? null : left.getGarantie().getId();
        Long rightGarantieId = right.getGarantie() == null ? null : right.getGarantie().getId();
        Long leftVehiculeId = left.getVehicule() == null ? null : left.getVehicule().getId();
        Long rightVehiculeId = right.getVehicule() == null ? null : right.getVehicule().getId();
        Long leftRemorqueId = left.getRemorque() == null ? null : left.getRemorque().getId();
        Long rightRemorqueId = right.getRemorque() == null ? null : right.getRemorque().getId();
        Long leftClientId = left.getClient() == null ? null : left.getClient().getId();
        Long rightClientId = right.getClient() == null ? null : right.getClient().getId();
        return java.util.Objects.equals(leftGarantieId, rightGarantieId)
                && java.util.Objects.equals(leftVehiculeId, rightVehiculeId)
                && java.util.Objects.equals(leftRemorqueId, rightRemorqueId)
                && java.util.Objects.equals(leftClientId, rightClientId);
    }

    private ContratGarantie copierGarantieAvecPrime(ContratGarantie source, BigDecimal prime) {
        return ContratGarantie.builder()
                .contrat(source.getContrat())
                .garantie(source.getGarantie())
                .vehicule(source.getVehicule())
                .remorque(source.getRemorque())
                .client(source.getClient())
                .ligneGrilleTarifaire(source.getLigneGrilleTarifaire())
                .modeSelectionne(source.getModeSelectionne())
                .sourceValeurSelectionnee(source.getSourceValeurSelectionnee())
                .formuleGarantiePersonne(source.getFormuleGarantiePersonne())
                .actif(source.getActif())
                .valeurVenale(source.getValeurVenale())
                .valeurNeuf(source.getValeurNeuf())
                .valeurGlace(source.getValeurGlace())
                .formule(source.getFormule())
                .montantDeces(source.getMontantDeces())
                .montantInvalidite(source.getMontantInvalidite())
                .montantFraisMedicaux(source.getMontantFraisMedicaux())
                .montantFraisHospitalisation(source.getMontantFraisHospitalisation())
                .montantFraisFuneraires(source.getMontantFraisFuneraires())
                .montantFraisChirurgie(source.getMontantFraisChirurgie())
                .accessoire(source.getAccessoire())
                .capital(source.getCapital())
                .taux(source.getTaux())
                .prime(prime)
                .tauxFranchise(source.getTauxFranchise())
                .franchiseMinimale(source.getFranchiseMinimale())
                .build();
    }

    private QuittanceCalculService.Resultat calculerMontantsAvenant(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        int fallbackCnpac = Math.max(1, (vehicules == null ? 0 : vehicules.size()) + (remorques == null ? 0 : remorques.size()));
        int unitesCnpac = quittanceCalculService.compterUnitesCnpac(garanties, fallbackCnpac);
        return quittanceCalculService.calculer(contrat, typeMouvement, garanties, unitesCnpac);
    }

    private QuittanceCalculService.Resultat calculerRetourPrime(AvenantGraph graph, AvenantRequest request) {
        String code = graph.typeMouvement().getCode() == null ? "" : graph.typeMouvement().getCode().trim().toUpperCase(Locale.ROOT);
        if (!"RET_F".equals(code) && !"RES_F".equals(code) && !"RES_M".equals(code) && !"ANN_M".equals(code)) {
            return null;
        }
        List<ContratGarantie> garantiesRetour = graph.garanties().stream()
                .map(garantie -> garantieRetourPrime(graph.contrat(), request, garantie))
                .toList();
        return calculerMontantsAvenant(graph.contrat(), graph.typeMouvement(), garantiesRetour, graph.vehicules(), graph.remorques());
    }

    private ContratGarantie garantieRetourPrime(Contrat contrat, AvenantRequest request, ContratGarantie source) {
        BigDecimal primeRetour = primeRetourPrime(contrat, request, source);
        return ContratGarantie.builder()
                .contrat(source.getContrat())
                .garantie(source.getGarantie())
                .vehicule(source.getVehicule())
                .remorque(source.getRemorque())
                .client(source.getClient())
                .ligneGrilleTarifaire(source.getLigneGrilleTarifaire())
                .modeSelectionne(source.getModeSelectionne())
                .sourceValeurSelectionnee(source.getSourceValeurSelectionnee())
                .formuleGarantiePersonne(source.getFormuleGarantiePersonne())
                .actif(source.getActif())
                .valeurVenale(source.getValeurVenale())
                .valeurNeuf(source.getValeurNeuf())
                .valeurGlace(source.getValeurGlace())
                .formule(source.getFormule())
                .montantDeces(source.getMontantDeces())
                .montantInvalidite(source.getMontantInvalidite())
                .montantFraisMedicaux(source.getMontantFraisMedicaux())
                .montantFraisHospitalisation(source.getMontantFraisHospitalisation())
                .montantFraisFuneraires(source.getMontantFraisFuneraires())
                .montantFraisChirurgie(source.getMontantFraisChirurgie())
                .accessoire(source.getAccessoire())
                .capital(source.getCapital())
                .taux(source.getTaux())
                .prime(primeRetour)
                .tauxFranchise(source.getTauxFranchise())
                .franchiseMinimale(source.getFranchiseMinimale())
                .build();
    }

    private BigDecimal primeRetourPrime(Contrat contrat, AvenantRequest request, ContratGarantie garantie) {
        BigDecimal primeContrat = zeroIfNull(garantie.getPrime());
        BigDecimal prorataOrigine = resolveProrataOrigine(contrat, garantie);
        BigDecimal primeAnnuelle = prorataOrigine.compareTo(BigDecimal.ZERO) > 0
                ? primeContrat.divide(prorataOrigine, 8, RoundingMode.HALF_UP)
                : primeContrat;
        BigDecimal prorataRestant = resolveProrataRestant(contrat, request, garantie);
        return scale(primeAnnuelle.multiply(prorataRestant));
    }

    private BigDecimal resolveProrataOrigine(Contrat contrat, ContratGarantie garantie) {
        BigDecimal coefficient = garantie.getVehicule() != null ? garantie.getVehicule().getCoefficientProrata()
                : garantie.getRemorque() != null ? garantie.getRemorque().getCoefficientProrata() : null;
        if (coefficient != null && coefficient.compareTo(BigDecimal.ZERO) > 0) {
            return coefficient;
        }
        LocalDate dateEffet = garantie.getVehicule() != null ? garantie.getVehicule().getDateEffet()
                : garantie.getRemorque() != null ? garantie.getRemorque().getDateEffet()
                : contrat.getDateEffet();
        LocalDate dateEcheance = garantie.getVehicule() != null ? garantie.getVehicule().getDateEcheance()
                : garantie.getRemorque() != null ? garantie.getRemorque().getDateEcheance()
                : contrat.getDateEcheance();
        return calculGarantieService.calculerProrata(dateEffet, dateEcheance);
    }

    private BigDecimal resolveProrataRestant(Contrat contrat, AvenantRequest request, ContratGarantie garantie) {
        LocalDate dateDebutCible = garantie.getVehicule() != null ? garantie.getVehicule().getDateEffet()
                : garantie.getRemorque() != null ? garantie.getRemorque().getDateEffet()
                : contrat.getDateEffet();
        LocalDate dateEffetAvenant = firstNonNull(request.getDateEffet(), dateDebutCible, contrat.getDateEffet());
        LocalDate dateDebutRetour = dateDebutCible != null && dateDebutCible.isAfter(dateEffetAvenant) ? dateDebutCible : dateEffetAvenant;
        LocalDate dateEcheance = contrat.getDateEcheance();
        if (dateEcheance == null || dateDebutRetour == null || dateDebutRetour.isAfter(dateEcheance)) {
            return BigDecimal.ZERO;
        }
        return calculGarantieService.calculerProrata(dateDebutRetour, dateEcheance);
    }

    private MouvementContratRequest toMouvementRequest(AvenantRequest request, Contrat contrat) {
        MouvementContratRequest mouvementRequest = new MouvementContratRequest();
        mouvementRequest.setCodeTypeMouvement(request.getCodeTypeMouvement());
        mouvementRequest.setNumeroMouvement(request.getNumeroMouvement());
        mouvementRequest.setDateEffet(request.getDateEffet());
        mouvementRequest.setDateEcheance(contrat.getDateEcheance());
        mouvementRequest.setNotes(request.getNotes());
        return mouvementRequest;
    }

    private AvenantTargets buildAvenantTargetsPreview(Contrat contrat, AvenantRequest request) {
        CreateContratRequest previewRequest = avenantCreateRequest(contrat, request);
        List<Vehicule> vehicules = buildVehiculesPreview(previewRequest, contrat, contrat.getUsage());
        List<Remorque> remorques = buildRemorquesPreview(previewRequest, contrat, contrat.getUsage());
        List<ContratGarantie> garanties = buildGarantiesPreview(previewRequest, contrat, vehicules, remorques);
        return new AvenantTargets(vehicules, remorques, garanties);
    }

    private AvenantTargets persistAvenantTargets(Contrat contrat, AvenantRequest request) {
        List<Vehicule> vehicules = new ArrayList<>();
        for (CreateContratRequest.VehiculeInput input : request.getVehicules() == null ? List.<CreateContratRequest.VehiculeInput>of() : request.getVehicules()) {
            validateDraftVehiculeInput(contrat, input);
            Vehicule vehicule = new Vehicule();
            vehicule.setContrat(contrat);
            applyVehiculeInput(contrat, vehicule, input);
            vehicule.setDateEffet(firstNonNull(input.getDateEffet(), request.getDateEffet()));
            vehicule.setDateEcheance(contrat.getDateEcheance());
            vehicule.setActif(true);
            vehicule = vehiculeRepository.save(vehicule);
            vehicules.add(vehicule);
            contrat.getVehicules().add(vehicule);
        }

        List<Remorque> remorques = new ArrayList<>();
        for (CreateContratRequest.RemorqueInput input : request.getRemorques() == null ? List.<CreateContratRequest.RemorqueInput>of() : request.getRemorques()) {
            validateDraftRemorqueInput(input);
            Remorque remorque = new Remorque();
            remorque.setContrat(contrat);
            applyRemorqueInput(contrat, remorque, input);
            remorque.setDateEffet(firstNonNull(input.getDateEffet(), request.getDateEffet()));
            remorque.setDateEcheance(contrat.getDateEcheance());
            remorque.setActif(true);
            remorque = remorqueRepository.save(remorque);
            remorques.add(remorque);
            contrat.getRemorques().add(remorque);
        }

        CreateContratRequest createRequest = avenantCreateRequest(contrat, request);
        List<ContratGarantie> garanties = replaceFinalGaranties(contrat, createRequest, vehicules, remorques);
        updateTargetCounts(contrat);
        return new AvenantTargets(vehicules, remorques, garanties);
    }

    private CreateContratRequest avenantCreateRequest(Contrat contrat, AvenantRequest request) {
        CreateContratRequest createRequest = new CreateContratRequest();
        createRequest.setAgenceId(contrat.getAgence().getId());
        createRequest.setTypeContrat(contrat.getTypeContrat());
        createRequest.setCompagnieAssuranceId(contrat.getCompagnieAssurance() != null ? contrat.getCompagnieAssurance().getId() : null);
        createRequest.setGrilleTarifaireId(contrat.getGrilleTarifaire() != null ? contrat.getGrilleTarifaire().getId() : null);
        createRequest.setUsageId(contrat.getUsage() != null ? contrat.getUsage().getId() : null);
        createRequest.setDateEffet(request.getDateEffet());
        createRequest.setDateEcheance(contrat.getDateEcheance());
        createRequest.setModeSaisieGaranties(contrat.getModeSaisieGaranties());
        createRequest.setSaisiePrimeNette(contrat.getSaisiePrimeNette());
        createRequest.setTauxRc(contrat.getTauxRc());
        createRequest.setCrmPartage(contrat.getCrmPartage());
        createRequest.setCrmPartageValeur(contrat.getCrmPartageValeur());
        normalizeAvenantTargetEcheances(contrat, request);
        createRequest.setVehicules(request.getVehicules());
        createRequest.setRemorques(request.getRemorques());
        createRequest.setGaranties(request.getGaranties());
        return createRequest;
    }

    private void normalizeAvenantTargetEcheances(Contrat contrat, AvenantRequest request) {
        LocalDate dateEcheance = contrat.getDateEcheance();
        for (CreateContratRequest.VehiculeInput vehicule : request.getVehicules() == null ? List.<CreateContratRequest.VehiculeInput>of() : request.getVehicules()) {
            vehicule.setDateEcheance(dateEcheance);
        }
        for (CreateContratRequest.RemorqueInput remorque : request.getRemorques() == null ? List.<CreateContratRequest.RemorqueInput>of() : request.getRemorques()) {
            remorque.setDateEcheance(dateEcheance);
        }
    }

    private List<Vehicule> selectedActiveVehicules(Contrat contrat, List<Long> ids, boolean defaultAllWhenEmpty) {
        if ((ids == null || ids.isEmpty()) && defaultAllWhenEmpty) {
            return activeVehicules(contrat);
        }
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        Set<Long> expected = new LinkedHashSet<>(ids);
        List<Vehicule> selected = vehiculeRepository.findByContratIdAndIdIn(contrat.getId(), ids).stream()
                .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                .toList();
        Set<Long> found = selected.stream().map(Vehicule::getId).collect(java.util.stream.Collectors.toSet());
        if (!found.containsAll(expected)) {
            throw new BadRequestException("Un ou plusieurs vehicules selectionnes sont invalides ou deja retires");
        }
        return selected;
    }

    private List<Remorque> selectedActiveRemorques(Contrat contrat, List<Long> ids, boolean defaultAllWhenEmpty) {
        if ((ids == null || ids.isEmpty()) && defaultAllWhenEmpty) {
            return activeRemorques(contrat);
        }
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        Set<Long> expected = new LinkedHashSet<>(ids);
        List<Remorque> selected = remorqueRepository.findByContratIdAndIdIn(contrat.getId(), ids).stream()
                .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                .toList();
        Set<Long> found = selected.stream().map(Remorque::getId).collect(java.util.stream.Collectors.toSet());
        if (!found.containsAll(expected)) {
            throw new BadRequestException("Une ou plusieurs remorques selectionnees sont invalides ou deja retirees");
        }
        return selected;
    }

    private List<ContratGarantie> activeGarantiesForTargets(Contrat contrat, List<Vehicule> vehicules, List<Remorque> remorques) {
        Set<Long> vehiculeIds = vehicules.stream().map(Vehicule::getId).collect(java.util.stream.Collectors.toSet());
        Set<Long> remorqueIds = remorques.stream().map(Remorque::getId).collect(java.util.stream.Collectors.toSet());
        return activeGaranties(contrat).stream()
                .filter(garantie -> (garantie.getVehicule() != null && vehiculeIds.contains(garantie.getVehicule().getId()))
                        || (garantie.getRemorque() != null && remorqueIds.contains(garantie.getRemorque().getId())))
                .toList();
    }

    private void desactiverTargets(Contrat contrat, List<Vehicule> vehicules, List<Remorque> remorques, List<ContratGarantie> garanties) {
        for (ContratGarantie garantie : garanties) {
            garantie.setActif(false);
        }
        contratGarantieRepository.saveAll(garanties);
        for (Vehicule vehicule : vehicules) {
            vehicule.setActif(false);
        }
        vehiculeRepository.saveAll(vehicules);
        for (Remorque remorque : remorques) {
            remorque.setActif(false);
        }
        remorqueRepository.saveAll(remorques);
        updateTargetCounts(contrat);
    }

    private void appliquerPrecisionAvenant(Contrat contrat, AvenantRequest request) {
        if (request.getPrecisions() == null || request.getPrecisions().isEmpty()) {
            return;
        }
        for (AvenantRequest.TargetPrecision precision : request.getPrecisions()) {
            if (precision.getVehiculeId() != null) {
                Vehicule vehicule = selectedActiveVehicules(contrat, List.of(precision.getVehiculeId()), false).get(0);
                if (hasText(precision.getImmatriculation())) {
                    vehicule.setImmatriculation(precision.getImmatriculation());
                }
                if (hasText(precision.getImmatriculationProvisoire())) {
                    vehicule.setImmatriculationProvisoire(precision.getImmatriculationProvisoire());
                }
                if (hasText(precision.getNumeroAttestation())) {
                    vehicule.setNumeroAttestation(precision.getNumeroAttestation());
                }
                vehiculeRepository.save(vehicule);
            }
            if (precision.getRemorqueId() != null) {
                Remorque remorque = selectedActiveRemorques(contrat, List.of(precision.getRemorqueId()), false).get(0);
                if (hasText(precision.getImmatriculation())) {
                    remorque.setImmatriculation(precision.getImmatriculation());
                }
                if (hasText(precision.getNumeroAttestation())) {
                    remorque.setNumeroAttestation(precision.getNumeroAttestation());
                }
                remorqueRepository.save(remorque);
            }
        }
    }

    private SelectionIds precisionSelectionIds(AvenantRequest request) {
        Set<Long> vehiculeIds = new LinkedHashSet<>(request.getVehiculeIds() == null ? List.of() : request.getVehiculeIds());
        Set<Long> remorqueIds = new LinkedHashSet<>(request.getRemorqueIds() == null ? List.of() : request.getRemorqueIds());
        for (AvenantRequest.TargetPrecision precision : request.getPrecisions() == null ? List.<AvenantRequest.TargetPrecision>of() : request.getPrecisions()) {
            if (precision.getVehiculeId() != null) {
                vehiculeIds.add(precision.getVehiculeId());
            }
            if (precision.getRemorqueId() != null) {
                remorqueIds.add(precision.getRemorqueId());
            }
        }
        return new SelectionIds(new ArrayList<>(vehiculeIds), new ArrayList<>(remorqueIds));
    }

    private List<Vehicule> activeVehicules(Contrat contrat) {
        return vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(contrat.getId());
    }

    private void validateRenewalSource(Contrat source, ModeTermeRenouvellement modeTerme) {
        if (source.getStatut() != StatutContrat.ACTIVE
                || Boolean.TRUE.equals(source.getBrouillon())
                || Boolean.TRUE.equals(source.getProspection())) {
            throw new BadRequestException("Seul un contrat actif peut être renouvelé");
        }
        if (Boolean.TRUE.equals(source.getRenouvele())) {
            throw new BadRequestException("Le contrat est déjà renouvelé");
        }
        if (!"renouvelable".equalsIgnoreCase(blankToNull(source.getTypeRenouvellement()))) {
            throw new BadRequestException("Ce contrat n'est pas renouvelable");
        }
        if (source.getDateEcheance() == null) {
            throw new BadRequestException("La date d'échéance du contrat est obligatoire");
        }
        ModeTermeRenouvellement resolvedMode = modeTerme == null
                ? ModeTermeRenouvellement.CABINET
                : modeTerme;
        if (resolvedMode == ModeTermeRenouvellement.COMPAGNIE && !isRenewalCompanyTermEligible(source)) {
            throw new BadRequestException("Le terme compagnie est réservé aux échéances trimestrielles de fin de mois");
        }
    }

    private void enforceRenewalPeriod(Contrat contrat, CreateContratRequest request) {
        if (contrat.getContratOrigine() == null) {
            return;
        }
        request.setDateEffet(contrat.getDateEffet());
        request.setDateEcheance(contrat.getDateEcheance());
        request.setEcheance(contrat.getEcheance());
        for (CreateContratRequest.VehiculeInput input : request.getVehicules() == null
                ? List.<CreateContratRequest.VehiculeInput>of()
                : request.getVehicules()) {
            enforceRenewalPeriod(contrat, input);
        }
        for (CreateContratRequest.RemorqueInput input : request.getRemorques() == null
                ? List.<CreateContratRequest.RemorqueInput>of()
                : request.getRemorques()) {
            enforceRenewalPeriod(contrat, input);
        }
    }

    private void enforceRenewalPeriod(Contrat contrat, CreateContratRequest.VehiculeInput input) {
        if (contrat.getContratOrigine() != null && input != null) {
            input.setDateEffet(contrat.getDateEffet());
            input.setDateEcheance(contrat.getDateEcheance());
        }
    }

    private void enforceRenewalPeriod(Contrat contrat, CreateContratRequest.RemorqueInput input) {
        if (contrat.getContratOrigine() != null && input != null) {
            input.setDateEffet(contrat.getDateEffet());
            input.setDateEcheance(contrat.getDateEcheance());
        }
    }

    private boolean isRenewalCompanyTermEligible(Contrat contrat) {
        if (!"renouvelable".equalsIgnoreCase(blankToNull(contrat.getTypeRenouvellement()))
                || contrat.getDateEcheance() == null) {
            return false;
        }
        LocalDate echeance = contrat.getDateEcheance();
        int month = echeance.getMonthValue();
        return (month == 3 || month == 6 || month == 9 || month == 12)
                && echeance.getDayOfMonth() == echeance.lengthOfMonth();
    }

    private CreateContratRequest buildRenewalDraftRequest(
            Contrat source,
            ModeTermeRenouvellement modeTerme
    ) {
        LocalDate dateEffet = source.getDateEcheance().plusDays(1);
        LocalDate dateEcheance = source.getDateEcheance().plusYears(1);
        List<Vehicule> vehicules = activeVehicules(source);
        List<Remorque> remorques = activeRemorques(source);
        Map<Long, Integer> vehiculeIndexes = new HashMap<>();
        Map<Long, Integer> remorqueIndexes = new HashMap<>();
        for (int index = 0; index < vehicules.size(); index++) {
            vehiculeIndexes.put(vehicules.get(index).getId(), index);
        }
        for (int index = 0; index < remorques.size(); index++) {
            remorqueIndexes.put(remorques.get(index).getId(), index);
        }

        CreateContratRequest request = new CreateContratRequest();
        request.setAgenceId(source.getAgence().getId());
        request.setCompagnieAssuranceId(source.getCompagnieAssurance() == null ? null : source.getCompagnieAssurance().getId());
        request.setConventionId(source.getConvention() == null ? null : source.getConvention().getId());
        request.setUsageId(source.getUsage() == null ? null : source.getUsage().getId());
        request.setGrilleTarifaireId(source.getGrilleTarifaire() == null ? null : source.getGrilleTarifaire().getId());
        request.setTypeContrat(source.getTypeContrat());
        request.setNumeroPolice(source.getNumeroPolice());
        request.setDateEffet(dateEffet);
        request.setDateEcheance(dateEcheance);
        request.setEcheance(source.getEcheance());
        request.setTypeRenouvellement(source.getTypeRenouvellement());
        request.setModeTermeRenouvellement(modeTerme);
        request.setModePaiement(source.getModePaiement());
        request.setModeReglement(source.getModeReglement());
        request.setNumeroBonCommande(source.getNumeroBonCommande());
        request.setMontantBulletin(source.getMontantBulletin());
        request.setTypePayeurPrime(source.getTypePayeurPrime());
        request.setPayeurPrimeClientId(source.getPayeurPrime() == null ? null : source.getPayeurPrime().getId());
        request.setGroupeFacturationId(source.getGroupeFacturation() == null ? null : source.getGroupeFacturation().getId());
        request.setModeFacturation(source.getModeFacturation());
        request.setReferenceMandatPayeur(source.getReferenceMandatPayeur());
        request.setPeriodicite(source.getPeriodicite());
        request.setFractionnement(source.getFractionnement());
        request.setTauxRc(source.getTauxRc());
        request.setModeSaisieGaranties(source.getModeSaisieGaranties());
        request.setSaisiePrimeNette(source.getSaisiePrimeNette());
        request.setNombreVehicules(vehicules.size());
        request.setNombreRemorques(remorques.size());
        request.setProspection(false);
        request.setAssistance(source.getAssistance());
        request.setCrmPartage(source.getCrmPartage());
        request.setCrmPartageValeur(source.getCrmPartageValeur());
        request.setNotes(source.getNotes());

        request.setClients(source.getClients().stream().map(link -> {
            CreateContratRequest.ClientInput input = new CreateContratRequest.ClientInput();
            input.setClientId(link.getClient().getId());
            input.setRole(link.getRole());
            input.setPrincipalPourRole(Boolean.TRUE.equals(link.getPrincipalPourRole()));
            return input;
        }).toList());
        request.setVehicules(vehicules.stream()
                .map(vehicule -> toRenewalVehiculeInput(vehicule, dateEffet, dateEcheance))
                .toList());
        request.setRemorques(remorques.stream()
                .map(remorque -> toRenewalRemorqueInput(remorque, dateEffet, dateEcheance))
                .toList());
        request.setGaranties(activeGaranties(source).stream()
                .filter(garantie -> garantie.getVehicule() == null
                        || vehiculeIndexes.containsKey(garantie.getVehicule().getId()))
                .filter(garantie -> garantie.getRemorque() == null
                        || remorqueIndexes.containsKey(garantie.getRemorque().getId()))
                .map(garantie -> toRenewalGarantieInput(garantie, vehiculeIndexes, remorqueIndexes))
                .toList());

        if (source.getTypeContrat() == TypeContrat.PARTICULIER) {
            QuittanceResponse sourceQuittance = buildQuittanceGenerale(source, true);
            if (sourceQuittance != null && sourceQuittance.getLignes() != null) {
                request.setQuittances(sourceQuittance.getLignes().stream()
                        .map(this::toRenewalQuittanceInput)
                        .toList());
            }
        }
        return request;
    }

    private CreateContratRequest.VehiculeInput toRenewalVehiculeInput(
            Vehicule source,
            LocalDate dateEffet,
            LocalDate dateEcheance
    ) {
        CreateContratRequest.VehiculeInput input = new CreateContratRequest.VehiculeInput();
        input.setTypeVehicule(source.getTypeVehicule());
        input.setUsageId(source.getUsage() == null ? null : source.getUsage().getId());
        input.setMarqueId(source.getMarque() == null ? null : source.getMarque().getId());
        input.setCarrosserieId(source.getCarrosserie() == null ? null : source.getCarrosserie().getId());
        input.setCategorieTransportId(source.getCategorieTransport() == null ? null : source.getCategorieTransport().getId());
        input.setImmatriculation(source.getImmatriculation());
        input.setImmatriculationProvisoire(source.getImmatriculationProvisoire());
        input.setCarburant(source.getCarburant());
        input.setPuissanceFiscale(source.getPuissanceFiscale());
        input.setNombrePlaces(source.getNombrePlaces());
        input.setSousClasse(source.getSousClasse());
        input.setPtc(source.getPtc());
        input.setDatePremiereCirculation(source.getDatePremiereCirculation());
        input.setDateExpirationCarteGrise(source.getDateExpirationCarteGrise());
        input.setDateEffet(dateEffet);
        input.setDateEcheance(dateEcheance);
        input.setCrm(source.getCrm());
        input.setCoefficientProrata(source.getCoefficientProrata());
        input.setRemorque(source.getRemorque());
        input.setValeurVenale(source.getValeurVenale());
        input.setValeurNeuf(source.getValeurNeuf());
        input.setValeurGlace(source.getValeurGlace());
        input.setOrganismeCredit(source.getOrganismeCredit());
        input.setNomOrganismeCredit(source.getNomOrganismeCredit());
        input.setMontantCredit(source.getMontantCredit());
        input.setDateFinCredit(source.getDateFinCredit());
        return input;
    }

    private CreateContratRequest.RemorqueInput toRenewalRemorqueInput(
            Remorque source,
            LocalDate dateEffet,
            LocalDate dateEcheance
    ) {
        CreateContratRequest.RemorqueInput input = new CreateContratRequest.RemorqueInput();
        input.setUsageId(source.getUsage() == null ? null : source.getUsage().getId());
        input.setMarqueId(source.getMarque() == null ? null : source.getMarque().getId());
        input.setImmatriculation(source.getImmatriculation());
        input.setPtc(source.getPtc());
        input.setDateMiseEnCirculation(source.getDateMiseEnCirculation());
        input.setDateEffet(dateEffet);
        input.setDateEcheance(dateEcheance);
        input.setCrm(source.getCrm());
        input.setCoefficientProrata(source.getCoefficientProrata());
        input.setValeurAssuree(source.getValeurAssuree());
        return input;
    }

    private CreateContratRequest.GarantieInput toRenewalGarantieInput(
            ContratGarantie source,
            Map<Long, Integer> vehiculeIndexes,
            Map<Long, Integer> remorqueIndexes
    ) {
        CreateContratRequest.GarantieInput input = new CreateContratRequest.GarantieInput();
        input.setGarantieId(source.getGarantie().getId());
        input.setLigneGrilleTarifaireId(source.getLigneGrilleTarifaire() == null ? null : source.getLigneGrilleTarifaire().getId());
        input.setClientId(source.getClient() == null ? null : source.getClient().getId());
        input.setVehiculeIndex(source.getVehicule() == null ? null : vehiculeIndexes.get(source.getVehicule().getId()));
        input.setRemorqueIndex(source.getRemorque() == null ? null : remorqueIndexes.get(source.getRemorque().getId()));
        input.setModeSelectionne(source.getModeSelectionne() == null ? null : source.getModeSelectionne().name());
        input.setSourceValeurSelectionnee(source.getSourceValeurSelectionnee() == null ? null : source.getSourceValeurSelectionnee().name());
        input.setFormuleGarantiePersonneId(source.getFormuleGarantiePersonne() == null ? null : source.getFormuleGarantiePersonne().getId());
        input.setValeurVenale(source.getValeurVenale());
        input.setValeurNeuf(source.getValeurNeuf());
        input.setValeurGlace(source.getValeurGlace());
        input.setValeurAssuree(source.getCapital());
        input.setFormule(source.getFormule());
        input.setMontantDeces(source.getMontantDeces());
        input.setMontantInvalidite(source.getMontantInvalidite());
        input.setMontantFraisMedicaux(source.getMontantFraisMedicaux());
        input.setMontantFraisHospitalisation(source.getMontantFraisHospitalisation());
        input.setMontantFraisFuneraires(source.getMontantFraisFuneraires());
        input.setMontantFraisChirurgie(source.getMontantFraisChirurgie());
        input.setAccessoire(source.getAccessoire());
        input.setCapital(source.getCapital());
        input.setTaux(source.getTaux());
        input.setPrime(source.getPrime());
        input.setTauxFranchise(source.getTauxFranchise());
        input.setFranchiseMinimale(source.getFranchiseMinimale());
        return input;
    }

    private CreateContratRequest.QuittanceInput toRenewalQuittanceInput(QuittanceResponse.Ligne source) {
        CreateContratRequest.QuittanceInput input = new CreateContratRequest.QuittanceInput();
        try {
            input.setCategorie(CategorieQuittance.valueOf(source.getCategorie()));
        } catch (IllegalArgumentException | NullPointerException ignored) {
            input.setCategorie(CategorieQuittance.TOTAL);
        }
        input.setOrdre(source.getOrdre());
        input.setGlobale(source.getGlobale());
        input.setPrimeNette(source.getPrimeNette());
        input.setTaxe(source.getTaxe());
        input.setTaxeParafiscale(source.getTaxeParafiscale());
        input.setAccessoire(source.getAccessoire());
        input.setCnpac(source.getCnpac());
        input.setPrimeTotale(source.getPrimeTotale());
        return input;
    }

    private List<Remorque> activeRemorques(Contrat contrat) {
        return remorqueRepository.findActiveByContratIdOrderByCreatedAtAsc(contrat.getId());
    }

    private List<ContratGarantie> activeGaranties(Contrat contrat) {
        return contratGarantieRepository.findActiveByContratId(contrat.getId());
    }

    private void updateTargetCounts(Contrat contrat) {
        contrat.setNombreVehicules(activeVehicules(contrat).size());
        contrat.setNombreRemorques(activeRemorques(contrat).size());
        contratRepository.save(contrat);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse previsualiserQuittance(CreateContratRequest request) {
        Agence agence = agenceRepository.findById(request.getAgenceId())
                .orElseThrow(() -> new ResourceNotFoundException("Agence", request.getAgenceId()));
        CompagnieAssurance compagnie = request.getCompagnieAssuranceId() == null ? null :
                compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                        .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        Convention convention = request.getConventionId() == null ? null :
                conventionRepository.findByAgenceIdAndId(request.getAgenceId(), request.getConventionId())
                        .orElseThrow(() -> new ResourceNotFoundException("Convention", request.getConventionId()));
        Usage usageContrat = request.getUsageId() == null ? null :
                usageRepository.findById(request.getUsageId())
                        .orElseThrow(() -> new ResourceNotFoundException("Usage", request.getUsageId()));
        GrilleTarifaire grilleTarifaire = request.getGrilleTarifaireId() == null ? null :
                grilleTarifaireRepository.findById(request.getGrilleTarifaireId())
                        .orElseThrow(() -> new ResourceNotFoundException("GrilleTarifaire", request.getGrilleTarifaireId()));
        ModeSaisieGarantieContrat modeSaisieGaranties = resolveModeSaisieGaranties(request);
        boolean saisiePrimeNette = Boolean.TRUE.equals(request.getSaisiePrimeNette())
                || modeSaisieGaranties == ModeSaisieGarantieContrat.MANUELLE_AVEC_PRIME_NETTE;
        validateModeSaisiePourTypeContrat(request, modeSaisieGaranties, convention);
        if (modeSaisieGaranties == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE && grilleTarifaire == null) {
            throw new BadRequestException("Une grille tarifaire est obligatoire pour un contrat convention ou flotte");
        }
        ContractDates contractDates = resolveContractDates(request);

        Contrat contrat = Contrat.builder()
                .agence(agence)
                .compagnieAssurance(compagnie)
                .convention(convention)
                .usage(usageContrat)
                .grilleTarifaire(grilleTarifaire)
                .typeContrat(request.getTypeContrat())
                .numeroContrat(request.getNumeroContrat())
                .numeroDevis(request.getNumeroDevis())
                .numeroPolice(request.getNumeroPolice())
                .numeroAttestation(request.getNumeroAttestation())
                .dateEffet(contractDates.dateEffet())
                .dateEcheance(contractDates.dateEcheance())
                .echeance(contractDates.echeance())
                .typeRenouvellement(blankToNull(request.getTypeRenouvellement()))
                .modePaiement(request.getModePaiement())
                .modeReglement(request.getModeReglement())
                .numeroBonCommande(request.getNumeroBonCommande())
                .montantBulletin(request.getMontantBulletin())
                .periodicite(request.getPeriodicite())
                .fractionnement(request.getFractionnement())
                .tauxRc(request.getTauxRc())
                .modeSaisieGaranties(modeSaisieGaranties)
                .saisiePrimeNette(saisiePrimeNette)
                .nombreVehicules(request.getNombreVehicules())
                .nombreRemorques(request.getNombreRemorques())
                .prospection(request.getProspection() == null ? false : request.getProspection())
                .assistance(request.getAssistance() == null ? false : request.getAssistance())
                .crmPartage(request.getCrmPartage() == null ? false : request.getCrmPartage())
                .crmPartageValeur(request.getCrmPartageValeur())
                .notes(request.getNotes())
                .build();

        buildPreviewClientLinks(contrat, request.getClients(), request.getAgenceId());

        List<Vehicule> vehicules = buildVehiculesPreview(request, contrat, usageContrat);
        contrat.getVehicules().addAll(vehicules);
        List<Remorque> remorques = buildRemorquesPreview(request, contrat, usageContrat);
        contrat.getRemorques().addAll(remorques);
        List<ContratGarantie> garanties = buildGarantiesPreview(request, contrat, vehicules, remorques);
        contrat.getGaranties().addAll(garanties);

        int unitesCnpac = countCnpacUnits(garanties, vehicules, remorques);
        QuittanceCalculService.Resultat calcul = buildManualQuittanceResult(request);
        boolean quittanceManuelle = calcul != null;
        if (!quittanceManuelle) {
            calcul = quittanceCalculService.calculer(contrat, null, garanties, unitesCnpac);
        }
        return QuittanceResponse.builder()
                .numeroContrat(contrat.getNumeroContrat())
                .type("AN")
                .categorie("TOTAL")
                .globale(true)
                .dateDebut(contrat.getDateEffet())
                .dateFin(contrat.getDateEcheance())
                .primeNette(calcul.primeNette())
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(calcul.cnpac())
                .primeTotale(calcul.primeTotale())
                .lignes(calcul.lignes().stream().map(this::toQuittanceLigneResponse).toList())
                .garanties(garanties.stream().map(garantie -> toQuittanceGarantieResponse(garantie, vehicules, remorques)).toList())
                .targetSummaries(quittanceManuelle ? List.of() : elementFacturableCibleService.calculer(contrat, garanties, vehicules, remorques))
                .build();
    }

    private Client resolveClientForCreation(Long agenceId, CreateContratRequest.ClientInput input) {
        if (input.getClientId() != null) {
            return clientRepository.findByAgenceIdAndId(agenceId, input.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
        }
        if (input.getClient() == null) {
            throw new BadRequestException("Le role " + input.getRole() + " doit renseigner clientId ou client");
        }
        if (input.getClient().getAgenceId() == null) {
            input.getClient().setAgenceId(agenceId);
        }
        if (!agenceId.equals(input.getClient().getAgenceId())) {
            throw new BadRequestException("Le client inline doit appartenir a l'agence du contrat");
        }
        return clientService.createEntity(input.getClient());
    }

    private Client resolveClientForPreview(Long agenceId, CreateContratRequest.ClientInput input) {
        if (input.getClientId() != null) {
            return clientRepository.findByAgenceIdAndId(agenceId, input.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
        }
        if (input.getClient() == null) {
            throw new BadRequestException("Le role " + input.getRole() + " doit renseigner clientId ou client");
        }
        return Client.builder()
                .typeClient(input.getClient().getTypeClient())
                .prenom(input.getClient().getPrenom())
                .nom(input.getClient().getNom())
                .raisonSociale(input.getClient().getRaisonSociale())
                .sahara(input.getClient().getSahara() == null ? false : input.getClient().getSahara())
                .build();
    }

    private List<Vehicule> buildVehiculesPreview(CreateContratRequest request, Contrat contrat, Usage usageContrat) {
        List<Vehicule> vehicules = new ArrayList<>();
        for (CreateContratRequest.VehiculeInput input : request.getVehicules() == null ? List.<CreateContratRequest.VehiculeInput>of() : request.getVehicules()) {
            Usage usage = input.getUsageId() == null ? usageContrat : usageRepository.findById(input.getUsageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
            Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), false);
            Carrosserie carrosserie = resolveCarrosserie(input.getCarrosserieId(), input.getCarrosserieLibelle(), false);
            CategorieTransport categorieTransport = resolveCategorieTransport(input.getCategorieTransportId());
            validateCategorieTransport(usage, categorieTransport);
            vehicules.add(Vehicule.builder()
                    .contrat(contrat)
                    .typeVehicule(input.getTypeVehicule())
                    .usage(usage)
                    .marque(marque)
                    .carrosserie(carrosserie)
                    .categorieTransport(categorieTransport)
                    .immatriculation(input.getImmatriculation())
                    .immatriculationProvisoire(input.getImmatriculationProvisoire())
                    .carburant(input.getCarburant())
                    .puissanceFiscale(input.getPuissanceFiscale())
                    .nombrePlaces(input.getNombrePlaces())
                    .sousClasse(input.getSousClasse())
                    .ptc(input.getPtc())
                    .datePremiereCirculation(input.getDatePremiereCirculation())
                    .dateExpirationCarteGrise(input.getDateExpirationCarteGrise())
                    .dateEffet(firstNonNull(input.getDateEffet(), contrat.getDateEffet()))
                    .dateEcheance(firstNonNull(input.getDateEcheance(), contrat.getDateEcheance()))
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurVenale(input.getValeurVenale())
                    .valeurNeuf(input.getValeurNeuf())
                    .valeurGlace(input.getValeurGlace())
                    .organismeCredit(input.getOrganismeCredit() == null ? false : input.getOrganismeCredit())
                    .nomOrganismeCredit(input.getNomOrganismeCredit())
                    .montantCredit(input.getMontantCredit())
                    .dateFinCredit(input.getDateFinCredit())
                    .build());
        }
        return vehicules;
    }

    private List<Remorque> buildRemorquesPreview(CreateContratRequest request, Contrat contrat, Usage usageContrat) {
        List<Remorque> remorques = new ArrayList<>();
        for (CreateContratRequest.RemorqueInput input : request.getRemorques() == null ? List.<CreateContratRequest.RemorqueInput>of() : request.getRemorques()) {
            Usage usage = input.getUsageId() == null ? usageContrat : usageRepository.findById(input.getUsageId())
                    .orElseThrow(() -> new ResourceNotFoundException("Usage", input.getUsageId()));
            Marque marque = resolveMarque(input.getMarqueId(), input.getMarqueLibelle(), false);
            remorques.add(Remorque.builder()
                    .contrat(contrat)
                    .usage(usage)
                    .marque(marque)
                    .immatriculation(input.getImmatriculation())
                    .ptc(input.getPtc())
                    .dateMiseEnCirculation(input.getDateMiseEnCirculation())
                    .dateEffet(firstNonNull(input.getDateEffet(), contrat.getDateEffet()))
                    .dateEcheance(firstNonNull(input.getDateEcheance(), contrat.getDateEcheance()))
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurAssuree(input.getValeurAssuree())
                    .build());
        }
        return remorques;
    }

    private List<ContratGarantie> buildGarantiesPreview(
            CreateContratRequest request,
            Contrat contrat,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        List<ContratGarantie> garanties = new ArrayList<>();
        for (CreateContratRequest.GarantieInput input : request.getGaranties() == null ? List.<CreateContratRequest.GarantieInput>of() : request.getGaranties()) {
            Garantie garantie = garantieRepository.findById(input.getGarantieId())
                    .orElseThrow(() -> new ResourceNotFoundException("Garantie", input.getGarantieId()));
            Client client = input.getClientId() == null ? null :
                    clientRepository.findByAgenceIdAndId(request.getAgenceId(), input.getClientId())
                            .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
            Vehicule vehicule = input.getVehiculeIndex() == null ? null : resolveVehicule(vehicules, input.getVehiculeIndex(), "Garantie");
            Remorque remorque = input.getRemorqueIndex() == null ? null : resolveRemorque(remorques, input.getRemorqueIndex(), "Garantie");
            Usage usageCible = resolveUsageCible(contrat, vehicule, remorque);
            LigneGrilleTarifaire ligneGrilleTarifaire = resolveLigneGrilleTarifaire(contrat, garantie, input, usageCible, vehicule, remorque);
            ModeTarificationGarantie modeSelectionne = resolveModeSelectionne(garantie, ligneGrilleTarifaire, input);
            SourceValeurGarantie sourceValeurSelectionnee = resolveSourceValeurSelectionnee(garantie, input, modeSelectionne, remorque);
            FormuleGarantiePersonne formuleGarantiePersonne = resolveFormuleGarantiePersonne(input.getFormuleGarantiePersonneId(), contrat, garantie, usageCible);
            GarantieMontants montants = resolveGarantieMontants(contrat, input, garantie, ligneGrilleTarifaire, vehicule, remorque, usageCible, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne);
            validateGarantieTarget(garantie, vehicule, remorque, client);
            validateGarantieConfiguration(contrat, garantie, input, modeSelectionne, sourceValeurSelectionnee, formuleGarantiePersonne, ligneGrilleTarifaire, montants);
            validateLigneGrilleTarifaire(contrat, garantie, ligneGrilleTarifaire, modeSelectionne, usageCible, vehicule);
            garanties.add(ContratGarantie.builder()
                    .contrat(contrat)
                    .garantie(garantie)
                    .vehicule(vehicule)
                    .remorque(remorque)
                    .client(client)
                    .ligneGrilleTarifaire(ligneGrilleTarifaire)
                    .modeSelectionne(modeSelectionne)
                    .sourceValeurSelectionnee(sourceValeurSelectionnee)
                    .formuleGarantiePersonne(formuleGarantiePersonne)
                    .valeurVenale(montants.valeurVenale())
                    .valeurNeuf(montants.valeurNeuf())
                    .valeurGlace(montants.valeurGlace())
                    .formule(montants.formule())
                    .montantDeces(montants.montantDeces())
                    .montantInvalidite(montants.montantInvalidite())
                    .montantFraisMedicaux(montants.montantFraisMedicaux())
                    .montantFraisHospitalisation(montants.montantFraisHospitalisation())
                    .montantFraisFuneraires(montants.montantFraisFuneraires())
                    .montantFraisChirurgie(montants.montantFraisChirurgie())
                    .accessoire(montants.accessoire())
                    .capital(montants.capital())
                    .taux(montants.taux())
                    .prime(montants.prime())
                    .tauxFranchise(montants.tauxFranchise())
                    .franchiseMinimale(montants.franchiseMinimale())
                    .build());
        }
        return garanties;
    }

    private ContratResponse toResponse(Contrat contrat) {
        return toResponse(contrat, true);
    }

    private ContratResponse toListResponse(Contrat contrat) {
        return toResponse(contrat, false);
    }

    private ContratResponse toResponse(Contrat contrat, boolean includeTargetSummaries) {
        return toResponse(contrat, includeTargetSummaries, null, true);
    }

    private ContratResponse toResponse(Contrat contrat, boolean includeTargetSummaries, Long selectedMouvementId) {
        return toResponse(contrat, includeTargetSummaries, selectedMouvementId, true);
    }

    private ContratResponse.VehiculeView toVehiculeView(Vehicule vehicule) {
        return ContratResponse.VehiculeView.builder()
                .vehiculeId(vehicule.getId())
                .typeVehicule(vehicule.getTypeVehicule().name())
                .usageId(vehicule.getUsage() != null ? vehicule.getUsage().getId() : null)
                .usageCode(vehicule.getUsage() != null ? vehicule.getUsage().getCode() : null)
                .usageLibelle(vehicule.getUsage() != null ? vehicule.getUsage().getLibelle() : null)
                .groupeUsageAttestationCode(vehicule.getUsage() != null && vehicule.getUsage().getGroupeUsageAttestation() != null ? vehicule.getUsage().getGroupeUsageAttestation().getCode() : null)
                .consommeAttestation(vehicule.getUsage() != null ? vehicule.getUsage().getConsommeAttestation() : null)
                .immatriculation(vehicule.getImmatriculation())
                .numeroAttestation(vehicule.getNumeroAttestation())
                .remorque(vehicule.getRemorque())
                .marqueId(vehicule.getMarque() != null ? vehicule.getMarque().getId() : null)
                .marque(vehicule.getMarque() != null ? vehicule.getMarque().getLibelle() : null)
                .carrosserieId(vehicule.getCarrosserie() != null ? vehicule.getCarrosserie().getId() : null)
                .carrosserie(vehicule.getCarrosserie() != null ? vehicule.getCarrosserie().getLibelle() : null)
                .categorieTransportId(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getId() : null)
                .categorieTransportCode(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getCode() : null)
                .categorieTransportLibelle(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getLibelle() : null)
                .carburant(vehicule.getCarburant())
                .puissanceFiscale(vehicule.getPuissanceFiscale())
                .nombrePlaces(vehicule.getNombrePlaces())
                .sousClasse(vehicule.getSousClasse())
                .ptc(vehicule.getPtc())
                .datePremiereCirculation(vehicule.getDatePremiereCirculation())
                .dateExpirationCarteGrise(vehicule.getDateExpirationCarteGrise())
                .dateEffet(vehicule.getDateEffet())
                .dateEcheance(vehicule.getDateEcheance())
                .crm(vehicule.getCrm())
                .coefficientProrata(vehicule.getCoefficientProrata())
                .valeurVenale(vehicule.getValeurVenale())
                .valeurNeuf(vehicule.getValeurNeuf())
                .valeurGlace(vehicule.getValeurGlace())
                .organismeCredit(vehicule.getOrganismeCredit())
                .nomOrganismeCredit(vehicule.getNomOrganismeCredit())
                .montantCredit(vehicule.getMontantCredit())
                .dateFinCredit(vehicule.getDateFinCredit())
                .build();
    }

    private ContratResponse.VehiculeView toVehiculeView(MouvementVehicule snapshot) {
        Vehicule vehicule = snapshot.getVehicule();
        return ContratResponse.VehiculeView.builder()
                .vehiculeId(vehicule != null ? vehicule.getId() : snapshot.getId())
                .typeVehicule(snapshot.getTypeVehicule() != null ? snapshot.getTypeVehicule().name() : null)
                .usageId(snapshot.getUsage() != null ? snapshot.getUsage().getId() : null)
                .usageCode(snapshot.getUsage() != null ? snapshot.getUsage().getCode() : null)
                .usageLibelle(snapshot.getUsage() != null ? snapshot.getUsage().getLibelle() : null)
                .groupeUsageAttestationCode(snapshot.getUsage() != null && snapshot.getUsage().getGroupeUsageAttestation() != null ? snapshot.getUsage().getGroupeUsageAttestation().getCode() : null)
                .consommeAttestation(snapshot.getUsage() != null ? snapshot.getUsage().getConsommeAttestation() : null)
                .immatriculation(snapshot.getImmatriculation())
                .numeroAttestation(snapshot.getNumeroAttestation())
                .remorque(false)
                .marqueId(snapshot.getMarque() != null ? snapshot.getMarque().getId() : null)
                .marque(snapshot.getMarque() != null ? snapshot.getMarque().getLibelle() : null)
                .carrosserieId(snapshot.getCarrosserie() != null ? snapshot.getCarrosserie().getId() : null)
                .carrosserie(snapshot.getCarrosserie() != null ? snapshot.getCarrosserie().getLibelle() : null)
                .categorieTransportId(snapshot.getCategorieTransport() != null ? snapshot.getCategorieTransport().getId() : null)
                .categorieTransportCode(snapshot.getCategorieTransport() != null ? snapshot.getCategorieTransport().getCode() : null)
                .categorieTransportLibelle(snapshot.getCategorieTransport() != null ? snapshot.getCategorieTransport().getLibelle() : null)
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
                .coefficientProrata(snapshot.getCoefficientProrata())
                .valeurVenale(snapshot.getValeurVenale())
                .valeurNeuf(snapshot.getValeurNeuf())
                .valeurGlace(snapshot.getValeurGlace())
                .organismeCredit(snapshot.getOrganismeCredit())
                .nomOrganismeCredit(snapshot.getNomOrganismeCredit())
                .montantCredit(snapshot.getMontantCredit())
                .dateFinCredit(snapshot.getDateFinCredit())
                .build();
    }

    private ContratResponse.RemorqueView toRemorqueView(Remorque remorque) {
        return ContratResponse.RemorqueView.builder()
                .remorqueId(remorque.getId())
                .usageId(remorque.getUsage() != null ? remorque.getUsage().getId() : null)
                .usageCode(remorque.getUsage() != null ? remorque.getUsage().getCode() : null)
                .usageLibelle(remorque.getUsage() != null ? remorque.getUsage().getLibelle() : null)
                .groupeUsageAttestationCode(remorque.getUsage() != null && remorque.getUsage().getGroupeUsageAttestation() != null ? remorque.getUsage().getGroupeUsageAttestation().getCode() : null)
                .consommeAttestation(remorque.getUsage() != null ? remorque.getUsage().getConsommeAttestation() : null)
                .immatriculation(remorque.getImmatriculation())
                .numeroAttestation(remorque.getNumeroAttestation())
                .marqueId(remorque.getMarque() != null ? remorque.getMarque().getId() : null)
                .marque(remorque.getMarque() != null ? remorque.getMarque().getLibelle() : null)
                .ptc(remorque.getPtc())
                .dateMiseEnCirculation(remorque.getDateMiseEnCirculation())
                .dateEffet(remorque.getDateEffet())
                .dateEcheance(remorque.getDateEcheance())
                .crm(remorque.getCrm())
                .coefficientProrata(remorque.getCoefficientProrata())
                .valeurAssuree(remorque.getValeurAssuree())
                .build();
    }

    private ContratResponse.RemorqueView toRemorqueView(MouvementRemorque snapshot) {
        Remorque remorque = snapshot.getRemorque();
        return ContratResponse.RemorqueView.builder()
                .remorqueId(remorque != null ? remorque.getId() : snapshot.getId())
                .usageId(snapshot.getUsage() != null ? snapshot.getUsage().getId() : null)
                .usageCode(snapshot.getUsage() != null ? snapshot.getUsage().getCode() : null)
                .usageLibelle(snapshot.getUsage() != null ? snapshot.getUsage().getLibelle() : null)
                .groupeUsageAttestationCode(snapshot.getUsage() != null && snapshot.getUsage().getGroupeUsageAttestation() != null ? snapshot.getUsage().getGroupeUsageAttestation().getCode() : null)
                .consommeAttestation(snapshot.getUsage() != null ? snapshot.getUsage().getConsommeAttestation() : null)
                .immatriculation(snapshot.getImmatriculation())
                .numeroAttestation(snapshot.getNumeroAttestation())
                .marqueId(snapshot.getMarque() != null ? snapshot.getMarque().getId() : null)
                .marque(snapshot.getMarque() != null ? snapshot.getMarque().getLibelle() : null)
                .ptc(snapshot.getPtc())
                .dateMiseEnCirculation(snapshot.getDateMiseEnCirculation())
                .dateEffet(snapshot.getDateEffet())
                .dateEcheance(snapshot.getDateEcheance())
                .crm(snapshot.getCrm())
                .coefficientProrata(snapshot.getCoefficientProrata())
                .valeurAssuree(snapshot.getValeurAssuree())
                .build();
    }

    private ContratResponse.GarantieView toGarantieView(ContratGarantie contratGarantie) {
        return ContratResponse.GarantieView.builder()
                .contratGarantieId(contratGarantie.getId())
                .garantieId(contratGarantie.getGarantie().getId())
                .code(contratGarantie.getGarantie().getCode())
                .libelle(contratGarantie.getGarantie().getLibelle())
                .typeGarantie(contratGarantie.getGarantie().getTypeGarantie().name())
                .clientId(contratGarantie.getClient() != null ? contratGarantie.getClient().getId() : null)
                .vehiculeId(contratGarantie.getVehicule() != null ? contratGarantie.getVehicule().getId() : null)
                .remorqueId(contratGarantie.getRemorque() != null ? contratGarantie.getRemorque().getId() : null)
                .ligneGrilleTarifaireId(contratGarantie.getLigneGrilleTarifaire() != null ? contratGarantie.getLigneGrilleTarifaire().getId() : null)
                .modeSelectionne(contratGarantie.getModeSelectionne() != null ? contratGarantie.getModeSelectionne().name() : null)
                .sourceValeurSelectionnee(contratGarantie.getSourceValeurSelectionnee() != null ? contratGarantie.getSourceValeurSelectionnee().name() : null)
                .formuleGarantiePersonneId(contratGarantie.getFormuleGarantiePersonne() != null ? contratGarantie.getFormuleGarantiePersonne().getId() : null)
                .valeurVenale(contratGarantie.getValeurVenale())
                .valeurNeuf(contratGarantie.getValeurNeuf())
                .valeurGlace(contratGarantie.getValeurGlace())
                .valeurAssuree(contratGarantie.getCapital())
                .formule(contratGarantie.getFormule())
                .montantDeces(contratGarantie.getMontantDeces())
                .montantInvalidite(contratGarantie.getMontantInvalidite())
                .montantFraisMedicaux(contratGarantie.getMontantFraisMedicaux())
                .montantFraisHospitalisation(contratGarantie.getMontantFraisHospitalisation())
                .montantFraisFuneraires(contratGarantie.getMontantFraisFuneraires())
                .montantFraisChirurgie(contratGarantie.getMontantFraisChirurgie())
                .accessoire(contratGarantie.getAccessoire())
                .capital(contratGarantie.getCapital())
                .taux(contratGarantie.getTaux())
                .prime(contratGarantie.getPrime())
                .tauxFranchise(contratGarantie.getTauxFranchise())
                .franchiseMinimale(contratGarantie.getFranchiseMinimale())
                .build();
    }

    private ContratResponse.GarantieView toGarantieView(MouvementGarantie snapshot) {
        Garantie garantie = snapshot.getGarantie();
        ContratGarantie contratGarantie = snapshot.getContratGarantie();
        return ContratResponse.GarantieView.builder()
                .contratGarantieId(contratGarantie != null ? contratGarantie.getId() : snapshot.getId())
                .garantieId(garantie.getId())
                .code(garantie.getCode())
                .libelle(garantie.getLibelle())
                .typeGarantie(garantie.getTypeGarantie().name())
                .clientId(snapshot.getClient() != null ? snapshot.getClient().getId() : null)
                .vehiculeId(snapshot.getVehicule() != null ? snapshot.getVehicule().getId() : null)
                .remorqueId(snapshot.getRemorque() != null ? snapshot.getRemorque().getId() : null)
                .ligneGrilleTarifaireId(snapshot.getLigneGrilleTarifaire() != null ? snapshot.getLigneGrilleTarifaire().getId() : null)
                .modeSelectionne(snapshot.getModeSelectionne() != null ? snapshot.getModeSelectionne().name() : null)
                .sourceValeurSelectionnee(snapshot.getSourceValeurSelectionnee() != null ? snapshot.getSourceValeurSelectionnee().name() : null)
                .formuleGarantiePersonneId(snapshot.getFormuleGarantiePersonne() != null ? snapshot.getFormuleGarantiePersonne().getId() : null)
                .valeurVenale(snapshot.getValeurVenale())
                .valeurNeuf(snapshot.getValeurNeuf())
                .valeurGlace(snapshot.getValeurGlace())
                .valeurAssuree(snapshot.getCapital())
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
                .build();
    }

    private ContratResponse toResponse(Contrat contrat, boolean includeTargetSummaries, Long selectedMouvementId, boolean fallbackInactiveForView) {
        List<ContratResponse.ClientLink> clients = new ArrayList<>();
        for (ContratClient link : contrat.getClients()) {
            clients.add(ContratResponse.ClientLink.builder()
                    .clientId(link.getClient().getId())
                    .nomAffichage(link.getClient().getNomAffichage())
                    .role(link.getRole().name())
                    .principalPourRole(Boolean.TRUE.equals(link.getPrincipalPourRole()))
                    .client(clientService.toResponse(link.getClient()))
                    .build());
        }

        MouvementContrat selectedMouvement = selectedMouvementId == null
                ? null
                : mouvementContratRepository.findByContratIdAndId(contrat.getId(), selectedMouvementId)
                        .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", selectedMouvementId));
        List<ContratResponse.VehiculeView> vehicules;
        List<ContratResponse.RemorqueView> remorques;
        List<ContratResponse.GarantieView> garanties;
        if (selectedMouvement == null) {
            List<Vehicule> vehiculesActifs = fallbackInactiveForView ? activeVehiculesForView(contrat) : activeVehicules(contrat);
            List<Remorque> remorquesActives = fallbackInactiveForView ? activeRemorquesForView(contrat) : activeRemorques(contrat);
            List<ContratGarantie> garantiesActives = fallbackInactiveForView ? activeGarantiesForView(contrat) : activeGaranties(contrat);
            vehicules = vehiculesActifs.stream().map(this::toVehiculeView).toList();
            remorques = remorquesActives.stream().map(this::toRemorqueView).toList();
            garanties = garantiesActives.stream().map(this::toGarantieView).toList();
        } else {
            vehicules = mouvementVehiculeRepository.findByMouvementContratId(selectedMouvement.getId()).stream()
                    .sorted(Comparator.comparing(MouvementVehicule::getId))
                    .map(this::toVehiculeView)
                    .toList();
            remorques = mouvementRemorqueRepository.findByMouvementContratId(selectedMouvement.getId()).stream()
                    .sorted(Comparator.comparing(MouvementRemorque::getId))
                    .map(this::toRemorqueView)
                    .toList();
            garanties = mouvementGarantieRepository.findByMouvementContratId(selectedMouvement.getId()).stream()
                    .sorted(Comparator.comparing(MouvementGarantie::getId))
                    .map(this::toGarantieView)
                    .toList();
        }

        List<MouvementContrat> mouvementsActifs = contrat.getMouvements().stream()
                .filter(mouvement -> mouvement.getStatut() != StatutMouvementContrat.ANNULE)
                .sorted(Comparator
                        .comparing(MouvementContrat::getCreatedAt, Comparator.nullsLast(Comparator.naturalOrder()))
                        .thenComparing(MouvementContrat::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .toList();
        List<ContratResponse.MouvementView> mouvements = new ArrayList<>();
        for (int mouvementIndex = 0; mouvementIndex < mouvementsActifs.size(); mouvementIndex++) {
            MouvementContrat mouvement = mouvementsActifs.get(mouvementIndex);
            mouvements.add(ContratResponse.MouvementView.builder()
                    .id(mouvement.getId())
                    .code(mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getCode() : null)
                    .libelle(mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getLibelle() : null)
                    .categorie(mouvement.getTypeMouvement() != null && mouvement.getTypeMouvement().getCategorie() != null ? mouvement.getTypeMouvement().getCategorie().name() : null)
                    .statut(mouvement.getStatut() != null ? mouvement.getStatut().name() : null)
                    .numeroMouvement(numeroActeAffiche(mouvement, mouvementIndex + 1))
                    .dateEffet(mouvement.getDateEffet())
                    .dateEcheance(mouvement.getDateEcheance())
                    .primeNette(mouvement.getPrimeNette())
                    .taxe(mouvement.getTaxe())
                    .taxeParafiscale(mouvement.getTaxeParafiscale())
                    .accessoire(mouvement.getAccessoire())
                    .cnpac(mouvement.getCnpac())
                    .primeTotale(mouvement.getPrimeTotale())
                    .build());
        }

        List<ContratResponse.ElementFacturableView> elementsFacturables = new ArrayList<>();
        for (ElementFacturable element : contrat.getElementsFacturables()) {
            elementsFacturables.add(ContratResponse.ElementFacturableView.builder()
                    .id(element.getId())
                    .mouvementContratId(element.getMouvementContrat() != null ? element.getMouvementContrat().getId() : null)
                    .nature(element.getNature() != null ? element.getNature().name() : null)
                    .statut(element.getStatut() != null ? element.getStatut().name() : null)
                    .referenceSource(element.getReferenceSource())
                    .libelle(element.getLibelle())
                    .dateDebut(element.getDateDebut())
                    .dateFin(element.getDateFin())
                    .primeNette(element.getPrimeNette())
                    .taxe(element.getTaxe())
                    .taxeParafiscale(element.getTaxeParafiscale())
                    .accessoire(element.getAccessoire())
                    .cnpac(element.getCnpac())
                    .primeTotale(element.getPrimeTotale())
                    .build());
        }
        List<AssistanceContratResponse> assistances = (selectedMouvement == null
                ? assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(contrat.getId())
                : assistanceContratRepository.findByContratIdOrderByCreatedAtDesc(contrat.getId()).stream()
                        .filter(assistance -> assistance.getMouvementContrat() != null
                                && selectedMouvement.getId().equals(assistance.getMouvementContrat().getId()))
                        .toList())
                .stream()
                .map(this::toAssistanceResponse)
                .toList();
        QuittanceResponse quittanceGenerale = selectedMouvementId == null
                ? buildQuittanceGenerale(contrat, includeTargetSummaries)
                : buildSavedQuittanceMouvement(contrat, selectedMouvementId);
        List<QuittanceResponse.TargetSummary> targetSummaries = quittanceGenerale == null
                ? List.of()
                : quittanceGenerale.getTargetSummaries();

        return ContratResponse.builder()
                .id(contrat.getId())
                .numeroContrat(contrat.getNumeroContrat())
                .numeroDevis(contrat.getNumeroDevis())
                .numeroDossier(contrat.getNumeroDossier())
                .numeroPolice(contrat.getNumeroPolice())
                .createdAt(contrat.getCreatedAt())
                .typeContrat(contrat.getTypeContrat())
                .statut(contrat.getStatut())
                .agenceId(contrat.getAgence() != null ? contrat.getAgence().getId() : null)
                .compagnieAssuranceId(contrat.getCompagnieAssurance() != null ? contrat.getCompagnieAssurance().getId() : null)
                .conventionId(contrat.getConvention() != null ? contrat.getConvention().getId() : null)
                .contratOrigineId(contrat.getContratOrigine() != null ? contrat.getContratOrigine().getId() : null)
                .renouvele(contrat.getRenouvele())
                .modeTermeRenouvellement(contrat.getModeTermeRenouvellement())
                .renouvellementTermeCompagnieEligible(isRenewalCompanyTermEligible(contrat))
                .usageId(contrat.getUsage() != null ? contrat.getUsage().getId() : null)
                .usageCode(contrat.getUsage() != null ? contrat.getUsage().getCode() : null)
                .usageLibelle(contrat.getUsage() != null ? contrat.getUsage().getLibelle() : null)
                .groupeUsageAttestationCode(contrat.getUsage() != null && contrat.getUsage().getGroupeUsageAttestation() != null ? contrat.getUsage().getGroupeUsageAttestation().getCode() : null)
                .groupeUsageAttestationLibelle(contrat.getUsage() != null && contrat.getUsage().getGroupeUsageAttestation() != null ? contrat.getUsage().getGroupeUsageAttestation().getLibelle() : null)
                .consommeAttestation(contrat.getUsage() != null ? contrat.getUsage().getConsommeAttestation() : null)
                .grilleTarifaireId(contrat.getGrilleTarifaire() != null ? contrat.getGrilleTarifaire().getId() : null)
                .dateEffet(contrat.getDateEffet())
                .dateEcheance(contrat.getDateEcheance())
                .numeroAttestation(contrat.getNumeroAttestation())
                .echeance(contrat.getEcheance())
                .typeRenouvellement(contrat.getTypeRenouvellement())
                .modePaiement(contrat.getModePaiement())
                .modeReglement(contrat.getModeReglement())
                .numeroBonCommande(contrat.getNumeroBonCommande())
                .montantBulletin(contrat.getMontantBulletin())
                .typePayeurPrime(contrat.getTypePayeurPrime() == null
                        ? TypePayeurPrime.SOUSCRIPTEUR
                        : contrat.getTypePayeurPrime())
                .payeurPrimeClientId(contrat.getPayeurPrime() == null ? null : contrat.getPayeurPrime().getId())
                .payeurPrimeNom(contrat.getPayeurPrime() == null ? null : contrat.getPayeurPrime().getNomAffichage())
                .groupeFacturationId(contrat.getGroupeFacturation() == null ? null : contrat.getGroupeFacturation().getId())
                .groupeFacturationNom(contrat.getGroupeFacturation() == null ? null : contrat.getGroupeFacturation().getLibelle())
                .modeFacturation(contrat.getModeFacturation() == null
                        ? ModeFacturationContrat.DIRECTE
                        : contrat.getModeFacturation())
                .referenceMandatPayeur(contrat.getReferenceMandatPayeur())
                .periodicite(contrat.getPeriodicite())
                .fractionnement(contrat.getFractionnement())
                .tauxRc(contrat.getTauxRc())
                .modeSaisieGaranties(contrat.getModeSaisieGaranties())
                .saisiePrimeNette(contrat.getSaisiePrimeNette())
                .nombreVehicules(contrat.getNombreVehicules())
                .nombreRemorques(contrat.getNombreRemorques())
                .brouillon(contrat.getBrouillon())
                .prospection(contrat.getProspection())
                .assistance(selectedMouvement == null
                        ? Boolean.TRUE.equals(contrat.getAssistance()) || !assistances.isEmpty()
                        : !assistances.isEmpty())
                .crmPartage(contrat.getCrmPartage())
                .crmPartageValeur(contrat.getCrmPartageValeur())
                .clients(clients)
                .vehicules(vehicules)
                .remorques(remorques)
                .garanties(garanties)
                .assistances(assistances)
                .mouvements(mouvements)
                .elementsFacturables(elementsFacturables)
                .targetSummaries(targetSummaries)
                .quittanceGenerale(quittanceGenerale)
                .build();
    }

    private String numeroActeAffiche(MouvementContrat mouvement, int positionChronologique) {
        String numero = mouvement.getNumeroMouvement();
        if (numero != null && numero.trim().matches("\\d+")) {
            return numero.trim();
        }
        return String.valueOf(positionChronologique);
    }

    private AssistanceContratResponse toAssistanceResponse(AssistanceContrat assistance) {
        int trimestres = assistance.getDuree() == null
                ? AssistanceContratService.resolveAssistanceQuarterCount(assistance.getDateEffet(), assistance.getDateEcheance())
                : assistance.getDuree();
        BigDecimal prorata = BigDecimal.valueOf(trimestres).divide(BigDecimal.valueOf(4), 8, RoundingMode.HALF_UP);
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

    private QuittanceResponse buildQuittanceGenerale(Contrat contrat, boolean include) {
        if (!include) {
            return null;
        }
        QuittanceResponse saved = buildSavedQuittanceGenerale(contrat);
        if (saved != null) {
            return saved;
        }
        List<Vehicule> vehiculesActifs = activeVehiculesForView(contrat);
        List<Remorque> remorquesActives = activeRemorquesForView(contrat);
        List<ContratGarantie> garantiesActives = activeGarantiesForView(contrat);
        if (garantiesActives.isEmpty()) {
            return null;
        }
        int unitesCnpac = countCnpacUnits(garantiesActives, vehiculesActifs, remorquesActives);
        QuittanceCalculService.Resultat calcul = quittanceCalculService.calculer(contrat, null, garantiesActives, unitesCnpac);
        List<QuittanceResponse.TargetSummary> targetSummaries = elementFacturableCibleService.calculer(
                contrat,
                garantiesActives,
                vehiculesActifs,
                remorquesActives
        );
        return QuittanceResponse.builder()
                .numeroContrat(contrat.getNumeroContrat())
                .type("AN")
                .categorie("TOTAL")
                .globale(true)
                .dateDebut(contrat.getDateEffet())
                .dateFin(contrat.getDateEcheance())
                .primeNette(calcul.primeNette())
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(calcul.cnpac())
                .primeTotale(calcul.primeTotale())
                .lignes(calcul.lignes().stream().map(this::toQuittanceLigneResponse).toList())
                .garanties(garantiesActives.stream()
                        .map(garantie -> toQuittanceGarantieResponse(garantie, vehiculesActifs, remorquesActives))
                        .toList())
                .targetSummaries(targetSummaries)
                .build();
    }

    private QuittanceResponse buildSavedQuittanceGenerale(Contrat contrat) {
        Quittance quittance = (contrat.getQuittances() == null ? List.<Quittance>of() : contrat.getQuittances()).stream()
                .filter(item -> Boolean.TRUE.equals(item.getGlobale()))
                .filter(this::isContratQuittanceGenerale)
                .max(Comparator.comparing(Quittance::getCreatedAt, Comparator.nullsFirst(Comparator.naturalOrder())))
                .orElse(null);
        if (quittance == null) {
            return null;
        }
        return buildSavedQuittanceResponse(contrat, quittance);
    }

    private QuittanceResponse buildSavedQuittanceMouvement(Contrat contrat, Long mouvementId) {
        MouvementContrat mouvement = mouvementContratRepository.findByContratIdAndId(contrat.getId(), mouvementId)
                .orElseThrow(() -> new ResourceNotFoundException("MouvementContrat", mouvementId));
        return quittanceRepository.findByMouvementContratIdOrderByCreatedAtDesc(mouvement.getId()).stream()
                .findFirst()
                .map(quittance -> buildSavedQuittanceResponse(contrat, quittance))
                .orElse(null);
    }

    private QuittanceResponse buildSavedQuittanceResponse(Contrat contrat, Quittance quittance) {
        ElementFacturable elementFacturable = quittance.getElementFacturable();
        Long elementFacturableId = elementFacturable == null ? null : elementFacturable.getId();
        List<QuittanceResponse.TargetSummary> targetSummaries = elementFacturableId == null
                ? List.of()
                : elementFacturableCibleService.listByElementFacturable(elementFacturableId);
        return QuittanceResponse.builder()
                .id(quittance.getId())
                .contratId(contrat.getId())
                .numeroContrat(contrat.getNumeroContrat())
                .mouvementContratId(quittance.getMouvementContrat() == null ? null : quittance.getMouvementContrat().getId())
                .codeMouvement(quittance.getMouvementContrat() != null && quittance.getMouvementContrat().getTypeMouvement() != null ? quittance.getMouvementContrat().getTypeMouvement().getCode() : null)
                .typeImpactMouvement(quittance.getMouvementContrat() != null && quittance.getMouvementContrat().getTypeMouvement() != null && quittance.getMouvementContrat().getTypeMouvement().getTypeImpact() != null ? quittance.getMouvementContrat().getTypeMouvement().getTypeImpact().name() : null)
                .elementFacturableId(elementFacturableId)
                .numeroQuittance(quittance.getNumeroQuittance())
                .type(quittance.getType())
                .categorie(quittance.getCategorie())
                .globale(quittance.getGlobale())
                .dateDebut(quittance.getDateDebut())
                .dateFin(quittance.getDateFin())
                .primeNette(quittance.getPrimeNette())
                .taxe(quittance.getTaxe())
                .taxeParafiscale(quittance.getTaxeParafiscale())
                .accessoire(quittance.getAccessoire())
                .cnpac(quittance.getCnpac())
                .primeTotale(quittance.getPrimeTotale())
                .lignes((quittance.getLignes() == null ? List.<LigneQuittance>of() : quittance.getLignes()).stream()
                        .sorted(Comparator.comparing(LigneQuittance::getOrdre, Comparator.nullsLast(Comparator.naturalOrder())))
                        .map(this::toSavedQuittanceLigneResponse)
                        .toList())
                .targetSummaries(targetSummaries)
                .build();
    }

    private boolean isContratQuittanceGenerale(Quittance quittance) {
        ElementFacturable elementFacturable = quittance.getElementFacturable();
        if (elementFacturable == null) {
            return quittance.getMouvementContrat() == null;
        }
        return elementFacturable.getNature() == NatureElementFacturable.CONTRAT;
    }

    private int countCnpacUnits(List<ContratGarantie> garanties, List<Vehicule> vehicules, List<Remorque> remorques) {
        Set<String> units = new LinkedHashSet<>();
        for (ContratGarantie garantie : garanties == null ? List.<ContratGarantie>of() : garanties) {
            if (!isResponsabiliteCivile(garantie)) {
                continue;
            }
            String key = targetUnitKey(garantie, vehicules, remorques);
            if (key != null) {
                units.add(key);
            }
        }
        if (!units.isEmpty()) {
            return units.size();
        }
        int fallbackUnits = (vehicules == null ? 0 : vehicules.size()) + (remorques == null ? 0 : remorques.size());
        return Math.max(1, fallbackUnits);
    }

    private boolean isResponsabiliteCivile(ContratGarantie contratGarantie) {
        if (contratGarantie == null || contratGarantie.getGarantie() == null) {
            return false;
        }
        Garantie garantie = contratGarantie.getGarantie();
        String code = garantie.getCode() == null ? "" : garantie.getCode().trim().toUpperCase(Locale.ROOT);
        return Boolean.TRUE.equals(garantie.getResponsabiliteCivile()) || "RC".equals(code);
    }

    private String targetUnitKey(ContratGarantie garantie, List<Vehicule> vehicules, List<Remorque> remorques) {
        if (garantie.getVehicule() != null) {
            Long id = garantie.getVehicule().getId();
            return "V:" + (id != null ? id : identityIndex(vehicules, garantie.getVehicule()));
        }
        if (garantie.getRemorque() != null) {
            Long id = garantie.getRemorque().getId();
            return "R:" + (id != null ? id : identityIndex(remorques, garantie.getRemorque()));
        }
        return "CONTRAT";
    }

    private int identityIndex(List<?> items, Object target) {
        if (items != null) {
            for (int index = 0; index < items.size(); index++) {
                if (items.get(index) == target) {
                    return index;
                }
            }
        }
        return System.identityHashCode(target);
    }

    private Marque resolveMarque(Long marqueId, String marqueLibelle, boolean createIfMissing) {
        if (marqueId != null) {
            return marqueRepository.findById(marqueId)
                    .orElseThrow(() -> new ResourceNotFoundException("Marque", marqueId));
        }
        if (!hasText(marqueLibelle)) {
            return null;
        }
        String libelle = marqueLibelle.trim();
        return marqueRepository.findByLibelleIgnoreCase(libelle)
                .orElseGet(() -> createIfMissing ? marqueRepository.save(Marque.builder()
                        .libelle(libelle)
                        .actif(true)
                        .build()) : Marque.builder().libelle(libelle).actif(true).build());
    }

    private Carrosserie resolveCarrosserie(Long carrosserieId, String carrosserieLibelle, boolean createIfMissing) {
        if (carrosserieId != null) {
            return carrosserieRepository.findById(carrosserieId)
                    .orElseThrow(() -> new ResourceNotFoundException("Carrosserie", carrosserieId));
        }
        if (!hasText(carrosserieLibelle)) {
            return null;
        }
        String libelle = carrosserieLibelle.trim();
        return carrosserieRepository.findByLibelleIgnoreCase(libelle)
                .orElseGet(() -> createIfMissing ? carrosserieRepository.save(Carrosserie.builder()
                        .libelle(libelle)
                        .actif(true)
                        .build()) : Carrosserie.builder().libelle(libelle).actif(true).build());
    }

    private CategorieTransport resolveCategorieTransport(Long categorieTransportId) {
        if (categorieTransportId == null) {
            return null;
        }
        return categorieTransportRepository.findById(categorieTransportId)
                .orElseThrow(() -> new ResourceNotFoundException("CategorieTransport", categorieTransportId));
    }

    private void validateCategorieTransport(Usage usage, CategorieTransport categorieTransport) {
        if (usage == null) {
            return;
        }
        if (Boolean.TRUE.equals(usage.getByCategorieTransport()) && categorieTransport == null) {
            throw new BadRequestException("La categorie transport est obligatoire pour l'usage " + usage.getCode());
        }
        if (!Boolean.TRUE.equals(usage.getByCategorieTransport()) && categorieTransport != null) {
            throw new BadRequestException("La categorie transport n'est pas applicable pour l'usage " + usage.getCode());
        }
    }

    private QuittanceCalculService.Resultat buildManualQuittanceResult(CreateContratRequest request) {
        if (request.getQuittances() == null || request.getQuittances().isEmpty()) {
            return null;
        }
        if (request.getTypeContrat() != com.assurance.enums.TypeContrat.PARTICULIER) {
            throw new BadRequestException("La quittance manuelle est autorisee uniquement pour les contrats particuliers");
        }

        List<QuittanceCalculService.Ligne> lignes = new ArrayList<>();
        BigDecimal primeNette = BigDecimal.ZERO;
        BigDecimal taxe = BigDecimal.ZERO;
        BigDecimal taxeParafiscale = BigDecimal.ZERO;
        BigDecimal accessoire = BigDecimal.ZERO;
        BigDecimal cnpac = BigDecimal.ZERO;
        BigDecimal primeTotale = BigDecimal.ZERO;

        for (CreateContratRequest.QuittanceInput input : request.getQuittances()) {
            if (input == null || input.getCategorie() == null || input.getCategorie() == CategorieQuittance.TOTAL) {
                continue;
            }
            BigDecimal lignePrimeNette = scale(zeroIfNull(input.getPrimeNette()));
            BigDecimal ligneTaxe = scale(zeroIfNull(input.getTaxe()));
            BigDecimal ligneTaxeParafiscale = scale(zeroIfNull(input.getTaxeParafiscale()));
            BigDecimal ligneAccessoire = scale(zeroIfNull(input.getAccessoire()));
            BigDecimal ligneCnpac = scale(zeroIfNull(input.getCnpac()));
            BigDecimal lignePrimeTotale = input.getPrimeTotale() == null
                    ? scale(lignePrimeNette.add(ligneTaxe).add(ligneTaxeParafiscale).add(ligneAccessoire).add(ligneCnpac))
                    : scale(input.getPrimeTotale());

            lignes.add(new QuittanceCalculService.Ligne(
                    input.getCategorie(),
                    input.getOrdre() == null ? defaultQuittanceOrder(input.getCategorie()) : input.getOrdre(),
                    false,
                    lignePrimeNette,
                    ligneTaxe,
                    ligneTaxeParafiscale,
                    ligneAccessoire,
                    ligneCnpac,
                    lignePrimeTotale
            ));
            primeNette = primeNette.add(lignePrimeNette);
            taxe = taxe.add(ligneTaxe);
            taxeParafiscale = taxeParafiscale.add(ligneTaxeParafiscale);
            accessoire = accessoire.add(ligneAccessoire);
            cnpac = cnpac.add(ligneCnpac);
            primeTotale = primeTotale.add(lignePrimeTotale);
        }

        if (lignes.isEmpty()) {
            return null;
        }
        lignes.sort((left, right) -> Integer.compare(left.ordre(), right.ordre()));
        lignes.add(new QuittanceCalculService.Ligne(
                CategorieQuittance.TOTAL,
                99,
                true,
                scale(primeNette),
                scale(taxe),
                scale(taxeParafiscale),
                scale(accessoire),
                scale(cnpac),
                scale(primeTotale)
        ));
        return new QuittanceCalculService.Resultat(
                lignes,
                scale(primeNette),
                scale(taxe),
                scale(taxeParafiscale),
                scale(accessoire),
                scale(cnpac),
                scale(primeTotale)
        );
    }

    private int defaultQuittanceOrder(CategorieQuittance categorie) {
        return switch (categorie) {
            case AUTOMOBILE -> 10;
            case CORPOREL -> 20;
            case EVCAT -> 30;
            case ASSISTANCE -> 40;
            case TOTAL -> 99;
        };
    }

    private BigDecimal zeroIfNull(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private BigDecimal scale(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private QuittanceResponse.Ligne toQuittanceLigneResponse(QuittanceCalculService.Ligne ligne) {
        return QuittanceResponse.Ligne.builder()
                .categorie(ligne.categorie().name())
                .ordre(ligne.ordre())
                .globale(ligne.globale())
                .primeNette(ligne.primeNette())
                .taxe(ligne.taxe())
                .taxeParafiscale(ligne.taxeParafiscale())
                .accessoire(ligne.accessoire())
                .cnpac(ligne.cnpac())
                .primeTotale(ligne.primeTotale())
                .build();
    }

    private QuittanceResponse.Ligne toSavedQuittanceLigneResponse(LigneQuittance ligne) {
        return QuittanceResponse.Ligne.builder()
                .categorie(ligne.getCategorie() == null ? null : ligne.getCategorie().name())
                .ordre(ligne.getOrdre())
                .globale(ligne.getGlobale())
                .primeNette(ligne.getPrimeNette())
                .taxe(ligne.getTaxe())
                .taxeParafiscale(ligne.getTaxeParafiscale())
                .accessoire(ligne.getAccessoire())
                .cnpac(ligne.getCnpac())
                .primeTotale(ligne.getPrimeTotale())
                .build();
    }

    private QuittanceResponse.GarantieLigne toQuittanceGarantieResponse(
            ContratGarantie contratGarantie,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        Garantie garantie = contratGarantie.getGarantie();
        LigneGrilleTarifaire ligne = contratGarantie.getLigneGrilleTarifaire();
        return QuittanceResponse.GarantieLigne.builder()
                .garantieId(garantie == null ? null : garantie.getId())
                .code(garantie == null ? null : garantie.getCode())
                .libelle(garantie == null ? null : garantie.getLibelle())
                .typeGarantie(garantie == null || garantie.getTypeGarantie() == null ? null : garantie.getTypeGarantie().name())
                .vehiculeIndex(indexOfIdentity(vehicules, contratGarantie.getVehicule()))
                .remorqueIndex(indexOfIdentity(remorques, contratGarantie.getRemorque()))
                .ligneGrilleTarifaireId(ligne == null ? null : ligne.getId())
                .modeSelectionne(contratGarantie.getModeSelectionne() == null ? null : contratGarantie.getModeSelectionne().name())
                .sourceValeurSelectionnee(contratGarantie.getSourceValeurSelectionnee() == null ? null : contratGarantie.getSourceValeurSelectionnee().name())
                .formuleGarantiePersonneId(contratGarantie.getFormuleGarantiePersonne() == null ? null : contratGarantie.getFormuleGarantiePersonne().getId())
                .capital(contratGarantie.getCapital())
                .valeurVenale(contratGarantie.getValeurVenale())
                .valeurNeuf(contratGarantie.getValeurNeuf())
                .valeurGlace(contratGarantie.getValeurGlace())
                .taux(contratGarantie.getTaux())
                .primeNette(contratGarantie.getPrime())
                .tauxFranchise(contratGarantie.getTauxFranchise())
                .franchiseMinimale(contratGarantie.getFranchiseMinimale())
                .build();
    }

    private <T> Integer indexOfIdentity(List<T> source, T target) {
        if (target == null) {
            return null;
        }
        for (int index = 0; index < source.size(); index++) {
            if (source.get(index) == target) {
                return index;
            }
        }
        return null;
    }

    private Vehicule resolveVehicule(List<Vehicule> vehicules, Integer index, String contexte) {
        if (index == null || index < 0 || index >= vehicules.size()) {
            throw new BadRequestException(contexte + " cible un vehicule invalide");
        }
        return vehicules.get(index);
    }

    private Remorque resolveRemorque(List<Remorque> remorques, Integer index, String contexte) {
        if (index == null || index < 0 || index >= remorques.size()) {
            throw new BadRequestException(contexte + " cible une remorque invalide");
        }
        return remorques.get(index);
    }

    private Contrat ensureNumeroDossier(Contrat contrat) {
        if (hasText(contrat.getNumeroDossier())
                || Boolean.TRUE.equals(contrat.getBrouillon())
                || contrat.getStatut() == StatutContrat.DRAFT) {
            return contrat;
        }
        if (contrat.getAgence() == null
                || contrat.getCompagnieAssurance() == null
                || !hasText(contrat.getCompagnieAssurance().getCode())) {
            return contrat;
        }
        contrat.setNumeroDossier(nextNumeroDossier(contrat.getAgence(), contrat.getCompagnieAssurance(), contrat.getDateEffet()));
        return contratRepository.save(contrat);
    }

    private Contrat ensureNumeroDevis(Contrat contrat) {
        if (contrat == null
                || !Boolean.TRUE.equals(contrat.getProspection())
                || hasText(contrat.getNumeroDevis())) {
            return contrat;
        }
        contrat.setNumeroDevis(nextNumeroDevis(contrat.getAgence(), contrat.getCompagnieAssurance()));
        return contratRepository.save(contrat);
    }

    private synchronized String nextNumeroDossier(Agence agence, CompagnieAssurance compagnie, LocalDate dateEffet) {
        if (agence == null || agence.getId() == null) {
            throw new BadRequestException("L'agence est obligatoire pour generer le numero de dossier");
        }
        if (compagnie == null || compagnie.getId() == null || !hasText(compagnie.getCode())) {
            throw new BadRequestException("La compagnie est obligatoire pour generer le numero de dossier");
        }
        int annee = (dateEffet == null ? LocalDate.now() : dateEffet).getYear();
        NumeroDossierSequence sequence = resolveNumeroDossierSequence(agence, compagnie, annee);
        String prefixe = compagnie.getCode().trim().toUpperCase(Locale.ROOT);
        String numeroDossier;
        do {
            int numero = sequence.getProchainNumero() == null ? 1 : sequence.getProchainNumero();
            sequence.setProchainNumero(numero + 1);
            numeroDossier = prefixe + "/" + annee + "/" + String.format(Locale.ROOT, "%05d", numero);
        } while (contratRepository.existsByAgenceIdAndNumeroDossier(agence.getId(), numeroDossier));
        numeroDossierSequenceRepository.save(sequence);
        return numeroDossier;
    }

    private synchronized String nextNumeroDevis(Agence agence, CompagnieAssurance compagnie) {
        if (agence == null || agence.getId() == null) {
            throw new BadRequestException("L'agence est obligatoire pour generer le numero de devis");
        }
        if (compagnie == null || compagnie.getId() == null) {
            throw new BadRequestException("La compagnie est obligatoire pour generer le numero de devis");
        }
        LocalDate referenceDate = LocalDate.now();
        String prefixe = extractCompagniePrefix(compagnie) +
                String.format(Locale.ROOT, "%02d", referenceDate.getMonthValue()) +
                String.format(Locale.ROOT, "%02d", referenceDate.getYear() % 100);
        int previousNumber = contratRepository.findNumeroDevisByAgenceIdAndPrefix(agence.getId(), prefixe).stream()
                .map(String::trim)
                .map(String::toUpperCase)
                .filter(value -> value.startsWith(prefixe))
                .map(value -> value.substring(prefixe.length()))
                .filter(value -> value.matches("\\d+"))
                .mapToInt(Integer::parseInt)
                .max()
                .orElse(0);
        String numeroDevis;
        do {
            previousNumber++;
            numeroDevis = prefixe + String.format(Locale.ROOT, "%03d", previousNumber);
        } while (contratRepository.existsByAgenceIdAndNumeroDevis(agence.getId(), numeroDevis));
        return numeroDevis;
    }

    private String extractCompagniePrefix(CompagnieAssurance compagnie) {
        String label = compagnie == null ? null : compagnie.getNom();
        if (!hasText(label) && compagnie != null) {
            label = compagnie.getCode();
        }
        if (!hasText(label)) {
            return "XX";
        }
        String withoutAccents = Normalizer.normalize(label, Normalizer.Form.NFD)
                .replaceAll("\\p{M}", "");
        String lettersOnly = withoutAccents.replaceAll("[^A-Za-z]", "").toUpperCase(Locale.ROOT);
        if (lettersOnly.length() >= 2) {
            return lettersOnly.substring(0, 2);
        }
        if (lettersOnly.length() == 1) {
            return lettersOnly + "X";
        }
        return "XX";
    }

    private NumeroDossierSequence resolveNumeroDossierSequence(Agence agence, CompagnieAssurance compagnie, int annee) {
        return numeroDossierSequenceRepository
                .findByAgenceIdAndCompagnieAssuranceIdAndAnnee(agence.getId(), compagnie.getId(), annee)
                .orElseGet(() -> numeroDossierSequenceRepository.save(NumeroDossierSequence.builder()
                        .agence(agence)
                        .compagnieAssurance(compagnie)
                        .annee(annee)
                        .prochainNumero(1)
                        .build()));
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String blankToNull(String value) {
        return hasText(value) ? value.trim() : null;
    }

    private void validateContractReference(CreateContratRequest request) {
        if (request.getTypeContrat() == null) {
            throw new BadRequestException("Le type de contrat est obligatoire");
        }
        if (Boolean.TRUE.equals(request.getProspection())) {
            return;
        }
        if (!hasText(request.getNumeroPolice())) {
            throw new BadRequestException("Numero de police obligatoire");
        }
    }

    private void validateConventionReglement(CreateContratRequest request) {
        if (request.getTypeContrat() != TypeContrat.CONVENTION) {
            return;
        }
        if (!hasText(request.getModeReglement())) {
            throw new BadRequestException("Mode de reglement obligatoire");
        }
        if (!"facture".equalsIgnoreCase(request.getModeReglement())) {
            return;
        }
        if (!hasText(request.getNumeroBonCommande())) {
            throw new BadRequestException("Numero de bon de commande obligatoire");
        }
        if (request.getMontantBulletin() == null || request.getMontantBulletin().signum() <= 0) {
            throw new BadRequestException("Montant du bulletin obligatoire");
        }
    }

    private ModeSaisieGarantieContrat resolveModeSaisieGaranties(CreateContratRequest request) {
        if (request.getModeSaisieGaranties() != null) {
            return request.getModeSaisieGaranties();
        }
        if (request.getTypeContrat() == null) {
            throw new BadRequestException("Le type de contrat est obligatoire");
        }
        return switch (request.getTypeContrat()) {
            case PARTICULIER -> Boolean.TRUE.equals(request.getSaisiePrimeNette())
                    ? ModeSaisieGarantieContrat.MANUELLE_AVEC_PRIME_NETTE
                    : ModeSaisieGarantieContrat.MANUELLE;
            case CONVENTION, FLOTTE -> ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE;
        };
    }

    private void validateModeSaisiePourTypeContrat(
            CreateContratRequest request,
            ModeSaisieGarantieContrat modeSaisieGaranties,
            Convention convention
    ) {
        switch (request.getTypeContrat()) {
            case PARTICULIER -> {
                if (modeSaisieGaranties == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE) {
                    throw new BadRequestException("Un contrat particulier doit utiliser une saisie manuelle des garanties");
                }
            }
            case CONVENTION -> {
                if (convention == null) {
                    throw new BadRequestException("Une convention est obligatoire pour un contrat convention");
                }
                if (modeSaisieGaranties != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE) {
                    throw new BadRequestException("Un contrat convention doit utiliser la saisie automatique par grille");
                }
            }
            case FLOTTE -> {
                if (modeSaisieGaranties != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE) {
                    throw new BadRequestException("Un contrat flotte doit utiliser la saisie automatique par grille");
                }
            }
        }
    }

    private void validateGarantieTarget(Garantie garantie, Vehicule vehicule, Remorque remorque, Client client) {
        int targetCount = (vehicule == null ? 0 : 1) + (remorque == null ? 0 : 1) + (client == null ? 0 : 1);
        if (targetCount > 1) {
            throw new BadRequestException("Une garantie ne peut avoir qu'une seule cible");
        }
        if (garantie.getTypeGarantie() == TypeGarantie.PERSONNE && remorque != null) {
            throw new BadRequestException("Une garantie personne ne doit pas cibler une remorque");
        }
        if (garantie.getTypeGarantie() == TypeGarantie.VEHICULE && client != null) {
            throw new BadRequestException("Une garantie vehicule ne doit pas cibler un client");
        }
    }

    private Usage resolveUsageCible(Contrat contrat, Vehicule vehicule, Remorque remorque) {
        if (vehicule != null) {
            return vehicule.getUsage();
        }
        if (remorque != null) {
            return remorque.getUsage();
        }
        return contrat.getUsage();
    }

    private ModeTarificationGarantie resolveModeSelectionne(Garantie garantie, LigneGrilleTarifaire ligneGrilleTarifaire, CreateContratRequest.GarantieInput input) {
        ModeTarificationGarantie mode = parseMode(input.getModeSelectionne());
        if (mode != null) {
            return mode;
        }
        if (garantie.getTypeGarantie() == TypeGarantie.PERSONNE || input.getFormuleGarantiePersonneId() != null) {
            return ModeTarificationGarantie.PROTECTION;
        }
        if (ligneGrilleTarifaire != null && ligneGrilleTarifaire.getModeTarification() != null) {
            return ligneGrilleTarifaire.getModeTarification();
        }
        if (garantie.getModeParDefaut() != null) {
            return garantie.getModeParDefaut();
        }
        if (Boolean.TRUE.equals(garantie.getAvecCapital())) {
            return ModeTarificationGarantie.CAPITAL;
        }
        return ModeTarificationGarantie.TAUX;
    }

    private SourceValeurGarantie resolveSourceValeurSelectionnee(
            Garantie garantie,
            CreateContratRequest.GarantieInput input,
            ModeTarificationGarantie modeSelectionne,
            Remorque remorque
    ) {
        SourceValeurGarantie source = parseSource(input.getSourceValeurSelectionnee());
        if (source != null) {
            return source;
        }
        if (modeSelectionne == ModeTarificationGarantie.PROTECTION || garantie.getTypeGarantie() == TypeGarantie.PERSONNE) {
            return SourceValeurGarantie.AUCUNE;
        }
        if (input.getValeurVenale() != null) {
            return SourceValeurGarantie.VENALE;
        }
        if (input.getValeurNeuf() != null) {
            return SourceValeurGarantie.NEUF;
        }
        if (input.getValeurGlace() != null) {
            return SourceValeurGarantie.GLACE;
        }
        if (input.getValeurAssuree() != null || input.getCapital() != null) {
            return SourceValeurGarantie.MANUEL;
        }
        if (remorque != null && remorque.getValeurAssuree() != null) {
            return SourceValeurGarantie.MANUEL;
        }
        if (modeSelectionne == ModeTarificationGarantie.CAPITAL) {
            return SourceValeurGarantie.AUCUNE;
        }
        if (garantie.getSourceValeurParDefaut() != null) {
            return garantie.getSourceValeurParDefaut();
        }
        Set<SourceValeurGarantie> sources = allowedSources(garantie);
        if (sources.contains(SourceValeurGarantie.VENALE)) {
            return SourceValeurGarantie.VENALE;
        }
        if (sources.contains(SourceValeurGarantie.NEUF)) {
            return SourceValeurGarantie.NEUF;
        }
        if (sources.contains(SourceValeurGarantie.GLACE)) {
            return SourceValeurGarantie.GLACE;
        }
        if (sources.contains(SourceValeurGarantie.MANUEL)) {
            return SourceValeurGarantie.MANUEL;
        }
        return SourceValeurGarantie.AUCUNE;
    }

    private FormuleGarantiePersonne resolveFormuleGarantiePersonne(Long formuleId, Contrat contrat, Garantie garantie, Usage usageCible) {
        FormuleGarantiePersonne formule;
        if (garantie.getTypeGarantie() == TypeGarantie.PERSONNE
                && usageCible != null
                && !Boolean.TRUE.equals(usageCible.getGarantiesPersonne())) {
            throw new BadRequestException("L'usage " + usageCible.getCode() + " n'autorise pas les garanties personne");
        }
        if (formuleId == null) {
            if (contrat.getModeSaisieGaranties() != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE
                    || contrat.getGrilleTarifaire() == null
                    || garantie.getTypeGarantie() != TypeGarantie.PERSONNE) {
                return null;
            }
            formule = formuleGarantiePersonneRepository
                    .findByGrilleTarifaireIdAndGarantieIdAndActifTrueOrderByOrdreAffichageAscFormuleAsc(
                            contrat.getGrilleTarifaire().getId(),
                            garantie.getId()
                    )
                    .stream()
                    .filter(candidate -> candidate.getUsage() == null || (usageCible != null && candidate.getUsage().getId().equals(usageCible.getId())))
                    .findFirst()
                    .orElse(null);
            return formule;
        }
        formule = formuleGarantiePersonneRepository.findById(formuleId)
                .orElseThrow(() -> new ResourceNotFoundException("FormuleGarantiePersonne", formuleId));
        if (!formule.getGarantie().getId().equals(garantie.getId())) {
            throw new BadRequestException("La formule personne ne correspond pas a la garantie " + garantie.getCode());
        }
        if (contrat.getGrilleTarifaire() != null && !formule.getGrilleTarifaire().getId().equals(contrat.getGrilleTarifaire().getId())) {
            throw new BadRequestException("La formule personne ne correspond pas a la grille du contrat");
        }
        if (formule.getUsage() != null && usageCible != null && !formule.getUsage().getId().equals(usageCible.getId())) {
            throw new BadRequestException("La formule personne ne correspond pas a l'usage de la cible");
        }
        return formule;
    }

    private GarantieMontants resolveGarantieMontants(
            Contrat contrat,
            CreateContratRequest.GarantieInput input,
            Garantie garantie,
            LigneGrilleTarifaire ligneGrilleTarifaire,
            Vehicule vehicule,
            Remorque remorque,
            Usage usageCible,
            ModeTarificationGarantie modeSelectionne,
            SourceValeurGarantie sourceValeurSelectionnee,
            FormuleGarantiePersonne formuleGarantiePersonne
    ) {
        BigDecimal valeurVenale = firstNonNull(input.getValeurVenale(), vehicule != null ? vehicule.getValeurVenale() : null);
        BigDecimal valeurNeuf = firstNonNull(input.getValeurNeuf(), vehicule != null ? vehicule.getValeurNeuf() : null);
        BigDecimal valeurGlace = firstNonNull(input.getValeurGlace(), vehicule != null ? vehicule.getValeurGlace() : null);

        if (modeSelectionne == ModeTarificationGarantie.PROTECTION && formuleGarantiePersonne != null) {
            BigDecimal primeProtection = contrat.getModeSaisieGaranties() == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE
                    ? calculGarantieService.appliquerProrata(formuleGarantiePersonne.getPrimeNette(), calculGarantieService.resolveProrata(contrat, vehicule, remorque))
                    : Boolean.TRUE.equals(contrat.getSaisiePrimeNette())
                    ? firstNonNull(input.getPrime(), formuleGarantiePersonne.getPrimeNette())
                    : null;
            return new GarantieMontants(
                    valeurVenale,
                    valeurNeuf,
                    valeurGlace,
                    formuleGarantiePersonne.getFormule(),
                    formuleGarantiePersonne.getMontantDeces(),
                    formuleGarantiePersonne.getMontantInvalidite(),
                    formuleGarantiePersonne.getMontantFraisMedicaux(),
                    formuleGarantiePersonne.getMontantFraisHospitalisation(),
                    formuleGarantiePersonne.getMontantFraisFuneraires(),
                    formuleGarantiePersonne.getMontantFraisChirurgie(),
                    formuleGarantiePersonne.getAccessoire(),
                    null,
                    null,
                    primeProtection,
                    null,
                    null
            );
        }

        BigDecimal capital = resolveCapital(input, garantie, ligneGrilleTarifaire, vehicule, remorque, usageCible, modeSelectionne, sourceValeurSelectionnee, valeurVenale, valeurNeuf, valeurGlace);
        BigDecimal taux = Boolean.TRUE.equals(garantie.getResponsabiliteCivile())
                ? firstNonNull(input.getTaux(), calculGarantieService.resolveMultiplicateurRc(contrat, usageCible))
                : firstNonNull(input.getTaux(), calculGarantieService.resolveTauxLigne(ligneGrilleTarifaire, remorque != null));
        BigDecimal tauxFranchise = firstNonNull(input.getTauxFranchise(), calculGarantieService.resolveTauxFranchiseLigne(ligneGrilleTarifaire, remorque != null));
        BigDecimal franchiseMinimale = firstNonNull(input.getFranchiseMinimale(), calculGarantieService.resolveFranchiseMinimaleLigne(ligneGrilleTarifaire, remorque != null));
        BigDecimal prime = resolvePrime(contrat, garantie, input, ligneGrilleTarifaire, vehicule, remorque, modeSelectionne, capital, taux);

        return new GarantieMontants(
                valeurVenale,
                valeurNeuf,
                valeurGlace,
                input.getFormule(),
                input.getMontantDeces(),
                input.getMontantInvalidite(),
                input.getMontantFraisMedicaux(),
                input.getMontantFraisHospitalisation(),
                input.getMontantFraisFuneraires(),
                input.getMontantFraisChirurgie(),
                input.getAccessoire(),
                capital,
                taux,
                prime,
                tauxFranchise,
                franchiseMinimale
        );
    }

    private BigDecimal resolveCapital(
            CreateContratRequest.GarantieInput input,
            Garantie garantie,
            LigneGrilleTarifaire ligneGrilleTarifaire,
            Vehicule vehicule,
            Remorque remorque,
            Usage usageCible,
            ModeTarificationGarantie modeSelectionne,
            SourceValeurGarantie sourceValeurSelectionnee,
            BigDecimal valeurVenale,
            BigDecimal valeurNeuf,
            BigDecimal valeurGlace
    ) {
        if (Boolean.TRUE.equals(garantie.getResponsabiliteCivile())) {
            return calculGarantieService.resolveCapitalResponsabiliteCivile(usageCible);
        }
        if (modeSelectionne == ModeTarificationGarantie.CAPITAL && ligneGrilleTarifaire != null && ligneGrilleTarifaire.getCapital() != null) {
            return ligneGrilleTarifaire.getCapital();
        }
        BigDecimal valeurDirecte = firstNonNull(input.getValeurAssuree(), input.getCapital());
        if (valeurDirecte != null) {
            return valeurDirecte;
        }
        if (sourceValeurSelectionnee == SourceValeurGarantie.VENALE) {
            return valeurVenale;
        }
        if (sourceValeurSelectionnee == SourceValeurGarantie.NEUF) {
            return valeurNeuf;
        }
        if (sourceValeurSelectionnee == SourceValeurGarantie.GLACE) {
            return valeurGlace;
        }
        if (remorque != null && remorque.getValeurAssuree() != null) {
            return remorque.getValeurAssuree();
        }
        if (ligneGrilleTarifaire != null) {
            return ligneGrilleTarifaire.getCapital();
        }
        return vehicule != null ? firstNonNull(vehicule.getValeurVenale(), vehicule.getValeurNeuf(), vehicule.getValeurGlace()) : null;
    }

    private BigDecimal resolvePrime(
            Contrat contrat,
            Garantie garantie,
            CreateContratRequest.GarantieInput input,
            LigneGrilleTarifaire ligneGrilleTarifaire,
            Vehicule vehicule,
            Remorque remorque,
            ModeTarificationGarantie modeSelectionne,
            BigDecimal capital,
            BigDecimal taux
    ) {
        if (Boolean.TRUE.equals(garantie.getResponsabiliteCivile())) {
            BigDecimal primeRc = calculGarantieService.calculerPrimeResponsabiliteCivile(contrat, vehicule, remorque);
            if (primeRc == null) {
                throw new BadRequestException("Tarif RC manquant pour la cible " + garantie.getCode());
            }
            return primeRc;
        }
        if (contrat.getModeSaisieGaranties() != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE) {
            if (Boolean.TRUE.equals(contrat.getSaisiePrimeNette())) {
                return input.getPrime();
            }
            if (capital != null && taux != null) {
                BigDecimal primeAnnuelle = capital.multiply(taux).divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP);
                BigDecimal prorata = calculGarantieService.resolveProrata(contrat, vehicule, remorque);
                return scale(primeAnnuelle.multiply(prorata));
            }
            return null;
        }
        return calculGarantieService.calculerPrimeLigne(
                ligneGrilleTarifaire,
                modeSelectionne,
                capital,
                calculGarantieService.resolveProrata(contrat, vehicule, remorque),
                remorque != null
        );
    }

    private void validateGarantieConfiguration(
            Contrat contrat,
            Garantie garantie,
            CreateContratRequest.GarantieInput input,
            ModeTarificationGarantie modeSelectionne,
            SourceValeurGarantie sourceValeurSelectionnee,
            FormuleGarantiePersonne formuleGarantiePersonne,
            LigneGrilleTarifaire ligneGrilleTarifaire,
            GarantieMontants montants
    ) {
        if (contrat.getModeSaisieGaranties() == ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE) {
            if (garantie.getTypeGarantie() == TypeGarantie.PERSONNE && formuleGarantiePersonne == null) {
                throw new BadRequestException("La garantie personne " + garantie.getCode() + " exige une formule de grille");
            }
            if (garantie.getTypeGarantie() == TypeGarantie.VEHICULE
                    && !Boolean.TRUE.equals(garantie.getResponsabiliteCivile())
                    && ligneGrilleTarifaire == null) {
                throw new BadRequestException("La garantie " + garantie.getCode() + " exige une ligne de grille tarifaire");
            }
        }

        Set<ModeTarificationGarantie> modes = allowedModes(garantie);
        if (!modes.isEmpty() && !modes.contains(modeSelectionne)) {
            throw new BadRequestException("Le mode " + modeSelectionne + " n'est pas autorise pour la garantie " + garantie.getCode());
        }

        Set<SourceValeurGarantie> sources = allowedSources(garantie);
        boolean contratManuel = contrat.getModeSaisieGaranties() != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE;
        boolean saisiePrimeNette = Boolean.TRUE.equals(contrat.getSaisiePrimeNette());
        if (contratManuel && saisiePrimeNette && montants.prime() == null) {
            throw new BadRequestException("La prime nette est obligatoire pour la garantie " + garantie.getCode());
        }
        boolean saisieManuelleContrat = contratManuel && sourceValeurSelectionnee == SourceValeurGarantie.MANUEL;
        if (sourceValeurSelectionnee != SourceValeurGarantie.AUCUNE && !sources.contains(sourceValeurSelectionnee) && !saisieManuelleContrat) {
            throw new BadRequestException("La source " + sourceValeurSelectionnee + " n'est pas autorisee pour la garantie " + garantie.getCode());
        }
        if (sourceValeurSelectionnee == SourceValeurGarantie.MANUEL && !Boolean.TRUE.equals(garantie.getSaisieManuelleAutorisee()) && !contratManuel) {
            throw new BadRequestException("La saisie manuelle n'est pas autorisee pour la garantie " + garantie.getCode());
        }

        if (garantie.getTypeGarantie() == TypeGarantie.PERSONNE) {
            if (modeSelectionne != ModeTarificationGarantie.PROTECTION) {
                throw new BadRequestException("La garantie personne " + garantie.getCode() + " doit utiliser le mode PROTECTION");
            }
            if (contratManuel && !saisiePrimeNette) {
                throw new BadRequestException("La garantie personne " + garantie.getCode() + " exige une saisie avec prime nette");
            }
            return;
        }

        if (formuleGarantiePersonne != null) {
            throw new BadRequestException("Une garantie vehicule ne doit pas utiliser une formule personne");
        }
        if (sourceValeurSelectionnee == SourceValeurGarantie.VENALE && montants.valeurVenale() == null) {
            throw new BadRequestException("La garantie " + garantie.getCode() + " exige une valeur venale");
        }
        if (sourceValeurSelectionnee == SourceValeurGarantie.NEUF && montants.valeurNeuf() == null) {
            throw new BadRequestException("La garantie " + garantie.getCode() + " exige une valeur a neuf");
        }
        if (sourceValeurSelectionnee == SourceValeurGarantie.GLACE && montants.valeurGlace() == null) {
            throw new BadRequestException("La garantie " + garantie.getCode() + " exige une valeur glace");
        }
        if (contratManuel
                && !saisiePrimeNette
                && !Boolean.TRUE.equals(garantie.getResponsabiliteCivile())
                && (montants.capital() == null || montants.taux() == null)) {
            throw new BadRequestException("La garantie " + garantie.getCode() + " exige un capital et un taux");
        }
        if (Boolean.TRUE.equals(garantie.getAvecCapital()) && montants.capital() == null) {
            throw new BadRequestException("La garantie " + garantie.getCode() + " exige un capital ou une valeur assuree");
        }
    }

    private void validateLigneGrilleTarifaire(
            Contrat contrat,
            Garantie garantie,
            LigneGrilleTarifaire ligneGrilleTarifaire,
            ModeTarificationGarantie modeSelectionne,
            Usage usageCible,
            Vehicule vehicule
    ) {
        if (ligneGrilleTarifaire == null) {
            return;
        }
        if (!ligneGrilleTarifaire.getGarantie().getId().equals(garantie.getId())) {
            throw new BadRequestException("La ligne de grille tarifaire ne correspond pas a la garantie " + garantie.getCode());
        }
        if (contrat.getGrilleTarifaire() != null && !ligneGrilleTarifaire.getGrilleTarifaire().getId().equals(contrat.getGrilleTarifaire().getId())) {
            throw new BadRequestException("La ligne de grille tarifaire ne correspond pas a la grille du contrat");
        }
        if (ligneGrilleTarifaire.getModeTarification() != null && ligneGrilleTarifaire.getModeTarification() != modeSelectionne) {
            throw new BadRequestException("La ligne de grille tarifaire ne correspond pas au mode " + modeSelectionne);
        }
        if (ligneGrilleTarifaire.getUsage() != null && usageCible != null && !ligneGrilleTarifaire.getUsage().getId().equals(usageCible.getId())) {
            throw new BadRequestException("La ligne de grille tarifaire ne correspond pas a l'usage de la cible");
        }
        if (ligneGrilleTarifaire.getCategorieTransport() != null) {
            if (vehicule == null || vehicule.getCategorieTransport() == null
                    || !ligneGrilleTarifaire.getCategorieTransport().getId().equals(vehicule.getCategorieTransport().getId())) {
                throw new BadRequestException("La ligne de grille tarifaire ne correspond pas a la categorie transport du vehicule");
            }
        }
    }

    private LigneGrilleTarifaire resolveLigneGrilleTarifaire(
            Contrat contrat,
            Garantie garantie,
            CreateContratRequest.GarantieInput input,
            Usage usageCible,
            Vehicule vehicule,
            Remorque remorque
    ) {
        if (input.getLigneGrilleTarifaireId() != null) {
            return ligneGrilleTarifaireRepository.findById(input.getLigneGrilleTarifaireId())
                    .orElseThrow(() -> new ResourceNotFoundException("LigneGrilleTarifaire", input.getLigneGrilleTarifaireId()));
        }
        if (contrat.getModeSaisieGaranties() != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE
                || contrat.getGrilleTarifaire() == null
                || Boolean.TRUE.equals(garantie.getResponsabiliteCivile())
                || garantie.getTypeGarantie() == TypeGarantie.PERSONNE) {
            return null;
        }

        ModeTarificationGarantie requestedMode = parseMode(input.getModeSelectionne());
        return ligneGrilleTarifaireRepository.findByGrilleTarifaireIdAndActifTrue(contrat.getGrilleTarifaire().getId()).stream()
                .filter(ligne -> ligne.getGarantie() != null && ligne.getGarantie().getId().equals(garantie.getId()))
                .filter(ligne -> requestedMode == null || ligne.getModeTarification() == null || ligne.getModeTarification() == requestedMode)
                .filter(ligne -> ligne.getUsage() == null || (usageCible != null && ligne.getUsage().getId().equals(usageCible.getId())))
                .filter(ligne -> ligne.getCategorieTransport() == null
                        || (vehicule != null
                        && vehicule.getCategorieTransport() != null
                        && ligne.getCategorieTransport().getId().equals(vehicule.getCategorieTransport().getId())))
                .filter(ligne -> matchesLigneConstraints(ligne, vehicule, remorque))
                .max(Comparator.comparingInt(ligne -> ligneSpecificity(ligne, usageCible, vehicule, remorque)))
                .orElse(null);
    }

    private int ligneSpecificity(LigneGrilleTarifaire ligne, Usage usageCible, Vehicule vehicule, Remorque remorque) {
        int score = 0;
        if (ligne.getUsage() != null && usageCible != null && ligne.getUsage().getId().equals(usageCible.getId())) {
            score += 10;
        }
        if (ligne.getCategorieTransport() != null
                && vehicule != null
                && vehicule.getCategorieTransport() != null
                && ligne.getCategorieTransport().getId().equals(vehicule.getCategorieTransport().getId())) {
            score += 5;
        }
        if (ligne.getModeTarification() != null) {
            score += 1;
        }
        if (matchesText(ligne.getSousClasse(), vehicule != null ? vehicule.getSousClasse() : null)) {
            score += 1;
        }
        if (matchesText(ligne.getCarburant(), vehicule != null ? vehicule.getCarburant() : null)) {
            score += 1;
        }
        return score;
    }

    private boolean matchesLigneConstraints(LigneGrilleTarifaire ligne, Vehicule vehicule, Remorque remorque) {
        if (vehicule != null) {
            return inRange(parseDecimal(vehicule.getPuissanceFiscale()), ligne.getPuissanceFiscaleMin(), ligne.getPuissanceFiscaleMax())
                    && inRange(parseDecimal(vehicule.getNombrePlaces()), ligne.getNombrePlacesMin(), ligne.getNombrePlacesMax())
                    && inRange(parseDecimal(vehicule.getPtc()), ligne.getPtcMin(), ligne.getPtcMax())
                    && matchesText(ligne.getSousClasse(), vehicule.getSousClasse())
                    && matchesText(ligne.getCarburant(), vehicule.getCarburant());
        }
        if (remorque != null) {
            return inRange(parseDecimal(remorque.getPtc()), ligne.getPtcMin(), ligne.getPtcMax())
                    && ligne.getPuissanceFiscaleMin() == null
                    && ligne.getPuissanceFiscaleMax() == null
                    && ligne.getNombrePlacesMin() == null
                    && ligne.getNombrePlacesMax() == null
                    && !hasText(ligne.getSousClasse())
                    && !hasText(ligne.getCarburant());
        }
        return ligne.getPuissanceFiscaleMin() == null
                && ligne.getPuissanceFiscaleMax() == null
                && ligne.getNombrePlacesMin() == null
                && ligne.getNombrePlacesMax() == null
                && ligne.getPtcMin() == null
                && ligne.getPtcMax() == null
                && !hasText(ligne.getSousClasse())
                && !hasText(ligne.getCarburant());
    }

    private boolean inRange(BigDecimal value, BigDecimal min, BigDecimal max) {
        if (min == null && max == null) {
            return true;
        }
        if (value == null) {
            return false;
        }
        return (min == null || value.compareTo(min) >= 0) && (max == null || value.compareTo(max) <= 0);
    }

    private boolean matchesText(String expected, String actual) {
        return !hasText(expected) || (hasText(actual) && expected.trim().equalsIgnoreCase(actual.trim()));
    }

    private BigDecimal parseDecimal(String value) {
        if (!hasText(value)) {
            return null;
        }
        try {
            return new BigDecimal(value.trim().replace(',', '.'));
        } catch (NumberFormatException exception) {
            return null;
        }
    }

    private ModeTarificationGarantie parseMode(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().replace("-", "_").replace(" ", "_").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "RATE", "TAUX" -> ModeTarificationGarantie.TAUX;
            case "CAPITAL" -> ModeTarificationGarantie.CAPITAL;
            case "PROTECTION" -> ModeTarificationGarantie.PROTECTION;
            case "PRIME", "PRIME_FIXE", "FIXE" -> ModeTarificationGarantie.PRIME_FIXE;
            default -> throw new BadRequestException("Mode de tarification inconnu: " + raw);
        };
    }

    private SourceValeurGarantie parseSource(String raw) {
        if (raw == null || raw.isBlank()) {
            return null;
        }
        String normalized = raw.trim().replace("-", "_").replace(" ", "_").toUpperCase(Locale.ROOT);
        return switch (normalized) {
            case "AUCUNE", "NONE" -> SourceValeurGarantie.AUCUNE;
            case "VENALE", "VENAL", "VALEUR_VENALE" -> SourceValeurGarantie.VENALE;
            case "NEUF", "VALEUR_NEUF", "VALEUR_A_NEUF" -> SourceValeurGarantie.NEUF;
            case "GLACE", "BRIS_GLACE", "VALEUR_GLACE" -> SourceValeurGarantie.GLACE;
            case "MANUEL", "MANUAL", "SAISIE_MANUELLE" -> SourceValeurGarantie.MANUEL;
            default -> throw new BadRequestException("Source de valeur inconnue: " + raw);
        };
    }

    private Set<ModeTarificationGarantie> allowedModes(Garantie garantie) {
        Set<ModeTarificationGarantie> modes = new LinkedHashSet<>();
        if (garantie.getModesAutorises() != null) {
            modes.addAll(garantie.getModesAutorises());
        }
        if (modes.isEmpty()) {
            if (garantie.getTypeGarantie() == TypeGarantie.PERSONNE) {
                modes.add(ModeTarificationGarantie.PROTECTION);
            } else if (Boolean.TRUE.equals(garantie.getAvecCapital())) {
                modes.add(ModeTarificationGarantie.CAPITAL);
            } else {
                modes.add(ModeTarificationGarantie.TAUX);
            }
        }
        return modes;
    }

    private Set<SourceValeurGarantie> allowedSources(Garantie garantie) {
        Set<SourceValeurGarantie> sources = new LinkedHashSet<>();
        if (garantie.getSourcesValeurAutorisees() != null) {
            sources.addAll(garantie.getSourcesValeurAutorisees());
        }
        if (Boolean.TRUE.equals(garantie.getRequiertValeurVenale())) {
            sources.add(SourceValeurGarantie.VENALE);
        }
        if (Boolean.TRUE.equals(garantie.getRequiertValeurNeuf())) {
            sources.add(SourceValeurGarantie.NEUF);
        }
        if (Boolean.TRUE.equals(garantie.getRequiertValeurGlace())) {
            sources.add(SourceValeurGarantie.GLACE);
        }
        if (Boolean.TRUE.equals(garantie.getSaisieManuelleAutorisee()) || Boolean.TRUE.equals(garantie.getAvecCapital())) {
            sources.add(SourceValeurGarantie.MANUEL);
        }
        return sources;
    }

    private ContractDates resolveContractDates(CreateContratRequest request) {
        String normalizedEcheance = echeanceService.normalizeCode(request.getEcheance());
        LocalDate dateEcheance = normalizedEcheance == null
                ? request.getDateEcheance()
                : echeanceService.resolveDateEcheance(request.getDateEffet(), normalizedEcheance, request.getDateEcheance());
        return new ContractDates(request.getDateEffet(), dateEcheance, normalizedEcheance);
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

    private List<Vehicule> activeVehiculesForView(Contrat contrat) {
        if (contrat.getId() == null) {
            return (contrat.getVehicules() == null ? List.<Vehicule>of() : contrat.getVehicules()).stream()
                    .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                    .toList();
        }
        List<Vehicule> active = activeVehicules(contrat);
        return active.isEmpty() ? vehiculeRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId()) : active;
    }

    private List<Remorque> activeRemorquesForView(Contrat contrat) {
        if (contrat.getId() == null) {
            return (contrat.getRemorques() == null ? List.<Remorque>of() : contrat.getRemorques()).stream()
                    .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                    .toList();
        }
        List<Remorque> active = activeRemorques(contrat);
        return active.isEmpty() ? remorqueRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId()) : active;
    }

    private List<ContratGarantie> activeGarantiesForView(Contrat contrat) {
        if (contrat.getId() == null) {
            return (contrat.getGaranties() == null ? List.<ContratGarantie>of() : contrat.getGaranties()).stream()
                    .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                    .toList();
        }
        List<ContratGarantie> active = activeGaranties(contrat);
        return active.isEmpty() ? contratGarantieRepository.findByContratIdOrderByCreatedAtAsc(contrat.getId()) : active;
    }

    private record GarantieMontants(
            BigDecimal valeurVenale,
            BigDecimal valeurNeuf,
            BigDecimal valeurGlace,
            String formule,
            BigDecimal montantDeces,
            BigDecimal montantInvalidite,
            BigDecimal montantFraisMedicaux,
            BigDecimal montantFraisHospitalisation,
            BigDecimal montantFraisFuneraires,
            BigDecimal montantFraisChirurgie,
            BigDecimal accessoire,
            BigDecimal capital,
            BigDecimal taux,
            BigDecimal prime,
            BigDecimal tauxFranchise,
            BigDecimal franchiseMinimale
    ) {
    }

    private record ContractDates(
            java.time.LocalDate dateEffet,
            java.time.LocalDate dateEcheance,
            String echeance
    ) {
    }

    private record PersistedDraftGraph(
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties,
            List<AssistanceContrat> assistances,
            QuittanceCalculService.Resultat quittanceManuelle
    ) {
    }

    private record DraftAssistanceSnapshot(
            int vehiculeIndex,
            CompagnieAssurance compagnieAssuranceContrat,
            CompagnieAssistance compagnieAssistance,
            ProduitAssistance produitAssistance,
            TarifProduitAssistance tarifProduitAssistance,
            String produit,
            LocalDate dateSouscription,
            LocalDate dateEffet,
            LocalDate dateEcheance,
            String echeanceCode,
            Integer duree,
            String unite,
            String numeroContratOuQuittance,
            String typeQuittance,
            BigDecimal primeNette,
            BigDecimal primeTotale
    ) {
    }

    private record AvenantGraph(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties,
            NatureSnapshotMouvement snapshotNature
    ) {
    }

    private record AvenantModificationGraph(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> anciennesGaranties,
            List<ContratGarantie> nouvellesGaranties,
            QuittanceCalculService.Resultat differentiel,
            List<ContratGarantie> garantiesDifferentielles
    ) {
    }

    private record AvenantTargets(
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties
    ) {
    }

    private record SelectionIds(
            List<Long> vehiculeIds,
            List<Long> remorqueIds
    ) {
    }
}
