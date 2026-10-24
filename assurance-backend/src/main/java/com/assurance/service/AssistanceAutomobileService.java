package com.assurance.service;

import com.assurance.dto.request.CreateAssistanceAutomobileRequest;
import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.request.QuoteAssistanceAutomobileRequest;
import com.assurance.dto.request.SaveAssistanceAutomobileDraftSectionRequest;
import com.assurance.dto.response.AssistanceDraftResponse;
import com.assurance.dto.response.AssistanceAutomobileCreationResponse;
import com.assurance.dto.response.AssistanceAutomobileQuoteResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.AssistanceContrat;
import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Carrosserie;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.CategorieTransport;
import com.assurance.entity.Client;
import com.assurance.entity.CodePromoAssistance;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.ElementFacturable;
import com.assurance.entity.Marque;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.ModeFacturationContrat;
import com.assurance.enums.NatureElementFacturable;
import com.assurance.enums.NatureSnapshotMouvement;
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
import com.assurance.repository.CarrosserieRepository;
import com.assurance.repository.CategorieClientRepository;
import com.assurance.repository.CategorieTransportRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.CompagnieAssistanceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.MarqueRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.ProduitAssistanceRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import com.assurance.repository.UsageRepository;
import com.assurance.repository.VehiculeRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.LocalDate;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class AssistanceAutomobileService {

    private static final String TYPE_ASSISTANCE = "Assistance Automobile";
    private static final BigDecimal ZERO = new BigDecimal("0.00");

    private final AgenceRepository agenceRepository;
    private final BrancheAssuranceRepository brancheAssuranceRepository;
    private final CompagnieAssistanceRepository compagnieAssistanceRepository;
    private final ProduitAssistanceRepository produitAssistanceRepository;
    private final TarifProduitAssistanceService tarifProduitAssistanceService;
    private final CodePromoAssistanceService codePromoAssistanceService;
    private final EcheanceService echeanceService;
    private final ContratRepository contratRepository;
    private final ContratClientRepository contratClientRepository;
    private final ClientRepository clientRepository;
    private final ClientService clientService;
    private final CategorieClientRepository categorieClientRepository;
    private final UsageRepository usageRepository;
    private final MarqueRepository marqueRepository;
    private final CarrosserieRepository carrosserieRepository;
    private final CategorieTransportRepository categorieTransportRepository;
    private final VehiculeRepository vehiculeRepository;
    private final TypeMouvementContratRepository typeMouvementContratRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final AssistanceContratRepository assistanceContratRepository;
    private final ElementFacturableRepository elementFacturableRepository;
    private final ContractDirectModificationPolicy directModificationPolicy;

    @Transactional(readOnly = true)
    public AssistanceAutomobileQuoteResponse quote(QuoteAssistanceAutomobileRequest request) {
        validateSubscriptionDate(request.getDateSouscription(), request.getDateEffet());
        CompagnieAssistance compagnie = requireCompany(request.getCompagnieAssistanceId());
        ProduitAssistance produit = requireProduct(compagnie, request.getProduitAssistanceId());
        CategorieClient categorie = requireCategory(request.getCategorieClientId());
        Usage usage = requireUsage(request.getUsageId());
        validateEligibility(produit, categorie, usage);
        Pricing pricing = price(produit, request.getDateSouscription(), request.getDateEffet(), request.getDureeMois(), request.getCodePromo());
        return toQuote(pricing);
    }

    @Transactional
    public AssistanceAutomobileCreationResponse create(
            Long agenceId,
            CreateAssistanceAutomobileRequest request
    ) {
        return createInternal(agenceId, request, null, null);
    }

    @Transactional
    public AssistanceDraftResponse saveDraftSection(
            Long agenceId,
            Long contratId,
            String section,
            SaveAssistanceAutomobileDraftSectionRequest request
    ) {
        CompagnieAssistance compagnie = requireCompany(request.getCompagnieAssistanceId());
        Contrat draft = contratId == null
                ? createDraftContract(agenceId)
                : requireDraftContract(agenceId, contratId);
        upsertDraftAssistance(draft, compagnie);

        String normalizedSection = section == null ? "" : section.trim().toLowerCase(Locale.ROOT);
        List<Long> savedClientIds = List.of();
        if ("souscripteur".equals(normalizedSection)) {
            Client subscriber = resolvePerson(agenceId, request.getPersonne(), "souscripteur");
            replaceClientRole(draft, RoleClientContrat.SOUSCRIPTEUR, subscriber);
            savedClientIds = List.of(subscriber.getId());
        } else if ("proprietaire".equals(normalizedSection)) {
            requireDraftClient(draft, RoleClientContrat.SOUSCRIPTEUR, "souscripteur");
            Client insured = resolvePerson(agenceId, request.getPersonne(), "assuré");
            CategorieClient categorie = requireCategory(request.getCategorieClientId());
            replaceClientRole(draft, RoleClientContrat.PROPRIETAIRE, insured);
            savedClientIds = List.of(insured.getId());
            draft.setCategorieClient(categorie);
            contratRepository.save(draft);
        } else if ("vehicule".equals(normalizedSection)) {
            requireDraftClient(draft, RoleClientContrat.PROPRIETAIRE, "assuré");
            CategorieClient categorie = requireCategory(request.getCategorieClientId());
            if (request.getVehicule() == null || request.getVehicule().getUsageId() == null) {
                throw new BadRequestException("Les informations du véhicule sont obligatoires");
            }
            Usage usage = requireUsage(request.getVehicule().getUsageId());
            // The effective date belongs to the later contract section. Validate it authoritatively at finalization.
            validateVehicle(request.getVehicule(), null, categorie, usage);
            Vehicule existing = vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(draft.getId())
                    .stream()
                    .findFirst()
                    .orElse(null);
            saveVehicle(draft, existing, request.getVehicule(), usage, null);
            draft.setCategorieClient(categorie);
            draft.setUsage(usage);
            draft.setNombreVehicules(1);
            contratRepository.save(draft);
        } else {
            throw new BadRequestException("Section de brouillon d'assistance automobile inconnue");
        }

        return AssistanceDraftResponse.builder()
                .contratId(draft.getId())
                .numeroDossier(draft.getNumeroDossier())
                .sectionEnregistree(normalizedSection)
                .clientIds(savedClientIds)
                .build();
    }

    @Transactional
    public AssistanceAutomobileCreationResponse finalizeDraft(
            Long agenceId,
            Long contratId,
            CreateAssistanceAutomobileRequest request
    ) {
        Contrat draft = requireDraftContract(agenceId, contratId);
        requireDraftClient(draft, RoleClientContrat.SOUSCRIPTEUR, "souscripteur");
        requireDraftClient(draft, RoleClientContrat.PROPRIETAIRE, "assuré");
        if (vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(draft.getId()).isEmpty()) {
            throw new BadRequestException("Enregistrez d'abord le véhicule assuré");
        }
        AssistanceAutomobileCreationResponse response = createInternal(agenceId, request, null, null);
        assistanceContratRepository.deleteAll(
                assistanceContratRepository.findByContratIdOrderByCreatedAtDesc(draft.getId())
        );
        assistanceContratRepository.flush();
        vehiculeRepository.deleteByContratId(draft.getId());
        vehiculeRepository.flush();
        contratClientRepository.deleteByContratId(draft.getId());
        contratClientRepository.flush();
        draft.getAssistances().clear();
        draft.getVehicules().clear();
        draft.getClients().clear();
        contratRepository.delete(draft);
        contratRepository.flush();
        return response;
    }

    @Transactional
    public AssistanceAutomobileCreationResponse renew(
            Long agenceId,
            Long contratOrigineId,
            CreateAssistanceAutomobileRequest request
    ) {
        Contrat source = contratRepository.findByAgenceIdAndIdForUpdate(agenceId, contratOrigineId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratOrigineId));
        AssistanceContrat sourceAssistance = requireRenewableAssistance(source);
        validateRenewalPeriod(sourceAssistance, request.getDateEffet());
        return createInternal(agenceId, request, source, sourceAssistance);
    }

    private AssistanceAutomobileCreationResponse createInternal(
            Long agenceId,
            CreateAssistanceAutomobileRequest request,
            Contrat source,
            AssistanceContrat sourceAssistance
    ) {
        validateSubscriptionDate(request.getDateSouscription(), request.getDateEffet());
        validateContractNumber(agenceId, null, request.getNumeroContrat());
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        BrancheAssurance branche = requireAssistanceBranch();
        CompagnieAssistance compagnie = requireCompany(request.getCompagnieAssistanceId());
        ProduitAssistance produit = requireProduct(compagnie, request.getProduitAssistanceId());
        String echeanceCode = requireEcheanceCode(request.getEcheanceCode());
        Client souscripteur = resolvePerson(agenceId, request.getSouscripteur(), "souscripteur");
        Client assure = Boolean.TRUE.equals(request.getAssureIdentiqueSouscripteur())
                ? souscripteur
                : resolvePerson(agenceId, request.getAssure(), "assuré");
        CategorieClient categorie = requireCategory(request.getCategorieClientId());
        Usage usage = requireUsage(request.getVehicule().getUsageId());
        validateEligibility(produit, categorie, usage);
        validateVehicle(request.getVehicule(), request.getDateEffet(), categorie, usage);
        Pricing pricing = price(produit, request.getDateSouscription(), request.getDateEffet(), request.getDureeMois(), request.getCodePromo());
        TypePayeurPrime typePayeur = resolvePayerType(request);
        Client payeur = resolvePayer(agenceId, request, typePayeur, souscripteur, assure);

        Contrat contrat = contratRepository.save(Contrat.builder()
                .agence(agence)
                .contratOrigine(source)
                .brancheAssurance(branche)
                .categorieClient(categorie)
                .usage(usage)
                .typeContrat(TypeContrat.PARTICULIER)
                .statut(StatutContrat.ACTIVE)
                .numeroContrat(request.getNumeroContrat().trim())
                .numeroPolice(request.getNumeroContrat().trim())
                .dateEffet(request.getDateEffet())
                .dateEcheance(pricing.dateEcheance())
                .echeance(echeanceCode)
                .typeRenouvellement("ferme")
                .periodicite(durationLabel(request.getDureeMois()))
                .typePayeurPrime(typePayeur)
                .payeurPrime(payeur)
                .modeFacturation(ModeFacturationContrat.DIRECTE)
                .nombreVehicules(1)
                .nombreRemorques(0)
                .assistance(true)
                .brouillon(false)
                .build());
        contrat.setNumeroDossier(String.format(
                Locale.ROOT,
                "AST-%02d-%06d",
                Math.floorMod(request.getDateEffet().getYear(), 100),
                contrat.getId()
        ));
        contratRepository.save(contrat);

        linkClient(contrat, souscripteur, RoleClientContrat.SOUSCRIPTEUR);
        linkClient(contrat, assure, RoleClientContrat.PROPRIETAIRE);
        Vehicule vehicule = saveVehicle(contrat, null, request.getVehicule(), usage, pricing.dateEcheance());
        MouvementContrat mouvement = saveMovement(contrat, null, pricing, source);
        saveVehicleSnapshot(mouvement, vehicule);
        AssistanceContrat assistance = saveAssistance(
                contrat, mouvement, vehicule, branche, compagnie, produit, null, request, pricing,
                sourceAssistance
        );
        saveBillableElement(contrat, mouvement, assistance, null, produit, pricing);
        if (source != null) {
            source.setRenouvele(true);
            source.setStatut(StatutContrat.RENEWED);
            contratRepository.save(source);
        }
        return toCreationResponse(contrat, assistance, souscripteur, pricing);
    }

    @Transactional
    public AssistanceAutomobileCreationResponse update(
            Long agenceId,
            Long contratId,
            CreateAssistanceAutomobileRequest request
    ) {
        validateSubscriptionDate(request.getDateSouscription(), request.getDateEffet());
        Contrat contrat = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        assertStandaloneAutomobileAssistance(contrat);
        directModificationPolicy.assertAllowed(agenceId, contrat);
        validateContractNumber(agenceId, contratId, request.getNumeroContrat());

        AssistanceContrat assistance = assistanceContratRepository
                .findByContratIdAndActifTrueOrderByCreatedAtDesc(contratId)
                .stream()
                .filter(item -> item.getProduitAssistance() != null
                        && TYPE_ASSISTANCE.equalsIgnoreCase(item.getProduitAssistance().getType()))
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Aucune assistance automobile active n'est liée à ce dossier"));
        ElementFacturable element = assistance.getElementFacturable();
        if (element == null || element.getStatut() != StatutElementFacturable.A_QUITTANCER) {
            throw new BadRequestException("Cette assistance a déjà été quittancée et ne peut plus être modifiée directement");
        }

        CompagnieAssistance compagnie = requireCompany(request.getCompagnieAssistanceId());
        ProduitAssistance produit = requireProduct(compagnie, request.getProduitAssistanceId());
        String echeanceCode = requireEcheanceCode(request.getEcheanceCode());
        Client souscripteur = resolvePerson(agenceId, request.getSouscripteur(), "souscripteur");
        Client assure = Boolean.TRUE.equals(request.getAssureIdentiqueSouscripteur())
                ? souscripteur
                : resolvePerson(agenceId, request.getAssure(), "assuré");
        CategorieClient categorie = requireCategory(request.getCategorieClientId());
        Usage usage = requireUsage(request.getVehicule().getUsageId());
        validateEligibility(produit, categorie, usage);
        validateVehicle(request.getVehicule(), request.getDateEffet(), categorie, usage);
        Pricing pricing = price(produit, request.getDateSouscription(), request.getDateEffet(), request.getDureeMois(), request.getCodePromo());
        TypePayeurPrime typePayeur = resolvePayerType(request);
        Client payeur = resolvePayer(agenceId, request, typePayeur, souscripteur, assure);

        contrat.setCategorieClient(categorie);
        contrat.setUsage(usage);
        contrat.setNumeroContrat(request.getNumeroContrat().trim());
        contrat.setNumeroPolice(request.getNumeroContrat().trim());
        contrat.setDateEffet(request.getDateEffet());
        contrat.setDateEcheance(pricing.dateEcheance());
        contrat.setEcheance(echeanceCode);
        contrat.setPeriodicite(durationLabel(request.getDureeMois()));
        contrat.setTypePayeurPrime(typePayeur);
        contrat.setPayeurPrime(payeur);
        contratRepository.save(contrat);

        contratClientRepository.deleteByContratId(contratId);
        contratClientRepository.flush();
        contrat.getClients().clear();
        linkClient(contrat, souscripteur, RoleClientContrat.SOUSCRIPTEUR);
        linkClient(contrat, assure, RoleClientContrat.PROPRIETAIRE);

        Vehicule existingVehicle = vehiculeRepository.findActiveByContratIdOrderByCreatedAtAsc(contratId)
                .stream().findFirst().orElse(null);
        Vehicule vehicule = saveVehicle(contrat, existingVehicle, request.getVehicule(), usage, pricing.dateEcheance());
        MouvementContrat mouvement = saveMovement(contrat, assistance.getMouvementContrat(), pricing, null);
        mouvementVehiculeRepository.deleteByMouvementContratId(mouvement.getId());
        mouvementVehiculeRepository.flush();
        saveVehicleSnapshot(mouvement, vehicule);
        assistance = saveAssistance(
                contrat, mouvement, vehicule, contrat.getBrancheAssurance(), compagnie, produit,
                assistance, request, pricing, null
        );
        saveBillableElement(contrat, mouvement, assistance, element, produit, pricing);
        return toCreationResponse(contrat, assistance, souscripteur, pricing);
    }

    private Pricing price(
            ProduitAssistance produit,
            LocalDate dateSouscription,
            LocalDate dateEffet,
            int dureeMois,
            String codePromo
    ) {
        TarifProduitAssistance tarif = tarifProduitAssistanceService.resolveAutomobileTarif(
                produit, dateSouscription, dureeMois
        );
        if (tarif == null) {
            throw new BadRequestException("Aucun tarif automobile actif pour la durée et la date sélectionnées");
        }
        CodePromoAssistance promo = codePromoAssistanceService.resolve(produit, codePromo, dateSouscription);
        BigDecimal factor = promo == null ? BigDecimal.ONE : BigDecimal.ONE.subtract(
                promo.getTauxReduction().divide(BigDecimal.valueOf(100), 8, RoundingMode.HALF_UP)
        );
        BigDecimal net = money(tarif.getMontantHt().multiply(factor));
        BigDecimal total = money(tarif.getMontantTtc().multiply(factor));
        return new Pricing(
                tarif,
                dateEffet.plusMonths(dureeMois).minusDays(1),
                net,
                total,
                money(tarif.getMontantTtc().subtract(total).max(ZERO))
        );
    }

    private void validateEligibility(ProduitAssistance produit, CategorieClient categorie, Usage usage) {
        if (produit.getCategorieClient() != null
                && !produit.getCategorieClient().getId().equals(categorie.getId())) {
            throw new BadRequestException("Produit d'assistance incompatible avec la catégorie de l'assuré");
        }
        if (produit.getUsages() != null && !produit.getUsages().isEmpty()
                && produit.getUsages().stream().noneMatch(item -> item.getId().equals(usage.getId()))) {
            throw new BadRequestException("Produit d'assistance incompatible avec l'usage du véhicule");
        }
        if (categorie.getUsages() != null && !categorie.getUsages().isEmpty()
                && categorie.getUsages().stream().noneMatch(item -> item.getId().equals(usage.getId()))) {
            throw new BadRequestException("Usage incompatible avec la catégorie de l'assuré");
        }
    }

    private void validateVehicle(
            CreateAssistanceAutomobileRequest.Vehicule input,
            LocalDate dateEffet,
            CategorieClient categorie,
            Usage usage
    ) {
        if (input.getMarqueId() == null && !hasText(input.getMarqueLibelle())) {
            throw new BadRequestException("Marque du véhicule obligatoire");
        }
        if (dateEffet != null && input.getDateExpirationCarteGrise().isBefore(dateEffet)) {
            throw new BadRequestException("La carte grise doit être valide à la date d'effet");
        }
        if (Boolean.TRUE.equals(usage.getByCategorieTransport()) && input.getCategorieTransportId() == null) {
            throw new BadRequestException("Catégorie de transport obligatoire pour cet usage");
        }
        validateEligibilityCategory(categorie, usage);
    }

    private void validateSubscriptionDate(LocalDate subscriptionDate, LocalDate effectiveDate) {
        if (subscriptionDate == null || effectiveDate == null) {
            throw new BadRequestException("Les dates de souscription et d'effet sont obligatoires");
        }
        if (subscriptionDate.isAfter(effectiveDate)) {
            throw new BadRequestException("La date de souscription ne peut pas être postérieure à la date d'effet");
        }
    }

    private void validateEligibilityCategory(CategorieClient categorie, Usage usage) {
        if (categorie.getUsages() != null && !categorie.getUsages().isEmpty()
                && categorie.getUsages().stream().noneMatch(item -> item.getId().equals(usage.getId()))) {
            throw new BadRequestException("Usage incompatible avec la catégorie de l'assuré");
        }
    }

    private Vehicule saveVehicle(
            Contrat contrat,
            Vehicule target,
            CreateAssistanceAutomobileRequest.Vehicule input,
            Usage usage,
            LocalDate dateEcheance
    ) {
        Vehicule vehicule = target == null ? new Vehicule() : target;
        vehicule.setContrat(contrat);
        vehicule.setTypeVehicule(input.getTypeVehicule());
        vehicule.setUsage(usage);
        vehicule.setMarque(resolveMarque(input.getMarqueId(), input.getMarqueLibelle()));
        vehicule.setCarrosserie(resolveCarrosserie(input.getCarrosserieId(), input.getCarrosserieLibelle()));
        vehicule.setCategorieTransport(resolveCategorieTransport(input.getCategorieTransportId()));
        vehicule.setImmatriculation(input.getImmatriculation().trim());
        vehicule.setDatePremiereCirculation(input.getDatePremiereCirculation());
        vehicule.setDateExpirationCarteGrise(input.getDateExpirationCarteGrise());
        vehicule.setNombrePlaces(hasText(input.getNombrePlaces()) ? input.getNombrePlaces().trim() : null);
        vehicule.setDateEffet(contrat.getDateEffet());
        vehicule.setDateEcheance(dateEcheance);
        vehicule.setActif(true);
        vehicule.setRemorque(false);
        vehicule.setOrganismeCredit(false);
        return vehiculeRepository.save(vehicule);
    }

    private MouvementContrat saveMovement(
            Contrat contrat,
            MouvementContrat target,
            Pricing pricing,
            Contrat source
    ) {
        MouvementContrat mouvement = target == null ? new MouvementContrat() : target;
        if (target == null) {
            boolean renewal = source != null;
            String movementCode = renewal
                    ? MouvementContratService.CODE_RENOUVELLEMENT
                    : MouvementContratService.CODE_AFFAIRE_NOUVELLE;
            TypeMouvementContrat type = typeMouvementContratRepository
                    .findByCodeIgnoreCase(movementCode)
                    .orElseThrow(() -> new BadRequestException("Le type de mouvement " + movementCode + " n'est pas configuré"));
            mouvement.setAgence(contrat.getAgence());
            mouvement.setContrat(contrat);
            mouvement.setContratOrigine(source);
            mouvement.setTypeMouvement(type);
            mouvement.setStatut(StatutMouvementContrat.VALIDE);
            mouvement.setNumeroMouvement(renewal ? nextMovementNumber(source) : "1");
            mouvement.setDateValidation(LocalDate.now());
            mouvement.setNotes(renewal
                    ? "Renouvellement d'une assistance automobile autonome"
                    : "Création d'une assistance automobile autonome");
            mouvement.setPrimeNette(ZERO);
            mouvement.setTaxe(ZERO);
            mouvement.setTaxeParafiscale(ZERO);
            mouvement.setAccessoire(ZERO);
            mouvement.setCnpac(ZERO);
            mouvement.setPrimeTotale(ZERO);
        }
        mouvement.setDateEffet(contrat.getDateEffet());
        mouvement.setDateEcheance(pricing.dateEcheance());
        return mouvementContratRepository.save(mouvement);
    }

    private void saveVehicleSnapshot(MouvementContrat mouvement, Vehicule vehicule) {
        mouvementVehiculeRepository.save(MouvementVehicule.builder()
                .mouvementContrat(mouvement)
                .vehicule(vehicule)
                .nature(NatureSnapshotMouvement.AJOUT)
                .typeVehicule(vehicule.getTypeVehicule())
                .usage(vehicule.getUsage())
                .marque(vehicule.getMarque())
                .carrosserie(vehicule.getCarrosserie())
                .categorieTransport(vehicule.getCategorieTransport())
                .immatriculation(vehicule.getImmatriculation())
                .nombrePlaces(vehicule.getNombrePlaces())
                .datePremiereCirculation(vehicule.getDatePremiereCirculation())
                .dateExpirationCarteGrise(vehicule.getDateExpirationCarteGrise())
                .dateEffet(vehicule.getDateEffet())
                .dateEcheance(vehicule.getDateEcheance())
                .remorque(false)
                .organismeCredit(false)
                .build());
    }

    private AssistanceContrat saveAssistance(
            Contrat contrat,
            MouvementContrat mouvement,
            Vehicule vehicule,
            BrancheAssurance branche,
            CompagnieAssistance compagnie,
            ProduitAssistance produit,
            AssistanceContrat target,
            CreateAssistanceAutomobileRequest request,
            Pricing pricing,
            AssistanceContrat sourceAssistance
    ) {
        AssistanceContrat assistance = target == null ? new AssistanceContrat() : target;
        assistance.setBrancheAssurance(branche);
        assistance.setContrat(contrat);
        if (target == null) {
            assistance.setAssistanceOrigine(sourceAssistance);
        }
        assistance.setMouvementContrat(mouvement);
        assistance.setVehicule(vehicule);
        assistance.setCompagnieAssistance(compagnie);
        assistance.setProduitAssistance(produit);
        assistance.setTarifProduitAssistance(pricing.tarif());
        assistance.setProduit(produit.getLibelle());
        assistance.setLibelleReleve(optionalLabel(request.getLibelleReleve()));
        assistance.setDateSouscription(request.getDateSouscription());
        assistance.setDateEffet(request.getDateEffet());
        assistance.setDateEcheance(pricing.dateEcheance());
        assistance.setEcheanceCode(requireEcheanceCode(request.getEcheanceCode()));
        assistance.setDuree(request.getDureeMois());
        assistance.setUnite("MOIS");
        assistance.setNumeroDossier(contrat.getNumeroDossier());
        assistance.setNumeroPoliceContrat(request.getNumeroContrat().trim());
        assistance.setNumeroContratOuQuittance(request.getNumeroContrat().trim());
        assistance.setTypeQuittance(sourceAssistance != null ? "RENOUVELLEMENT" : "AFFAIRE_NOUVELLE");
        assistance.setCodePromo(normalizedPromo(request.getCodePromo()));
        assistance.setMontantReduction(pricing.reduction());
        assistance.setPrimeNette(pricing.net());
        assistance.setPrimeTotale(pricing.total());
        assistance.setActif(true);
        return assistanceContratRepository.save(assistance);
    }

    private void saveBillableElement(
            Contrat contrat,
            MouvementContrat mouvement,
            AssistanceContrat assistance,
            ElementFacturable target,
            ProduitAssistance produit,
            Pricing pricing
    ) {
        ElementFacturable element = target == null ? new ElementFacturable() : target;
        element.setAgence(contrat.getAgence());
        element.setContrat(contrat);
        element.setMouvementContrat(mouvement);
        element.setNature(NatureElementFacturable.ASSISTANCE);
        element.setStatut(StatutElementFacturable.A_QUITTANCER);
        element.setReferenceSource(String.valueOf(assistance.getId()));
        element.setLibelle("Assistance automobile - " + produit.getLibelle());
        element.setLibelleReleve(assistance.getLibelleReleve());
        element.setDateDebut(contrat.getDateEffet());
        element.setDateFin(pricing.dateEcheance());
        element.setPrimeNette(pricing.net());
        element.setTaxe(pricing.total().subtract(pricing.net()).max(ZERO));
        element.setTaxeParafiscale(ZERO);
        element.setAccessoire(ZERO);
        element.setCnpac(ZERO);
        element.setPrimeTotale(pricing.total());
        element.setActif(true);
        element = elementFacturableRepository.save(element);
        assistance.setElementFacturable(element);
        assistanceContratRepository.save(assistance);
    }

    private Client resolvePerson(Long agenceId, CreateAssistanceAutomobileRequest.Personne person, String role) {
        if (person == null) {
            throw new BadRequestException("Les informations du " + role + " sont obligatoires");
        }
        Client client;
        if (person.getClientId() != null) {
            client = clientRepository.findByAgenceIdAndId(agenceId, person.getClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client", person.getClientId()));
        } else {
            validateNewPerson(person.getClient(), role);
            client = clientService.createEntity(agenceId, person.getClient());
        }
        validatePersonProfile(client, role);
        return client;
    }

    private void validateNewPerson(CreateClientRequest request, String role) {
        if (request == null) {
            throw new BadRequestException("Sélectionnez ou renseignez le " + role);
        }
        if (request.getTypeClient() == TypeClient.PERSONNE_MORALE) {
            if (!hasText(request.getRaisonSociale()) || !hasText(request.getRc())) {
                throw new BadRequestException("La raison sociale et le RC du " + role + " sont obligatoires");
            }
            return;
        }
        if (request.getTypeClient() != TypeClient.PERSONNE_PHYSIQUE
                || (!hasText(request.getCin()) && !hasText(request.getPassport()))) {
            throw new BadRequestException("Le CIN ou le passeport du " + role + " est obligatoire");
        }
    }

    private void validatePersonProfile(Client client, String role) {
        if (client.getTypeClient() == TypeClient.PERSONNE_MORALE) {
            if (!hasText(client.getRaisonSociale()) || !hasText(client.getRc())
                    || !hasText(client.getAdresse()) || client.getVille() == null
                    || !hasText(client.getTelephone())) {
                throw new BadRequestException("Le profil du " + role
                        + " doit contenir la raison sociale, le RC, l'adresse et le téléphone");
            }
            return;
        }
        if (client.getTypeClient() != TypeClient.PERSONNE_PHYSIQUE
                || !hasText(client.getPrenom()) || !hasText(client.getNom())
                || (!hasText(client.getCin()) && !hasText(client.getPassport()))
                || client.getDateNaissance() == null
                || !hasText(client.getAdresse()) || client.getVille() == null
                || !hasText(client.getTelephone())) {
            throw new BadRequestException("Le profil du " + role
                    + " doit contenir le nom, le document d'identité, la naissance, l'adresse et le téléphone");
        }
    }

    private void linkClient(Contrat contrat, Client client, RoleClientContrat role) {
        ContratClient link = contratClientRepository.save(ContratClient.builder()
                .contrat(contrat)
                .client(client)
                .role(role)
                .principalPourRole(true)
                .build());
        contrat.getClients().add(link);
    }

    private Contrat createDraftContract(Long agenceId) {
        Agence agence = agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        BrancheAssurance branche = requireAssistanceBranch();
        return contratRepository.save(Contrat.builder()
                .agence(agence)
                .brancheAssurance(branche)
                .typeContrat(TypeContrat.PARTICULIER)
                .statut(StatutContrat.DRAFT)
                .nombreVehicules(0)
                .nombreRemorques(0)
                .assistance(true)
                .brouillon(true)
                .prospection(false)
                .build());
    }

    private Contrat requireDraftContract(Long agenceId, Long contratId) {
        Contrat draft = contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
        if (draft.getStatut() != StatutContrat.DRAFT || !Boolean.TRUE.equals(draft.getBrouillon())
                || draft.getBrancheAssurance() == null
                || !"ASSISTANCE".equalsIgnoreCase(draft.getBrancheAssurance().getCode())) {
            throw new BadRequestException("Ce dossier n'est pas un brouillon d'assistance modifiable");
        }
        AssistanceContrat assistance = assistanceContratRepository
                .findByContratIdAndActifTrueOrderByCreatedAtDesc(contratId)
                .stream()
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Le contexte du brouillon d'assistance est introuvable"));
        String type = assistance.getProduitAssistance() == null
                ? assistance.getProduit()
                : assistance.getProduitAssistance().getType();
        if (!"Assistance Automobile".equalsIgnoreCase(type)) {
            throw new BadRequestException("Le type du brouillon d'assistance ne correspond pas à cet écran");
        }
        return draft;
    }

    private void upsertDraftAssistance(Contrat draft, CompagnieAssistance compagnie) {
        AssistanceContrat assistance = assistanceContratRepository
                .findByContratIdAndActifTrueOrderByCreatedAtDesc(draft.getId())
                .stream()
                .findFirst()
                .orElseGet(() -> AssistanceContrat.builder()
                        .brancheAssurance(draft.getBrancheAssurance())
                        .contrat(draft)
                        .produit("Assistance Automobile")
                        .actif(true)
                        .build());
        assistance.setCompagnieAssistance(compagnie);
        assistanceContratRepository.save(assistance);
    }

    private Client requireDraftClient(Contrat draft, RoleClientContrat role, String label) {
        return contratClientRepository.findByContratIdAndRole(draft.getId(), role)
                .stream()
                .filter(link -> Boolean.TRUE.equals(link.getPrincipalPourRole()))
                .map(ContratClient::getClient)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Enregistrez d'abord le " + label));
    }

    private void replaceClientRole(Contrat draft, RoleClientContrat role, Client client) {
        List<ContratClient> existing = contratClientRepository.findByContratIdAndRole(draft.getId(), role);
        contratClientRepository.deleteAll(existing);
        contratClientRepository.flush();
        draft.getClients().removeIf(link -> link.getRole() == role);
        linkClient(draft, client, role);
    }

    private CompagnieAssistance requireCompany(Long id) {
        return compagnieAssistanceRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Compagnie d'assistance inactive ou introuvable"));
    }

    private ProduitAssistance requireProduct(CompagnieAssistance compagnie, Long id) {
        ProduitAssistance produit = produitAssistanceRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Produit d'assistance inactif ou introuvable"));
        if (produit.getCompagnieAssistance() == null
                || !compagnie.getId().equals(produit.getCompagnieAssistance().getId())) {
            throw new BadRequestException("Le produit ne correspond pas à la compagnie sélectionnée");
        }
        if (!TYPE_ASSISTANCE.equalsIgnoreCase(produit.getType())) {
            throw new BadRequestException("Le produit sélectionné n'est pas un produit Assistance Automobile");
        }
        return produit;
    }

    private BrancheAssurance requireAssistanceBranch() {
        return brancheAssuranceRepository.findByCodeIgnoreCase("ASSISTANCE")
                .orElseThrow(() -> new BadRequestException("La branche Assistance n'est pas configurée"));
    }

    private CategorieClient requireCategory(Long id) {
        return categorieClientRepository.findByIdWithUsages(id)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Catégorie client inactive ou introuvable"));
    }

    private String requireEcheanceCode(String value) {
        String normalized = echeanceService.normalizeCode(value);
        if (normalized == null) {
            throw new BadRequestException("Échéance invalide. Format attendu : JJ/MM");
        }
        return normalized;
    }

    private TypePayeurPrime resolvePayerType(CreateAssistanceAutomobileRequest request) {
        if (request.getTypePayeurPrime() == null) {
            return Boolean.TRUE.equals(request.getAssurePayeur())
                    ? TypePayeurPrime.TIERS_MANDATE
                    : TypePayeurPrime.SOUSCRIPTEUR;
        }
        if (request.getTypePayeurPrime() != TypePayeurPrime.SOUSCRIPTEUR
                && request.getTypePayeurPrime() != TypePayeurPrime.TIERS_MANDATE) {
            throw new BadRequestException("Type de payeur non supporté pour une assistance automobile");
        }
        return request.getTypePayeurPrime();
    }

    private Client resolvePayer(
            Long agenceId,
            CreateAssistanceAutomobileRequest request,
            TypePayeurPrime typePayeur,
            Client souscripteur,
            Client assure
    ) {
        if (typePayeur == TypePayeurPrime.SOUSCRIPTEUR) {
            return souscripteur;
        }
        if (request.getPayeurPrimeClientId() != null) {
            return clientRepository.findByAgenceIdAndId(agenceId, request.getPayeurPrimeClientId())
                    .orElseThrow(() -> new ResourceNotFoundException("Client payeur", request.getPayeurPrimeClientId()));
        }
        if (Boolean.TRUE.equals(request.getAssurePayeur())) {
            return assure;
        }
        throw new BadRequestException("Le payeur est obligatoire");
    }

    private Usage requireUsage(Long id) {
        return usageRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Usage véhicule inactif ou introuvable"));
    }

    private Marque resolveMarque(Long id, String customLabel) {
        if (id != null) {
            return marqueRepository.findById(id)
                    .filter(item -> Boolean.TRUE.equals(item.getActif()))
                    .orElseThrow(() -> new BadRequestException("Marque inactive ou introuvable"));
        }
        String label = customLabel == null ? "" : customLabel.trim();
        return marqueRepository.findByLibelleIgnoreCase(label)
                .orElseGet(() -> marqueRepository.save(Marque.builder().libelle(label).actif(true).build()));
    }

    private Carrosserie resolveCarrosserie(Long id, String customLabel) {
        if (id != null) {
            return carrosserieRepository.findById(id)
                    .filter(item -> Boolean.TRUE.equals(item.getActif()))
                    .orElseThrow(() -> new BadRequestException("Carrosserie inactive ou introuvable"));
        }
        if (!hasText(customLabel)) {
            return null;
        }
        String label = customLabel.trim();
        return carrosserieRepository.findByLibelleIgnoreCase(label)
                .orElseGet(() -> carrosserieRepository.save(Carrosserie.builder().libelle(label).actif(true).build()));
    }

    private CategorieTransport resolveCategorieTransport(Long id) {
        if (id == null) {
            return null;
        }
        return categorieTransportRepository.findById(id)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new BadRequestException("Catégorie de transport inactive ou introuvable"));
    }

    private void validateContractNumber(Long agenceId, Long contratId, String value) {
        String numero = value == null ? "" : value.trim();
        boolean exists = contratId == null
                ? contratRepository.existsByAgenceIdAndNumeroContrat(agenceId, numero)
                : contratRepository.existsByAgenceIdAndNumeroContratAndIdNot(agenceId, numero, contratId);
        if (exists) {
            throw new BadRequestException("Numéro de contrat déjà utilisé pour cette agence");
        }
    }

    private void assertStandaloneAutomobileAssistance(Contrat contrat) {
        if (contrat.getBrancheAssurance() == null
                || !"ASSISTANCE".equalsIgnoreCase(contrat.getBrancheAssurance().getCode())) {
            throw new BadRequestException("Ce dossier n'est pas une assistance autonome");
        }
    }

    private AssistanceContrat requireRenewableAssistance(Contrat source) {
        assertStandaloneAutomobileAssistance(source);
        if (source.getStatut() != StatutContrat.ACTIVE || Boolean.TRUE.equals(source.getRenouvele())) {
            throw new BadRequestException("Cette assistance a déjà été renouvelée ou n'est plus active");
        }
        return assistanceContratRepository.findByContratIdAndActifTrueOrderByCreatedAtDesc(source.getId())
                .stream()
                .filter(item -> item.getProduitAssistance() != null
                        && TYPE_ASSISTANCE.equalsIgnoreCase(item.getProduitAssistance().getType()))
                .findFirst()
                .orElseThrow(() -> new BadRequestException(
                        "Aucune assistance automobile active n'est liée à ce dossier"
                ));
    }

    private void validateRenewalPeriod(AssistanceContrat source, LocalDate newEffectiveDate) {
        if (source.getDateEcheance() == null) {
            throw new BadRequestException("La date d'échéance de l'assistance d'origine est manquante");
        }
        if (newEffectiveDate == null || !newEffectiveDate.isAfter(source.getDateEcheance())) {
            throw new BadRequestException("La nouvelle date d'effet doit être postérieure à l'échéance actuelle");
        }
    }

    private String nextMovementNumber(Contrat source) {
        int highest = 0;
        int count = 0;
        Set<Long> visited = new HashSet<>();
        Contrat current = source;
        while (current != null && current.getId() != null && visited.add(current.getId())) {
            List<MouvementContrat> movements = mouvementContratRepository
                    .findByContratIdOrderByCreatedAtDesc(current.getId()).stream()
                    .filter(item -> item.getStatut() != StatutMouvementContrat.ANNULE)
                    .toList();
            count += movements.size();
            highest = Math.max(highest, movements.stream()
                    .map(MouvementContrat::getNumeroMouvement)
                    .map(this::positiveMovementNumber)
                    .max(Integer::compareTo)
                    .orElse(0));
            current = current.getContratOrigine();
        }
        return String.valueOf(Math.max(highest, count) + 1);
    }

    private int positiveMovementNumber(String value) {
        if (value == null || !value.trim().matches("\\d+")) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private AssistanceAutomobileQuoteResponse toQuote(Pricing pricing) {
        return AssistanceAutomobileQuoteResponse.builder()
                .tarifId(pricing.tarif().getId())
                .dateEcheance(pricing.dateEcheance())
                .primeNette(pricing.net())
                .primeTotale(pricing.total())
                .montantReduction(pricing.reduction())
                .build();
    }

    private AssistanceAutomobileCreationResponse toCreationResponse(
            Contrat contrat,
            AssistanceContrat assistance,
            Client souscripteur,
            Pricing pricing
    ) {
        return AssistanceAutomobileCreationResponse.builder()
                .contratId(contrat.getId())
                .assistanceId(assistance.getId())
                .codeClient(souscripteur.getCodeClient())
                .numeroDossier(contrat.getNumeroDossier())
                .numeroContrat(contrat.getNumeroContrat())
                .dateEffet(contrat.getDateEffet())
                .dateEcheance(pricing.dateEcheance())
                .primeNette(pricing.net())
                .primeTotale(pricing.total())
                .montantReduction(pricing.reduction())
                .build();
    }

    private BigDecimal money(BigDecimal value) {
        return value.setScale(2, RoundingMode.HALF_UP);
    }

    private String normalizedPromo(String value) {
        return value == null || value.isBlank() ? null : value.trim().toUpperCase(Locale.ROOT);
    }

    private String optionalLabel(String value) {
        return value == null || value.isBlank() ? null : value.trim().replaceAll("[\\r\\n]+", " ");
    }

    private String durationLabel(int months) {
        if (months == 12) {
            return "1 an";
        }
        if (months > 12 && months % 12 == 0) {
            return (months / 12) + " ans";
        }
        return months + " mois";
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
    }

    private record Pricing(
            TarifProduitAssistance tarif,
            LocalDate dateEcheance,
            BigDecimal net,
            BigDecimal total,
            BigDecimal reduction
    ) {
    }
}
