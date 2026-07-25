package com.assurance.service;

import com.assurance.dto.request.CreateContratRequest;
import com.assurance.dto.response.ContratResponse;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.entity.*;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.ModeSaisieGarantieContrat;
import com.assurance.enums.ModeTarificationGarantie;
import com.assurance.enums.SourceValeurGarantie;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.TypeGarantie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class ContratService {

    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final ConventionRepository conventionRepository;
    private final ClientRepository clientRepository;
    private final ContratRepository contratRepository;
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
    private final ClientService clientService;
    private final CalculGarantieService calculGarantieService;
    private final QuittanceCalculService quittanceCalculService;
    private final MouvementContratService mouvementContratService;

    @Transactional
    public ContratResponse create(CreateContratRequest request) {
        return createContrat(request, null);
    }

    @Transactional
    public ContratResponse renouveler(String agenceId, String contratOrigineId, CreateContratRequest request) {
        Contrat contratOrigine = contratRepository.findByAgenceIdAndId(agenceId, contratOrigineId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratOrigineId));
        if (Boolean.TRUE.equals(contratOrigine.getRenouvele())) {
            throw new BadRequestException("Le contrat est deja renouvele");
        }
        if (request.getAgenceId() == null || request.getAgenceId().isBlank()) {
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

    private ContratResponse createContrat(CreateContratRequest request, Contrat contratOrigine) {
        if (contratRepository.existsByAgenceIdAndNumeroContrat(request.getAgenceId(), request.getNumeroContrat())) {
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
                .numeroDossier(request.getNumeroDossier())
                .numeroPolice(request.getNumeroPolice())
                .numeroAttestation(request.getNumeroAttestation())
                .dateEffet(request.getDateEffet())
                .dateEcheance(request.getDateEcheance())
                .echeance(request.getEcheance())
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
        contrat = contratRepository.save(contrat);

        for (CreateContratRequest.ClientInput input : request.getClients() == null ? List.<CreateContratRequest.ClientInput>of() : request.getClients()) {
            Client client = resolveClientForCreation(request.getAgenceId(), input);
            ContratClient link = contratClientRepository.save(ContratClient.builder()
                    .contrat(contrat)
                    .client(client)
                    .role(input.getRole())
                    .principalPourRole(input.isPrincipalPourRole())
                    .build());
            contrat.getClients().add(link);
        }

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
                    .modele(input.getModele())
                    .carburant(input.getCarburant())
                    .puissanceFiscale(input.getPuissanceFiscale())
                    .nombrePlaces(input.getNombrePlaces())
                    .sousClasse(input.getSousClasse())
                    .ptc(input.getPtc())
                    .datePremiereCirculation(input.getDatePremiereCirculation())
                    .dateExpirationCarteGrise(input.getDateExpirationCarteGrise())
                    .dateEffet(input.getDateEffet())
                    .dateEcheance(input.getDateEcheance())
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurVenale(input.getValeurVenale())
                    .valeurNeuf(input.getValeurNeuf())
                    .valeurGlace(input.getValeurGlace())
                    .organismeCredit(input.getOrganismeCredit() == null ? false : input.getOrganismeCredit())
                    .nomOrganismeCredit(input.getNomOrganismeCredit())
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
                    .modele(input.getModele())
                    .ptc(input.getPtc())
                    .dateMiseEnCirculation(input.getDateMiseEnCirculation())
                    .dateEffet(input.getDateEffet())
                    .dateEcheance(input.getDateEcheance())
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
            mouvementContratService.creerAffaireNouvelle(contrat, vehiculesCrees, remorquesCreees, garantiesCreees, quittanceManuelle);
        } else {
            mouvementContratService.creerRenouvellement(contrat, contratOrigine, vehiculesCrees, remorquesCreees, garantiesCreees);
        }

        return toResponse(contrat);
    }

    @Transactional(readOnly = true)
    public List<ContratResponse> list(String agenceId) {
        return contratRepository.findByAgenceIdOrderByCreatedAtDesc(agenceId).stream().map(this::toResponse).toList();
    }

    @Transactional(readOnly = true)
    public ContratResponse get(String agenceId, String contratId) {
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        return toResponse(contrat);
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

        Contrat contrat = Contrat.builder()
                .agence(agence)
                .compagnieAssurance(compagnie)
                .convention(convention)
                .usage(usageContrat)
                .grilleTarifaire(grilleTarifaire)
                .typeContrat(request.getTypeContrat())
                .numeroContrat(request.getNumeroContrat())
                .numeroDevis(request.getNumeroDevis())
                .numeroDossier(request.getNumeroDossier())
                .numeroPolice(request.getNumeroPolice())
                .numeroAttestation(request.getNumeroAttestation())
                .dateEffet(request.getDateEffet())
                .dateEcheance(request.getDateEcheance())
                .echeance(request.getEcheance())
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

        for (CreateContratRequest.ClientInput input : request.getClients() == null ? List.<CreateContratRequest.ClientInput>of() : request.getClients()) {
            Client client = resolveClientForPreview(request.getAgenceId(), input);
            contrat.getClients().add(ContratClient.builder()
                    .contrat(contrat)
                    .client(client)
                    .role(input.getRole())
                    .principalPourRole(input.isPrincipalPourRole())
                    .build());
        }

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
                .build();
    }

    private Client resolveClientForCreation(String agenceId, CreateContratRequest.ClientInput input) {
        if (hasText(input.getClientId())) {
            return clientRepository.findByAgenceIdAndId(agenceId, input.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", input.getClientId()));
        }
        if (input.getClient() == null) {
            throw new BadRequestException("Le role " + input.getRole() + " doit renseigner clientId ou client");
        }
        if (!hasText(input.getClient().getAgenceId())) {
            input.getClient().setAgenceId(agenceId);
        }
        if (!agenceId.equals(input.getClient().getAgenceId())) {
            throw new BadRequestException("Le client inline doit appartenir a l'agence du contrat");
        }
        return clientService.createEntity(input.getClient());
    }

    private Client resolveClientForPreview(String agenceId, CreateContratRequest.ClientInput input) {
        if (hasText(input.getClientId())) {
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
                    .modele(input.getModele())
                    .carburant(input.getCarburant())
                    .puissanceFiscale(input.getPuissanceFiscale())
                    .nombrePlaces(input.getNombrePlaces())
                    .sousClasse(input.getSousClasse())
                    .ptc(input.getPtc())
                    .datePremiereCirculation(input.getDatePremiereCirculation())
                    .dateExpirationCarteGrise(input.getDateExpirationCarteGrise())
                    .dateEffet(input.getDateEffet())
                    .dateEcheance(input.getDateEcheance())
                    .crm(input.getCrm())
                    .numeroAttestation(input.getNumeroAttestation())
                    .coefficientProrata(input.getCoefficientProrata())
                    .valeurVenale(input.getValeurVenale())
                    .valeurNeuf(input.getValeurNeuf())
                    .valeurGlace(input.getValeurGlace())
                    .organismeCredit(input.getOrganismeCredit() == null ? false : input.getOrganismeCredit())
                    .nomOrganismeCredit(input.getNomOrganismeCredit())
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
                    .modele(input.getModele())
                    .ptc(input.getPtc())
                    .dateMiseEnCirculation(input.getDateMiseEnCirculation())
                    .dateEffet(input.getDateEffet())
                    .dateEcheance(input.getDateEcheance())
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
                    .marqueId(vehicule.getMarque() != null ? vehicule.getMarque().getId() : null)
                    .marque(vehicule.getMarque() != null ? vehicule.getMarque().getLibelle() : null)
                    .modele(vehicule.getModele())
                    .carrosserieId(vehicule.getCarrosserie() != null ? vehicule.getCarrosserie().getId() : null)
                    .carrosserie(vehicule.getCarrosserie() != null ? vehicule.getCarrosserie().getLibelle() : null)
                    .categorieTransportId(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getId() : null)
                    .categorieTransportCode(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getCode() : null)
                    .categorieTransportLibelle(vehicule.getCategorieTransport() != null ? vehicule.getCategorieTransport().getLibelle() : null)
                    .coefficientProrata(vehicule.getCoefficientProrata())
                    .valeurVenale(vehicule.getValeurVenale())
                    .valeurNeuf(vehicule.getValeurNeuf())
                    .valeurGlace(vehicule.getValeurGlace())
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
                    .modele(remorque.getModele())
                    .ptc(remorque.getPtc())
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
                .numeroPolice(contrat.getNumeroPolice())
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

    private Marque resolveMarque(String marqueId, String marqueLibelle, boolean createIfMissing) {
        if (hasText(marqueId)) {
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

    private Carrosserie resolveCarrosserie(String carrosserieId, String carrosserieLibelle, boolean createIfMissing) {
        if (hasText(carrosserieId)) {
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

    private CategorieTransport resolveCategorieTransport(String categorieTransportId) {
        if (!hasText(categorieTransportId)) {
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

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
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

    private FormuleGarantiePersonne resolveFormuleGarantiePersonne(String formuleId, Contrat contrat, Garantie garantie, Usage usageCible) {
        if (formuleId == null || formuleId.isBlank()) {
            return null;
        }
        FormuleGarantiePersonne formule = formuleGarantiePersonneRepository.findById(formuleId)
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
        if (input.getLigneGrilleTarifaireId() != null && !input.getLigneGrilleTarifaireId().isBlank()) {
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
        if (remorque != null && (ligne.getTauxRemorque() != null || ligne.getFranchiseMinimaleRemorque() != null || ligne.getTauxFranchiseRemorque() != null)) {
            score += 2;
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
}
