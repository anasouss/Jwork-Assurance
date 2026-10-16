package com.assurance.service;

import com.assurance.dto.request.CreateAssistanceVoyageRequest;
import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.request.QuoteAssistanceVoyageRequest;
import com.assurance.dto.response.AssistanceVoyageCreationResponse;
import com.assurance.dto.response.AssistanceVoyageQuoteResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Client;
import com.assurance.entity.CodePromoAssistance;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.LigneTarificationAssistance;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutElementFacturable;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeClient;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypePayeurPrime;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.BrancheAssuranceRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.CompagnieAssistanceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.LigneTarificationAssistanceRepository;
import com.assurance.repository.ProduitAssistanceRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.time.Period;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class AssistanceVoyageService {

    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final AgenceRepository agenceRepository;
    private final BrancheAssuranceRepository brancheAssuranceRepository;
    private final CompagnieAssistanceRepository compagnieAssistanceRepository;
    private final ProduitAssistanceRepository produitAssistanceRepository;
    private final ContratRepository contratRepository;
    private final ContratClientRepository contratClientRepository;
    private final ClientRepository clientRepository;
    private final ClientService clientService;
    private final TarifProduitAssistanceService tarifProduitAssistanceService;
    private final CodePromoAssistanceService codePromoAssistanceService;
    private final TypeMouvementContratRepository typeMouvementContratRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final ElementFacturableRepository elementFacturableRepository;
    private final LigneTarificationAssistanceRepository ligneTarificationAssistanceRepository;
    private final ContractDirectModificationPolicy directModificationPolicy;

    @Transactional(readOnly = true)
    public AssistanceVoyageQuoteResponse quote(QuoteAssistanceVoyageRequest request) {
        validateDuration(request.getDureeMois());
        if (request.getDatesNaissanceAssures() == null || request.getDatesNaissanceAssures().isEmpty()) {
            throw new BadRequestException("Au moins une date de naissance d'assuré est obligatoire");
        }
        CompagnieAssistance compagnie = compagnieAssistanceRepository.findById(request.getCompagnieAssistanceId())
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Compagnie d'assistance inactive ou introuvable"));
        ProduitAssistance produit = produitAssistanceRepository.findById(request.getProduitAssistanceId())
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Produit d'assistance inactif ou introuvable"));
        validateProduct(compagnie, produit);
        Pricing pricing = price(
                produit,
                request.getDateEffet(),
                request.getDureeMois(),
                request.getDatesNaissanceAssures(),
                request.getCodePromo()
        );
        return AssistanceVoyageQuoteResponse.builder()
                .dateEcheance(request.getDateEffet().plusMonths(request.getDureeMois()).minusDays(1))
                .primeNette(pricing.net())
                .primeTotale(pricing.total())
                .montantReduction(pricing.reduction())
                .lignes(pricing.lines().stream()
                        .map(line -> AssistanceVoyageQuoteResponse.Ligne.builder()
                                .assureIndex(line.insuredIndex())
                                .age(line.age())
                                .tarifId(line.tariff().getId())
                                .primeNette(line.net())
                                .primeTotale(line.total())
                                .montantReduction(line.reduction())
                                .build())
                        .toList())
                .build();
    }

    @Transactional
    public AssistanceVoyageCreationResponse create(Long agenceId, CreateAssistanceVoyageRequest request) {
        validateRequest(request);
        if (contratRepository.existsByAgenceIdAndNumeroContrat(agenceId, request.getNumeroContrat().trim())) {
            throw new BadRequestException("Numéro de contrat déjà utilisé pour cette agence");
        }

        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        BrancheAssurance branche = brancheAssuranceRepository.findByCodeIgnoreCase("ASSISTANCE")
                .orElseThrow(() -> new BadRequestException("La branche Assistance n'est pas configurée"));
        CompagnieAssistance compagnie = compagnieAssistanceRepository.findById(request.getCompagnieAssistanceId())
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Compagnie d'assistance inactive ou introuvable"));
        ProduitAssistance produit = produitAssistanceRepository.findById(request.getProduitAssistanceId())
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Produit d'assistance inactif ou introuvable"));
        validateProduct(compagnie, produit);

        LocalDate dateEcheance = request.getDateEffet().plusMonths(request.getDureeMois()).minusDays(1);

        Client souscripteur = resolvePerson(agenceId, request.getSouscripteur(), "souscripteur", true);
        boolean souscripteurAssure = Boolean.TRUE.equals(request.getAssureIdentiqueSouscripteur());
        if (souscripteurAssure && souscripteur.getTypeClient() != TypeClient.PERSONNE_PHYSIQUE) {
            throw new BadRequestException("Une personne morale ne peut pas être une personne assurée");
        }
        List<Client> assures = souscripteurAssure
                ? List.of(souscripteur)
                : resolveInsuredPeople(agenceId, request.getAssures());
        Pricing pricing = price(
                produit,
                request.getDateEffet(),
                request.getDureeMois(),
                assures.stream().map(Client::getDateNaissance).toList(),
                request.getCodePromo()
        );
        Client payeur = resolvePayer(request.getPayeurIndex(), souscripteur, assures);

        Contrat contrat = Contrat.builder()
                .agence(agence)
                .brancheAssurance(branche)
                .typeContrat(TypeContrat.PARTICULIER)
                .statut(StatutContrat.ACTIVE)
                .numeroContrat(request.getNumeroContrat().trim())
                .numeroPolice(request.getNumeroContrat().trim())
                .dateEffet(request.getDateEffet())
                .dateEcheance(dateEcheance)
                .typeRenouvellement("ferme")
                .periodicite(durationLabel(request.getDureeMois()))
                .typePayeurPrime(payeur.getId().equals(souscripteur.getId())
                        ? TypePayeurPrime.SOUSCRIPTEUR
                        : TypePayeurPrime.TIERS_MANDATE)
                .payeurPrime(payeur.getId().equals(souscripteur.getId()) ? null : payeur)
                .modeFacturation(ModeFacturationContrat.DIRECTE)
                .nombreVehicules(0)
                .nombreRemorques(0)
                .assistance(true)
                .brouillon(false)
                .build();
        contrat = contratRepository.save(contrat);
        contrat.setNumeroDossier(String.format(
                Locale.ROOT,
                "AV-%02d-%06d",
                Math.floorMod(request.getDateEffet().getYear(), 100),
                contrat.getId()
        ));
        contrat = contratRepository.save(contrat);

        linkClient(contrat, souscripteur, RoleClientContrat.SOUSCRIPTEUR, true);
        for (int index = 0; index < assures.size(); index++) {
            linkClient(contrat, assures.get(index), RoleClientContrat.BENEFICIAIRE, index == 0);
        }

        TypeMouvementContrat typeMouvement = typeMouvementContratRepository
                .findByCodeIgnoreCase(MouvementContratService.CODE_AFFAIRE_NOUVELLE)
                .orElseThrow(() -> new BadRequestException("Le mouvement Affaire nouvelle n'est pas configuré"));
        MouvementContrat mouvement = mouvementContratRepository.save(MouvementContrat.builder()
                .agence(agence)
                .contrat(contrat)
                .typeMouvement(typeMouvement)
                .statut(StatutMouvementContrat.VALIDE)
                .numeroMouvement("1")
                .dateEffet(request.getDateEffet())
                .dateEcheance(dateEcheance)
                .dateValidation(LocalDate.now())
                .primeNette(ZERO)
                .taxe(ZERO)
                .taxeParafiscale(ZERO)
                .accessoire(ZERO)
                .cnpac(ZERO)
                .primeTotale(ZERO)
                .notes("Création d'une assistance voyage")
                .build());

        AssistanceContrat assistance = assistanceContratRepository.save(AssistanceContrat.builder()
                .contrat(contrat)
                .mouvementContrat(mouvement)
                .compagnieAssistance(compagnie)
                .produitAssistance(produit)
                .tarifProduitAssistance(singleTariff(pricing.lines()))
                .produit(produit.getLibelle())
                .dateSouscription(LocalDate.now())
                .dateEffet(request.getDateEffet())
                .dateEcheance(dateEcheance)
                .duree(request.getDureeMois())
                .unite("MOIS")
                .numeroDossier(contrat.getNumeroDossier())
                .numeroPoliceContrat(request.getNumeroContrat().trim())
                .numeroContratOuQuittance(request.getNumeroContrat().trim())
                .typeQuittance("AFFAIRE_NOUVELLE")
                .codePromo(normalizedPromo(request.getCodePromo()))
                .montantReduction(pricing.reduction())
                .primeNette(pricing.net())
                .primeTotale(pricing.total())
                .actif(true)
                .build());

        for (PricingLine line : pricing.lines()) {
            ligneTarificationAssistanceRepository.save(LigneTarificationAssistance.builder()
                    .assistanceContrat(assistance)
                    .assure(assures.get(line.insuredIndex()))
                    .tarifProduitAssistance(line.tariff())
                    .age(line.age())
                    .coefficientDuree(line.durationCoefficient())
                    .montantBaseHt(line.baseNet())
                    .montantBaseTtc(line.baseTotal())
                    .montantReduction(line.reduction())
                    .primeNette(line.net())
                    .primeTotale(line.total())
                    .build());
        }

        ElementFacturable element = elementFacturableRepository.save(ElementFacturable.builder()
                .agence(agence)
                .contrat(contrat)
                .mouvementContrat(mouvement)
                .nature(NatureElementFacturable.ASSISTANCE)
                .statut(StatutElementFacturable.A_QUITTANCER)
                .referenceSource(String.valueOf(assistance.getId()))
                .libelle("Assistance voyage - " + produit.getLibelle())
                .dateDebut(request.getDateEffet())
                .dateFin(dateEcheance)
                .primeNette(pricing.net())
                .taxe(pricing.total().subtract(pricing.net()).max(ZERO))
                .taxeParafiscale(ZERO)
                .accessoire(ZERO)
                .cnpac(ZERO)
                .primeTotale(pricing.total())
                .actif(true)
                .build());
        assistance.setElementFacturable(element);
        assistanceContratRepository.save(assistance);

        return AssistanceVoyageCreationResponse.builder()
                .contratId(contrat.getId())
                .assistanceId(assistance.getId())
                .numeroDossier(contrat.getNumeroDossier())
                .numeroContrat(contrat.getNumeroContrat())
                .dateEffet(contrat.getDateEffet())
                .dateEcheance(contrat.getDateEcheance())
                .primeNette(pricing.net())
                .primeTotale(pricing.total())
                .montantReduction(pricing.reduction())
                .build();
    }

    @Transactional
    public AssistanceVoyageCreationResponse update(
            Long agenceId,
            Long contratId,
            CreateAssistanceVoyageRequest request
    ) {
        validateRequest(request);
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (contrat.getBrancheAssurance() == null
                || !"ASSISTANCE".equalsIgnoreCase(contrat.getBrancheAssurance().getCode())) {
            throw new BadRequestException("Ce dossier n'est pas une assistance voyage");
        }
        directModificationPolicy.assertAllowed(agenceId, contrat);
        if (contratRepository.existsByAgenceIdAndNumeroContratAndIdNot(
                agenceId,
                request.getNumeroContrat().trim(),
                contratId
        )) {
            throw new BadRequestException("Numéro de contrat déjà utilisé pour cette agence");
        }

        AssistanceContrat assistance = assistanceContratRepository
                .findByContratIdAndActifTrueOrderByCreatedAtDesc(contratId)
                .stream()
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Aucune assistance voyage active n'est liée à ce dossier"));
        ElementFacturable element = assistance.getElementFacturable();
        if (element == null || element.getStatut() != StatutElementFacturable.A_QUITTANCER) {
            throw new BadRequestException("Cette assistance a déjà été quittancée et ne peut plus être modifiée directement");
        }

        CompagnieAssistance compagnie = compagnieAssistanceRepository.findById(request.getCompagnieAssistanceId())
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Compagnie d'assistance inactive ou introuvable"));
        ProduitAssistance produit = produitAssistanceRepository.findById(request.getProduitAssistanceId())
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Produit d'assistance inactif ou introuvable"));
        validateProduct(compagnie, produit);

        Client souscripteur = resolvePerson(agenceId, request.getSouscripteur(), "souscripteur", true);
        boolean souscripteurAssure = Boolean.TRUE.equals(request.getAssureIdentiqueSouscripteur());
        if (souscripteurAssure && souscripteur.getTypeClient() != TypeClient.PERSONNE_PHYSIQUE) {
            throw new BadRequestException("Une personne morale ne peut pas être une personne assurée");
        }
        List<Client> assures = souscripteurAssure
                ? List.of(souscripteur)
                : resolveInsuredPeople(agenceId, request.getAssures());
        Pricing pricing = price(
                produit,
                request.getDateEffet(),
                request.getDureeMois(),
                assures.stream().map(Client::getDateNaissance).toList(),
                request.getCodePromo()
        );
        Client payeur = resolvePayer(request.getPayeurIndex(), souscripteur, assures);
        LocalDate dateEcheance = request.getDateEffet().plusMonths(request.getDureeMois()).minusDays(1);

        contrat.setNumeroContrat(request.getNumeroContrat().trim());
        contrat.setNumeroPolice(request.getNumeroContrat().trim());
        contrat.setDateEffet(request.getDateEffet());
        contrat.setDateEcheance(dateEcheance);
        contrat.setPeriodicite(durationLabel(request.getDureeMois()));
        contrat.setTypePayeurPrime(payeur.getId().equals(souscripteur.getId())
                ? TypePayeurPrime.SOUSCRIPTEUR
                : TypePayeurPrime.TIERS_MANDATE);
        contrat.setPayeurPrime(payeur.getId().equals(souscripteur.getId()) ? null : payeur);
        contratRepository.save(contrat);

        contratClientRepository.deleteByContratId(contratId);
        contratClientRepository.flush();
        contrat.getClients().clear();
        linkClient(contrat, souscripteur, RoleClientContrat.SOUSCRIPTEUR, true);
        for (int index = 0; index < assures.size(); index++) {
            linkClient(contrat, assures.get(index), RoleClientContrat.BENEFICIAIRE, index == 0);
        }

        MouvementContrat mouvement = assistance.getMouvementContrat();
        if (mouvement == null) {
            throw new BadRequestException("Le mouvement initial de l'assistance est introuvable");
        }
        mouvement.setDateEffet(request.getDateEffet());
        mouvement.setDateEcheance(dateEcheance);
        mouvementContratRepository.save(mouvement);

        assistance.setCompagnieAssistance(compagnie);
        assistance.setProduitAssistance(produit);
        assistance.setTarifProduitAssistance(singleTariff(pricing.lines()));
        assistance.setProduit(produit.getLibelle());
        assistance.setDateEffet(request.getDateEffet());
        assistance.setDateEcheance(dateEcheance);
        assistance.setDuree(request.getDureeMois());
        assistance.setUnite("MOIS");
        assistance.setNumeroPoliceContrat(request.getNumeroContrat().trim());
        assistance.setNumeroContratOuQuittance(request.getNumeroContrat().trim());
        assistance.setCodePromo(normalizedPromo(request.getCodePromo()));
        assistance.setMontantReduction(pricing.reduction());
        assistance.setPrimeNette(pricing.net());
        assistance.setPrimeTotale(pricing.total());
        assistanceContratRepository.save(assistance);

        ligneTarificationAssistanceRepository.deleteByAssistanceContratId(assistance.getId());
        ligneTarificationAssistanceRepository.flush();
        for (PricingLine line : pricing.lines()) {
            ligneTarificationAssistanceRepository.save(LigneTarificationAssistance.builder()
                    .assistanceContrat(assistance)
                    .assure(assures.get(line.insuredIndex()))
                    .tarifProduitAssistance(line.tariff())
                    .age(line.age())
                    .coefficientDuree(line.durationCoefficient())
                    .montantBaseHt(line.baseNet())
                    .montantBaseTtc(line.baseTotal())
                    .montantReduction(line.reduction())
                    .primeNette(line.net())
                    .primeTotale(line.total())
                    .build());
        }

        element.setLibelle("Assistance voyage - " + produit.getLibelle());
        element.setDateDebut(request.getDateEffet());
        element.setDateFin(dateEcheance);
        element.setPrimeNette(pricing.net());
        element.setTaxe(pricing.total().subtract(pricing.net()).max(ZERO));
        element.setPrimeTotale(pricing.total());
        elementFacturableRepository.save(element);

        return AssistanceVoyageCreationResponse.builder()
                .contratId(contrat.getId())
                .assistanceId(assistance.getId())
                .numeroDossier(contrat.getNumeroDossier())
                .numeroContrat(contrat.getNumeroContrat())
                .dateEffet(contrat.getDateEffet())
                .dateEcheance(contrat.getDateEcheance())
                .primeNette(pricing.net())
                .primeTotale(pricing.total())
                .montantReduction(pricing.reduction())
                .build();
    }

    private void validateRequest(CreateAssistanceVoyageRequest request) {
        validateDuration(request.getDureeMois());
    }

    private void validateDuration(int durationMonths) {
        if (durationMonths < 6
                || durationMonths > 60
                || (durationMonths != 6 && durationMonths % 12 != 0)) {
            throw new BadRequestException("La durée doit être de 6 mois ou de 1 à 5 ans");
        }
    }

    private void validateProduct(CompagnieAssistance compagnie, ProduitAssistance produit) {
        if (produit.getCompagnieAssistance() == null
                || !compagnie.getId().equals(produit.getCompagnieAssistance().getId())) {
            throw new BadRequestException("Le produit ne correspond pas à la compagnie sélectionnée");
        }
        if (!"Assistance Voyage".equalsIgnoreCase(produit.getType())) {
            throw new BadRequestException("Le produit sélectionné n'est pas un produit Assistance Voyage");
        }
    }

    private List<Client> resolveInsuredPeople(
            Long agenceId,
            List<CreateAssistanceVoyageRequest.Personne> requests
    ) {
        Map<Long, Client> unique = new LinkedHashMap<>();
        for (CreateAssistanceVoyageRequest.Personne request : requests == null
                ? List.<CreateAssistanceVoyageRequest.Personne>of()
                : requests) {
            Client client = resolvePerson(agenceId, request, "assuré", false);
            unique.put(client.getId(), client);
        }
        if (unique.isEmpty()) {
            throw new BadRequestException("Au moins une personne assurée est obligatoire");
        }
        return new ArrayList<>(unique.values());
    }

    private Client resolvePerson(
            Long agenceId,
            CreateAssistanceVoyageRequest.Personne person,
            String role,
            boolean allowLegalEntity
    ) {
        if (person == null) {
            throw new BadRequestException("Les informations du " + role + " sont obligatoires");
        }
        Client client;
        if (person.getClientId() != null) {
            client = clientRepository.findByAgenceIdAndId(agenceId, person.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", person.getClientId()));
        } else {
            validateNewPerson(person.getClient(), role, allowLegalEntity);
            client = clientService.createEntity(agenceId, person.getClient());
        }
        validatePersonProfile(client, role, allowLegalEntity);
        return client;
    }

    private void validateNewPerson(CreateClientRequest request, String role, boolean allowLegalEntity) {
        if (request == null) {
            throw new BadRequestException("Sélectionnez ou renseignez le " + role);
        }
        if (request.getTypeClient() == TypeClient.PERSONNE_MORALE) {
            if (!allowLegalEntity) {
                throw new BadRequestException("Le " + role + " doit être une personne physique");
            }
            if (!hasText(request.getRaisonSociale()) || !hasText(request.getRc())) {
                throw new BadRequestException("La raison sociale et le RC du " + role + " sont obligatoires");
            }
            return;
        }
        if (request.getTypeClient() != TypeClient.PERSONNE_PHYSIQUE) {
            throw new BadRequestException("Le " + role + " doit être une personne physique");
        }
        if (!hasText(request.getCin()) && !hasText(request.getPassport())) {
            throw new BadRequestException("Le CIN ou le passeport du " + role + " est obligatoire");
        }
    }

    private void validatePersonProfile(Client client, String role, boolean allowLegalEntity) {
        if (client.getTypeClient() == TypeClient.PERSONNE_MORALE) {
            if (!allowLegalEntity
                    || !hasText(client.getRaisonSociale())
                    || !hasText(client.getRc())
                    || !hasText(client.getAdresse())
                    || client.getVille() == null
                    || !hasText(client.getTelephone())) {
                throw new BadRequestException("Le profil du " + role
                        + " doit contenir la raison sociale, le RC, l'adresse et le téléphone");
            }
            return;
        }
        if (client.getTypeClient() != TypeClient.PERSONNE_PHYSIQUE
                || !hasText(client.getPrenom())
                || !hasText(client.getNom())
                || (!hasText(client.getCin()) && !hasText(client.getPassport()))
                || client.getDateNaissance() == null
                || !hasText(client.getNationalite())
                || !hasText(client.getAdresse())
                || client.getVille() == null
                || !hasText(client.getTelephone())) {
            throw new BadRequestException("Le profil du " + role
                    + " doit contenir le nom, le document d'identité, la naissance, l'adresse et le téléphone");
        }
    }

    private Client resolvePayer(Integer payerIndex, Client subscriber, List<Client> insuredPeople) {
        if (payerIndex == null || payerIndex < 0) {
            return subscriber;
        }
        if (payerIndex >= insuredPeople.size()) {
            throw new BadRequestException("Payeur sélectionné invalide");
        }
        return insuredPeople.get(payerIndex);
    }

    private void linkClient(Contrat contrat, Client client, RoleClientContrat role, boolean principal) {
        ContratClient link = contratClientRepository.save(ContratClient.builder()
                .contrat(contrat)
                .client(client)
                .role(role)
                .principalPourRole(principal)
                .build());
        contrat.getClients().add(link);
    }

    private Pricing price(
            ProduitAssistance produit,
            LocalDate effectiveDate,
            int durationMonths,
            List<LocalDate> birthDates,
            String submittedPromo
    ) {
        CodePromoAssistance promo = codePromoAssistanceService.resolve(produit, submittedPromo, effectiveDate);
        BigDecimal factor = promo == null
                ? BigDecimal.ONE
                : BigDecimal.ONE.subtract(
                        promo.getTauxReduction().divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP)
                );
        BigDecimal durationCoefficient = durationMonths == 6
                ? BigDecimal.ONE
                : BigDecimal.valueOf(durationMonths / 12L);
        List<PricingLine> lines = new ArrayList<>();
        for (int index = 0; index < birthDates.size(); index++) {
            LocalDate birthDate = birthDates.get(index);
            if (birthDate == null || birthDate.isAfter(effectiveDate)) {
                throw new BadRequestException("Date de naissance invalide pour l'assuré " + (index + 1));
            }
            int age = Period.between(birthDate, effectiveDate).getYears();
            TarifProduitAssistance tariff = tarifProduitAssistanceService.resolveTravelTarif(
                    produit,
                    effectiveDate,
                    durationMonths,
                    age
            );
            if (tariff == null) {
                throw new BadRequestException("Aucun tarif actif pour l'assuré " + (index + 1)
                        + " (" + age + " ans, " + durationLabel(durationMonths) + ")");
            }
            BigDecimal baseNet = money(tariff.getMontantHt().multiply(durationCoefficient));
            BigDecimal baseTotal = money(tariff.getMontantTtc().multiply(durationCoefficient));
            BigDecimal net = money(baseNet.multiply(factor));
            BigDecimal total = money(baseTotal.multiply(factor));
            lines.add(new PricingLine(
                    index,
                    age,
                    tariff,
                    durationCoefficient,
                    baseNet,
                    baseTotal,
                    net,
                    total,
                    money(baseTotal.subtract(total))
            ));
        }
        BigDecimal net = lines.stream().map(PricingLine::net).reduce(ZERO, BigDecimal::add);
        BigDecimal total = lines.stream().map(PricingLine::total).reduce(ZERO, BigDecimal::add);
        BigDecimal reduction = lines.stream().map(PricingLine::reduction).reduce(ZERO, BigDecimal::add);
        return new Pricing(money(net), money(total), money(reduction), lines);
    }

    private String durationLabel(int months) {
        return months == 6 ? "6 mois" : (months / 12) + " an" + (months > 12 ? "s" : "");
    }

    private TarifProduitAssistance singleTariff(List<PricingLine> lines) {
        TarifProduitAssistance first = lines.get(0).tariff();
        return lines.stream().allMatch(line -> line.tariff().getId().equals(first.getId())) ? first : null;
    }

    private String normalizedPromo(String value) {
        return hasText(value) ? value.trim().toUpperCase(Locale.ROOT) : null;
    }

    private BigDecimal money(BigDecimal value) {
        return (value == null ? BigDecimal.ZERO : value).setScale(2, RoundingMode.HALF_UP);
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record Pricing(BigDecimal net, BigDecimal total, BigDecimal reduction, List<PricingLine> lines) {
    }

    private record PricingLine(
            int insuredIndex,
            int age,
            TarifProduitAssistance tariff,
            BigDecimal durationCoefficient,
            BigDecimal baseNet,
            BigDecimal baseTotal,
            BigDecimal net,
            BigDecimal total,
            BigDecimal reduction
    ) {
    }
}
