package com.assurance.service;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.request.ConvertirProspectionRequest;
import com.assurance.dto.response.ContratResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.entity.*;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeGarantie;
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
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;

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
    private final ClientService clientService;
    private final CalculGarantieService calculGarantieService;
    private final QuittanceCalculService quittanceCalculService;
    private final MouvementContratService mouvementContratService;
    private final EcheanceService echeanceService;

    @Transactional
    public ContratResponse create(CreateContratRequest request) {
        return createContrat(request, null);
    }

    @Transactional
    public ContratResponse renouveler(Long agenceId, Long contratOrigineId, CreateContratRequest request) {
        Contrat contratOrigine = contratRepository.findByAgenceIdAndId(agenceId, contratOrigineId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratOrigineId));
        if (Boolean.TRUE.equals(contratOrigine.getRenouvele())) {
            throw new BadRequestException("Le contrat est deja renouvele");
        }
        if (request.getAgenceId() == null) {
            request.setAgenceId(agenceId);
        }
        if (!agenceId.equals(request.getAgenceId())) {
            throw new BadRequestException("L'agence du renouvellement ne correspond pas au contrat origine");
        }
        ContratResponse response = createContrat(request, contratOrigine);
        contratOrigine.setRenouvele(true);
        contratOrigine.setStatut(StatutContrat.RENEWED);
        contratRepository.save(contratOrigine);
        return response;
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
        Contrat contrat = resolveDraft(agenceId, contratId);
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse updateDraft(Long agenceId, Long contratId, CreateContratRequest request) {
        Contrat contrat = resolveDraft(agenceId, contratId);
        request.setAgenceId(agenceId);
        applyDraftRequest(contrat, request);
        return toResponse(contrat);
    }

    @Transactional
    public ContratResponse finalizeDraft(Long agenceId, Long contratId, CreateContratRequest request) {
        Contrat contrat = resolveDraft(agenceId, contratId);
        request.setAgenceId(agenceId);
        if (hasText(request.getNumeroContrat())
                && contratRepository.existsByAgenceIdAndNumeroContratAndIdNot(agenceId, request.getNumeroContrat(), contrat.getId())) {
            throw new BadRequestException("Numero de contrat deja utilise pour cette agence");
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
        if (!prospection) {
            mouvementContratService.creerAffaireNouvelle(
                    contrat,
                    graph.vehicules(),
                    graph.remorques(),
                    graph.garanties(),
                    graph.quittanceManuelle()
            );
        }
        return toResponse(contrat);
    }

    private ContratResponse createContrat(CreateContratRequest request, Contrat contratOrigine) {
        validateContractReference(request);
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
                .contratOrigine(contratOrigine)
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
        if (contratOrigine == null) {
            if (!Boolean.TRUE.equals(contrat.getProspection())) {
                mouvementContratService.creerAffaireNouvelle(contrat, vehiculesCrees, remorquesCreees, garantiesCreees, quittanceManuelle);
            }
        } else {
            mouvementContratService.creerRenouvellement(contrat, contratOrigine, vehiculesCrees, remorquesCreees, garantiesCreees);
        }

        return toResponse(contrat);
    }

    private Contrat resolveDraft(Long agenceId, Long contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (!Boolean.TRUE.equals(contrat.getBrouillon()) || contrat.getStatut() != StatutContrat.DRAFT) {
            throw new BadRequestException("Ce contrat n'est pas un brouillon modifiable");
        }
        return contrat;
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
        contrat.setModePaiement(blankToNull(request.getModePaiement()));
        contrat.setModeReglement(blankToNull(request.getModeReglement()));
        contrat.setNumeroBonCommande(blankToNull(request.getNumeroBonCommande()));
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
        clearDraftChildren(contrat);

        saveClientLinks(contrat, request.getClients(), request.getAgenceId(), existingClients, finalMode);

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
        return new PersistedDraftGraph(vehiculesCrees, remorquesCreees, garantiesCreees, buildManualQuittanceResult(request));
    }

    private void clearDraftChildren(Contrat contrat) {
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
        return contratRepository.findByAgenceIdAndProspectionFalseOrderByCreatedAtDesc(agenceId).stream()
                .map(this::ensureNumeroDossier)
                .map(this::toResponse)
                .toList();
    }

    @Transactional
    public List<ContratResponse> listProspections(Long agenceId) {
        return contratRepository.findByAgenceIdAndProspectionTrueAndTypeContratOrderByCreatedAtDesc(agenceId, TypeContrat.FLOTTE).stream()
                .map(this::ensureNumeroDevis)
                .map(this::ensureNumeroDossier)
                .map(this::toResponse)
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
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        return toResponse(ensureNumeroDossier(ensureNumeroDevis(contrat)));
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

        int unitesCnpac = Math.max(1, vehicules.size() + remorques.size());
        QuittanceCalculService.Resultat calcul = buildManualQuittanceResult(request);
        if (calcul == null) {
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
                .lignes(calcul.lignes().stream().map(this::toLignePreviewResponse).toList())
                .garanties(garanties.stream().map(garantie -> toGarantiePreviewResponse(garantie, vehicules, remorques)).toList())
                .targetSummaries(buildTargetSummaries(contrat, garanties, vehicules, remorques))
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

        List<ContratResponse.VehiculeView> vehicules = new ArrayList<>();
        for (Vehicule vehicule : contrat.getVehicules()) {
            vehicules.add(ContratResponse.VehiculeView.builder()
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
                    .build());
        }

        List<ContratResponse.RemorqueView> remorques = new ArrayList<>();
        for (Remorque remorque : contrat.getRemorques()) {
            remorques.add(ContratResponse.RemorqueView.builder()
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
                    .build());
        }

        List<ContratResponse.GarantieView> garanties = new ArrayList<>();
        for (ContratGarantie contratGarantie : contrat.getGaranties()) {
            garanties.add(ContratResponse.GarantieView.builder()
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
                    .build());
        }

        List<ContratResponse.MouvementView> mouvements = new ArrayList<>();
        for (MouvementContrat mouvement : contrat.getMouvements()) {
            mouvements.add(ContratResponse.MouvementView.builder()
                    .id(mouvement.getId())
                    .code(mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getCode() : null)
                    .libelle(mouvement.getTypeMouvement() != null ? mouvement.getTypeMouvement().getLibelle() : null)
                    .categorie(mouvement.getTypeMouvement() != null && mouvement.getTypeMouvement().getCategorie() != null ? mouvement.getTypeMouvement().getCategorie().name() : null)
                    .statut(mouvement.getStatut() != null ? mouvement.getStatut().name() : null)
                    .numeroMouvement(mouvement.getNumeroMouvement())
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
                .periodicite(contrat.getPeriodicite())
                .fractionnement(contrat.getFractionnement())
                .tauxRc(contrat.getTauxRc())
                .modeSaisieGaranties(contrat.getModeSaisieGaranties())
                .saisiePrimeNette(contrat.getSaisiePrimeNette())
                .nombreVehicules(contrat.getNombreVehicules())
                .nombreRemorques(contrat.getNombreRemorques())
                .prospection(contrat.getProspection())
                .assistance(contrat.getAssistance())
                .crmPartage(contrat.getCrmPartage())
                .crmPartageValeur(contrat.getCrmPartageValeur())
                .clients(clients)
                .vehicules(vehicules)
                .remorques(remorques)
                .garanties(garanties)
                .mouvements(mouvements)
                .elementsFacturables(elementsFacturables)
                .build();
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

    private QuittanceResponse.Ligne toLignePreviewResponse(QuittanceCalculService.Ligne ligne) {
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

    private List<QuittanceResponse.TargetSummary> buildTargetSummaries(
            Contrat contrat,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        List<QuittanceResponse.TargetSummary> summaries = new ArrayList<>();
        for (int index = 0; index < vehicules.size(); index++) {
            Vehicule vehicule = vehicules.get(index);
            List<ContratGarantie> targetGaranties = garanties.stream()
                    .filter(garantie -> garantie.getVehicule() == vehicule)
                    .toList();
            if (!targetGaranties.isEmpty()) {
                boolean hasRc = hasRcGarantie(targetGaranties);
                summaries.add(toTargetSummary("VEHICULE", index, null, calculerTargetSummary(contrat, targetGaranties), hasRc));
            }
        }
        for (int index = 0; index < remorques.size(); index++) {
            Remorque remorque = remorques.get(index);
            List<ContratGarantie> targetGaranties = garanties.stream()
                    .filter(garantie -> garantie.getRemorque() == remorque)
                    .toList();
            if (!targetGaranties.isEmpty()) {
                boolean hasRc = hasRcGarantie(targetGaranties);
                summaries.add(toTargetSummary("REMORQUE", null, index, calculerTargetSummary(contrat, targetGaranties), hasRc));
            }
        }
        return summaries;
    }

    private QuittanceCalculService.Resultat calculerTargetSummary(Contrat contrat, List<ContratGarantie> garanties) {
        int unitesCnpac = hasRcGarantie(garanties) ? 1 : 0;
        return quittanceCalculService.calculer(contrat, null, garanties, unitesCnpac);
    }

    private QuittanceResponse.TargetSummary toTargetSummary(
            String kind,
            Integer vehiculeIndex,
            Integer remorqueIndex,
            QuittanceCalculService.Resultat calcul,
            boolean hasRc
    ) {
        QuittanceCalculService.Ligne automobile = ligne(calcul, CategorieQuittance.AUTOMOBILE);
        QuittanceCalculService.Ligne corporel = ligne(calcul, CategorieQuittance.CORPOREL);
        QuittanceCalculService.Ligne evcat = ligne(calcul, CategorieQuittance.EVCAT);
        BigDecimal evcatPrimeNette = value(evcat == null ? null : evcat.primeNette());
        return QuittanceResponse.TargetSummary.builder()
                .kind(kind)
                .vehiculeIndex(vehiculeIndex)
                .remorqueIndex(remorqueIndex)
                .primeNette(calcul.primeNette())
                .primeNetteHorsEvcat(scale(calcul.primeNette().subtract(evcatPrimeNette)))
                .automobilePrimeNette(value(automobile == null ? null : automobile.primeNette()))
                .corporelPrimeNette(value(corporel == null ? null : corporel.primeNette()))
                .evcatPrimeNette(evcatPrimeNette)
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(hasRc ? calcul.cnpac() : BigDecimal.ZERO)
                .primeTotale(hasRc ? calcul.primeTotale() : scale(calcul.primeTotale().subtract(calcul.cnpac())))
                .build();
    }

    private QuittanceCalculService.Ligne ligne(QuittanceCalculService.Resultat calcul, CategorieQuittance categorie) {
        return calcul.lignes().stream()
                .filter(ligne -> ligne.categorie() == categorie)
                .findFirst()
                .orElse(null);
    }

    private boolean hasRcGarantie(List<ContratGarantie> garanties) {
        return garanties.stream().anyMatch(garantie -> {
            if (garantie.getGarantie() == null) {
                return false;
            }
            String code = garantie.getGarantie().getCode() == null ? "" : garantie.getGarantie().getCode().trim().toUpperCase(Locale.ROOT);
            return Boolean.TRUE.equals(garantie.getGarantie().getResponsabiliteCivile()) || "RC".equals(code);
        });
    }

    private BigDecimal value(BigDecimal value) {
        return value == null ? BigDecimal.ZERO : value;
    }

    private QuittanceResponse.GarantieLigne toGarantiePreviewResponse(
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
        if (request.getTypeContrat() == TypeContrat.FLOTTE) {
            if (!hasText(request.getNumeroPolice())) {
                throw new BadRequestException("Numero de police obligatoire pour un contrat flotte");
            }
            return;
        }
        if (!hasText(request.getNumeroContrat())) {
            throw new BadRequestException("Numero de contrat obligatoire");
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
        BigDecimal prime = resolvePrime(contrat, garantie, input, ligneGrilleTarifaire, vehicule, remorque, modeSelectionne, capital);

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
            BigDecimal capital
    ) {
        if (contrat.getModeSaisieGaranties() != ModeSaisieGarantieContrat.AUTOMATIQUE_GRILLE) {
            return Boolean.TRUE.equals(contrat.getSaisiePrimeNette()) ? input.getPrime() : null;
        }
        if (Boolean.TRUE.equals(garantie.getResponsabiliteCivile())) {
            BigDecimal primeRc = calculGarantieService.calculerPrimeResponsabiliteCivile(contrat, vehicule, remorque);
            if (primeRc == null) {
                throw new BadRequestException("Tarif RC manquant pour la cible " + garantie.getCode());
            }
            return primeRc;
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
            QuittanceCalculService.Resultat quittanceManuelle
    ) {
    }
}
