package com.assurance.service;

import com.assurance.dto.request.MouvementContratRequest;
import com.assurance.dto.response.QuittanceResponse;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.Garantie;
import com.assurance.entity.LigneGrilleTarifaire;
import com.assurance.entity.LigneQuittance;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementGarantie;
import com.assurance.entity.MouvementRemorque;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.Quittance;
import com.assurance.entity.Remorque;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.CategorieMouvementContrat;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.StatutContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.enums.TypeContrat;
import com.assurance.enums.TypeImpactMouvement;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.LigneQuittanceRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.MouvementGarantieRepository;
import com.assurance.repository.MouvementRemorqueRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import com.assurance.repository.QuittanceRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.HashSet;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class MouvementContratService {

    public static final String CODE_AFFAIRE_NOUVELLE = "AN";
    public static final String CODE_RENOUVELLEMENT = "REN";

    private final TypeMouvementContratRepository typeMouvementContratRepository;
    private final ContratRepository contratRepository;
    private final MouvementContratRepository mouvementContratRepository;
    private final MouvementVehiculeRepository mouvementVehiculeRepository;
    private final MouvementRemorqueRepository mouvementRemorqueRepository;
    private final MouvementGarantieRepository mouvementGarantieRepository;
    private final QuittanceRepository quittanceRepository;
    private final LigneQuittanceRepository ligneQuittanceRepository;
    private final AttestationStockService attestationStockService;
    private final QuittanceProductionService quittanceProductionService;
    private final QuittanceCalculService quittanceCalculService;
    private final ElementFacturableCibleService elementFacturableCibleService;

    @Transactional
    public MouvementContrat creerAffaireNouvelle(
            Contrat contrat,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties
    ) {
        return creerAffaireNouvelle(contrat, vehicules, remorques, garanties, null);
    }

    @Transactional
    public MouvementContrat creerAffaireNouvelle(
            Contrat contrat,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties,
            QuittanceCalculService.Resultat quittanceManuelle
    ) {
        return creerMouvementInitial(contrat, null, CODE_AFFAIRE_NOUVELLE, vehicules, remorques, garanties, quittanceManuelle);
    }

    @Transactional(readOnly = true)
    public void assertCorrectionInitialeAutorisee(Contrat contrat) {
        resolveMouvementInitialCorrigeable(contrat);
    }

    @Transactional
    public MouvementContrat preparerCorrectionInitiale(Contrat contrat) {
        MouvementContrat mouvement = resolveMouvementInitialCorrigeable(contrat);
        if (mouvement == null) {
            return null;
        }
        mouvementVehiculeRepository.deleteByMouvementContratId(mouvement.getId());
        mouvementRemorqueRepository.deleteByMouvementContratId(mouvement.getId());
        mouvementGarantieRepository.deleteByMouvementContratId(mouvement.getId());
        mouvementVehiculeRepository.flush();
        mouvementRemorqueRepository.flush();
        mouvementGarantieRepository.flush();
        mouvement.getVehicules().clear();
        mouvement.getRemorques().clear();
        mouvement.getGaranties().clear();
        return mouvement;
    }

    @Transactional
    public MouvementContrat rafraichirCorrectionInitiale(
            Contrat contrat,
            MouvementContrat mouvement,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties,
            QuittanceCalculService.Resultat quittanceManuelle
    ) {
        if (mouvement == null) {
            return creerAffaireNouvelle(contrat, vehicules, remorques, garanties, quittanceManuelle);
        }
        TypeMouvementContrat typeMouvement = mouvement.getTypeMouvement();
        QuittanceCalculService.Resultat montants = quittanceManuelle != null
                ? quittanceManuelle
                : calculerMontants(contrat, typeMouvement, garanties, vehicules, remorques);

        mouvement.setNumeroMouvement("1");
        mouvement.setDateEffet(contrat.getDateEffet());
        mouvement.setDateEcheance(contrat.getDateEcheance());
        mouvement.setPrimeNette(montants.primeNette());
        mouvement.setTaxe(montants.taxe());
        mouvement.setTaxeParafiscale(montants.taxeParafiscale());
        mouvement.setAccessoire(montants.accessoire());
        mouvement.setCnpac(montants.cnpac());
        mouvement.setPrimeTotale(montants.primeTotale());
        mouvement = mouvementContratRepository.save(mouvement);

        snapshotVehicules(mouvement, vehicules, NatureSnapshotMouvement.AJOUT);
        snapshotRemorques(mouvement, remorques, NatureSnapshotMouvement.AJOUT);
        snapshotGaranties(mouvement, garanties, NatureSnapshotMouvement.AJOUT);

        if (Boolean.TRUE.equals(typeMouvement.getGenereQuittance())) {
            quittanceProductionService.remplacerPourMouvement(contrat, mouvement, typeMouvement, montants, garanties, vehicules, remorques);
        }
        return mouvement;
    }

    @Transactional
    public MouvementContrat creerRenouvellement(
            Contrat contrat,
            Contrat contratOrigine,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties
    ) {
        return creerMouvementInitial(contrat, contratOrigine, CODE_RENOUVELLEMENT, vehicules, remorques, garanties, null);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse previsualiserQuittance(Long agenceId, Long contratId, MouvementContratRequest request) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        TypeMouvementContrat typeMouvement = resolveTypeMouvement(request.getCodeTypeMouvement(), contrat.getTypeContrat());
        refuserPrevisualisationGeneriqueSiPayloadSpecialiseRequis(typeMouvement);
        List<ContratGarantie> garantiesActives = activeGaranties(contrat);
        List<Vehicule> vehiculesActifs = activeVehicules(contrat);
        List<Remorque> remorquesActives = activeRemorques(contrat);
        QuittanceCalculService.Resultat calcul = calculerMontants(
                contrat,
                typeMouvement,
                garantiesActives,
                vehiculesActifs,
                remorquesActives
        );
        return toPreviewResponse(contrat, typeMouvement, request, calcul, garantiesActives, vehiculesActifs, remorquesActives);
    }

    @Transactional(readOnly = true)
    public TypeMouvementContrat resolveTypeMouvementPourContrat(String code, TypeContrat typeContrat) {
        return resolveTypeMouvement(code, typeContrat);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse previsualiserMouvementSpecialise(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            MouvementContratRequest request,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        QuittanceCalculService.Resultat calcul = calculerMontants(contrat, typeMouvement, garanties, vehicules, remorques);
        return toPreviewResponse(contrat, typeMouvement, request, calcul, garanties, vehicules, remorques);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse previsualiserMouvementSpecialise(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            MouvementContratRequest request,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            QuittanceCalculService.Resultat calcul
    ) {
        return toPreviewResponse(contrat, typeMouvement, request, calcul, garanties, vehicules, remorques);
    }

    @Transactional(readOnly = true)
    public QuittanceResponse previsualiserMouvementSpecialise(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            MouvementContratRequest request,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            QuittanceCalculService.Resultat calcul,
            List<ContratGarantie> garantiesAffichees
    ) {
        return toPreviewResponse(contrat, typeMouvement, request, calcul, garanties, vehicules, remorques, garantiesAffichees);
    }

    @Transactional
    public QuittanceResponse creerMouvementSpecialise(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            MouvementContratRequest request,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            NatureSnapshotMouvement snapshotNature
    ) {
        QuittanceCalculService.Resultat montants = calculerMontants(contrat, typeMouvement, garanties, vehicules, remorques);
        return creerMouvementSpecialise(contrat, typeMouvement, request, garanties, vehicules, remorques, snapshotNature, montants);
    }

    @Transactional
    public QuittanceResponse creerMouvementSpecialise(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            MouvementContratRequest request,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            NatureSnapshotMouvement snapshotNature,
            QuittanceCalculService.Resultat montants
    ) {
        LocalDate dateEffet = request.getDateEffet() != null ? request.getDateEffet() : contrat.getDateEffet();
        LocalDate dateEcheance = request.getDateEcheance() != null ? request.getDateEcheance() : contrat.getDateEcheance();

        MouvementContrat mouvement = mouvementContratRepository.save(MouvementContrat.builder()
                .agence(contrat.getAgence())
                .contrat(contrat)
                .typeMouvement(typeMouvement)
                .statut(StatutMouvementContrat.VALIDE)
                .numeroMouvement(prochainNumeroMouvement(contrat))
                .dateEffet(dateEffet)
                .dateEcheance(dateEcheance)
                .dateValidation(LocalDate.now())
                .primeNette(montants.primeNette())
                .taxe(montants.taxe())
                .taxeParafiscale(montants.taxeParafiscale())
                .accessoire(montants.accessoire())
                .cnpac(montants.cnpac())
                .primeTotale(montants.primeTotale())
                .notes(request.getNotes())
                .build());
        contrat.getMouvements().add(mouvement);

        snapshotVehicules(mouvement, vehicules, snapshotNature);
        snapshotRemorques(mouvement, remorques, snapshotNature);
        snapshotGaranties(mouvement, garanties, snapshotNature);

        if (Boolean.TRUE.equals(typeMouvement.getConsommeAttestation())) {
            consommerAttestations(contrat, mouvement, vehicules, remorques);
        }

        Quittance quittance = null;
        if (Boolean.TRUE.equals(typeMouvement.getGenereQuittance())) {
            quittance = quittanceProductionService.genererPourMouvement(
                    contrat,
                    mouvement,
                    typeMouvement,
                    montants,
                    garanties,
                    vehicules,
                    remorques
            );
        }

        if (Boolean.TRUE.equals(typeMouvement.getClotureContrat())) {
            contrat.setStatut(StatutContrat.CANCELLED);
            contratRepository.save(contrat);
        }
        return quittance == null ? toPreviewResponse(contrat, typeMouvement, request, montants, garanties, vehicules, remorques) : toResponse(quittance);
    }

    @Transactional
    public QuittanceResponse creerMouvement(Long agenceId, Long contratId, MouvementContratRequest request) {
        Contrat contrat = resolveContrat(agenceId, contratId);
        TypeMouvementContrat typeMouvement = resolveTypeMouvement(request.getCodeTypeMouvement(), contrat.getTypeContrat());
        refuserCreationGeneriqueSiPayloadSpecialiseRequis(typeMouvement);

        QuittanceCalculService.Resultat montants = calculerMontants(
                contrat,
                typeMouvement,
                activeGaranties(contrat),
                activeVehicules(contrat),
                activeRemorques(contrat)
        );
        LocalDate dateEffet = request.getDateEffet() != null ? request.getDateEffet() : contrat.getDateEffet();
        LocalDate dateEcheance = request.getDateEcheance() != null ? request.getDateEcheance() : contrat.getDateEcheance();

        MouvementContrat mouvement = mouvementContratRepository.save(MouvementContrat.builder()
                .agence(contrat.getAgence())
                .contrat(contrat)
                .typeMouvement(typeMouvement)
                .statut(StatutMouvementContrat.VALIDE)
                .numeroMouvement(prochainNumeroMouvement(contrat))
                .dateEffet(dateEffet)
                .dateEcheance(dateEcheance)
                .dateValidation(LocalDate.now())
                .primeNette(montants.primeNette())
                .taxe(montants.taxe())
                .taxeParafiscale(montants.taxeParafiscale())
                .accessoire(montants.accessoire())
                .cnpac(montants.cnpac())
                .primeTotale(montants.primeTotale())
                .notes(request.getNotes())
                .build());
        contrat.getMouvements().add(mouvement);

        NatureSnapshotMouvement snapshotNature = typeMouvement.getTypeImpact() == TypeImpactMouvement.RETOUR_PRIME
                ? NatureSnapshotMouvement.RETRAIT
                : NatureSnapshotMouvement.COURANT;
        List<Vehicule> vehiculesActifs = activeVehicules(contrat);
        List<Remorque> remorquesActives = activeRemorques(contrat);
        List<ContratGarantie> garantiesActives = activeGaranties(contrat);
        snapshotVehicules(mouvement, vehiculesActifs, snapshotNature);
        snapshotRemorques(mouvement, remorquesActives, snapshotNature);
        snapshotGaranties(mouvement, garantiesActives, snapshotNature);

        Quittance quittance = null;
        if (Boolean.TRUE.equals(typeMouvement.getGenereQuittance())) {
            quittance = quittanceProductionService.genererPourMouvement(
                    contrat,
                    mouvement,
                    typeMouvement,
                    garantiesActives,
                    vehiculesActifs,
                    remorquesActives
            );
        }

        if (Boolean.TRUE.equals(typeMouvement.getClotureContrat())) {
            contrat.setStatut(StatutContrat.CANCELLED);
            contratRepository.save(contrat);
        }
        return quittance == null ? toPreviewResponse(contrat, typeMouvement, request, montants, garantiesActives, vehiculesActifs, remorquesActives) : toResponse(quittance);
    }

    @Transactional(readOnly = true)
    public List<QuittanceResponse> listQuittances(Long agenceId, Long contratId) {
        resolveContrat(agenceId, contratId);
        return quittanceRepository.findByContratIdOrderByCreatedAtDesc(contratId).stream()
                .map(this::toResponse)
                .toList();
    }

    private MouvementContrat creerMouvementInitial(
            Contrat contrat,
            Contrat contratOrigine,
            String codeTypeMouvement,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garanties,
            QuittanceCalculService.Resultat quittanceManuelle
    ) {
        TypeMouvementContrat typeMouvement = resolveTypeMouvement(codeTypeMouvement, contrat.getTypeContrat());
        QuittanceCalculService.Resultat montants = quittanceManuelle != null ? quittanceManuelle : calculerMontants(contrat, typeMouvement, garanties, vehicules, remorques);

        MouvementContrat mouvement = mouvementContratRepository.save(MouvementContrat.builder()
                .agence(contrat.getAgence())
                .contrat(contrat)
                .contratOrigine(contratOrigine)
                .typeMouvement(typeMouvement)
                .statut(StatutMouvementContrat.VALIDE)
                .numeroMouvement("1")
                .dateEffet(contrat.getDateEffet())
                .dateEcheance(contrat.getDateEcheance())
                .dateValidation(LocalDate.now())
                .primeNette(montants.primeNette())
                .taxe(montants.taxe())
                .taxeParafiscale(montants.taxeParafiscale())
                .accessoire(montants.accessoire())
                .cnpac(montants.cnpac())
                .primeTotale(montants.primeTotale())
                .notes(typeMouvement.getLibelle() + " cree automatiquement avec le contrat")
                .build());
        contrat.getMouvements().add(mouvement);

        snapshotVehicules(mouvement, vehicules, NatureSnapshotMouvement.AJOUT);
        snapshotRemorques(mouvement, remorques, NatureSnapshotMouvement.AJOUT);
        snapshotGaranties(mouvement, garanties, NatureSnapshotMouvement.AJOUT);
        consommerAttestations(contrat, mouvement, vehicules, remorques);

        if (Boolean.TRUE.equals(typeMouvement.getGenereQuittance())) {
            if (quittanceManuelle != null) {
                quittanceProductionService.genererPourMouvement(contrat, mouvement, typeMouvement, quittanceManuelle);
            } else {
                quittanceProductionService.genererPourMouvement(contrat, mouvement, typeMouvement, garanties, vehicules, remorques);
            }
        }

        return mouvement;
    }

    private void consommerAttestations(
            Contrat contrat,
            MouvementContrat mouvement,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        Set<String> numerosConsommes = new HashSet<>();
        boolean hasVehicules = vehicules != null && !vehicules.isEmpty();
        boolean hasRemorques = remorques != null && !remorques.isEmpty();

        if (!hasVehicules && !hasRemorques) {
            consommerAttestationCible(contrat, mouvement, contrat.getNumeroAttestation(), contrat.getUsage(), null, null, numerosConsommes);
            return;
        }

        for (Vehicule vehicule : vehicules == null ? List.<Vehicule>of() : vehicules) {
            String numero = hasText(vehicule.getNumeroAttestation()) ? vehicule.getNumeroAttestation() : contrat.getNumeroAttestation();
            consommerAttestationCible(contrat, mouvement, numero, vehicule.getUsage(), vehicule, null, numerosConsommes);
            if (!hasText(vehicule.getNumeroAttestation()) && hasText(numero)) {
                vehicule.setNumeroAttestation(attestationStockService.normaliserNumero(numero, contrat, vehicule.getUsage()));
            }
        }

        for (Remorque remorque : remorques == null ? List.<Remorque>of() : remorques) {
            consommerAttestationCible(contrat, mouvement, remorque.getNumeroAttestation(), remorque.getUsage(), null, remorque, numerosConsommes);
        }

        if (hasText(contrat.getNumeroAttestation())) {
            contrat.setNumeroAttestation(attestationStockService.normaliserNumero(contrat.getNumeroAttestation(), contrat, contrat.getUsage()));
        }
    }

    private void consommerAttestationCible(
            Contrat contrat,
            MouvementContrat mouvement,
            String numero,
            Usage usage,
            Vehicule vehicule,
            Remorque remorque,
            Set<String> numerosConsommes
    ) {
        String numeroNormalise = attestationStockService.normaliserNumero(numero, contrat, usage);
        if (vehicule != null && hasText(numeroNormalise)) {
            vehicule.setNumeroAttestation(numeroNormalise);
        }
        if (remorque != null && hasText(numeroNormalise)) {
            remorque.setNumeroAttestation(numeroNormalise);
        }
        if (!attestationStockService.doitConsommer(contrat, mouvement.getTypeMouvement(), usage)) {
            return;
        }
        String dedupeKey = numeroNormalise == null ? "" : numeroNormalise.trim().toUpperCase(Locale.ROOT);
        if (hasText(dedupeKey) && !numerosConsommes.add(dedupeKey)) {
            return;
        }
        attestationStockService.consommerPourMouvement(contrat, mouvement, numeroNormalise, usage, vehicule, remorque);
    }

    private TypeMouvementContrat resolveTypeMouvement(String code, TypeContrat typeContrat) {
        TypeMouvementContrat typeMouvement = typeMouvementContratRepository.findByCodeIgnoreCase(code)
                .orElseGet(() -> typeMouvementContratRepository.save(defaultTypeMouvement(code)));
        if (!Boolean.TRUE.equals(typeMouvement.getActif())) {
            throw new BadRequestException("Le type de mouvement " + code + " est inactif");
        }
        if (!typeMouvement.getTypesContratAutorises().isEmpty()
                && !typeMouvement.getTypesContratAutorises().contains(typeContrat)) {
            throw new BadRequestException("Le type de mouvement " + code + " n'est pas autorise pour " + typeContrat);
        }
        return typeMouvement;
    }

    private Contrat resolveContrat(Long agenceId, Long contratId) {
        return contratRepository.findByAgenceIdAndId(agenceId, contratId)
                .orElseThrow(() -> new ResourceNotFoundException("Contrat", contratId));
    }

    private MouvementContrat resolveMouvementInitialCorrigeable(Contrat contrat) {
        List<MouvementContrat> mouvementsValides = mouvementContratRepository.findByContratIdOrderByCreatedAtDesc(contrat.getId()).stream()
                .filter(mouvement -> mouvement.getStatut() == StatutMouvementContrat.VALIDE)
                .toList();
        if (mouvementsValides.isEmpty()) {
            return null;
        }
        for (MouvementContrat mouvement : mouvementsValides) {
            String code = mouvement.getTypeMouvement() == null || mouvement.getTypeMouvement().getCode() == null
                    ? ""
                    : mouvement.getTypeMouvement().getCode().trim().toUpperCase(Locale.ROOT);
            if (!CODE_AFFAIRE_NOUVELLE.equals(code) && !CODE_RENOUVELLEMENT.equals(code)) {
                throw new BadRequestException("Ce contrat a deja des mouvements. Supprimez ou annulez les avenants/mouvements avant de corriger l'affaire nouvelle.");
            }
        }
        if (mouvementsValides.size() > 1) {
            throw new BadRequestException("Ce contrat a plusieurs mouvements initiaux. Corrigez-le via avenant ou annulez les mouvements excedentaires.");
        }
        return mouvementsValides.get(0);
    }

    private void refuserCreationGeneriqueSiPayloadSpecialiseRequis(TypeMouvementContrat typeMouvement) {
        boolean payloadSpecialiseRequis = Boolean.TRUE.equals(typeMouvement.getConsommeAttestation())
                || Boolean.TRUE.equals(typeMouvement.getModifieVehicule())
                || Boolean.TRUE.equals(typeMouvement.getModifieRemorque())
                || Boolean.TRUE.equals(typeMouvement.getGarantiesEditables());
        if (payloadSpecialiseRequis) {
            throw new BadRequestException("Le mouvement " + typeMouvement.getCode() + " exige une API specialisee pour conserver correctement les vehicules, remorques, garanties et attestations");
        }
    }

    private void refuserPrevisualisationGeneriqueSiPayloadSpecialiseRequis(TypeMouvementContrat typeMouvement) {
        boolean differentielSansPayload = typeMouvement.getTypeImpact() == TypeImpactMouvement.DIFFERENTIEL;
        boolean recalculNormalSpecialise = typeMouvement.getTypeImpact() == TypeImpactMouvement.NORMAL
                && (Boolean.TRUE.equals(typeMouvement.getModifieVehicule())
                || Boolean.TRUE.equals(typeMouvement.getModifieRemorque())
                || Boolean.TRUE.equals(typeMouvement.getGarantiesEditables()));
        if (differentielSansPayload || recalculNormalSpecialise) {
            throw new BadRequestException("La previsualisation du mouvement " + typeMouvement.getCode() + " exige une API specialisee avec les valeurs avant/apres");
        }
    }

    private TypeMouvementContrat defaultTypeMouvement(String code) {
        if (CODE_RENOUVELLEMENT.equalsIgnoreCase(code)) {
            return TypeMouvementContrat.builder()
                    .code(CODE_RENOUVELLEMENT)
                    .libelle("Renouvellement")
                    .categorie(CategorieMouvementContrat.RENOUVELLEMENT)
                    .typeImpact(TypeImpactMouvement.NORMAL)
                    .typesContratAutorises(new LinkedHashSet<>(Set.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION, TypeContrat.FLOTTE)))
                    .modifieGaranties(true)
                    .garantiesEditables(true)
                    .modifieVehicule(true)
                    .modifieRemorque(true)
                    .genereQuittance(true)
                    .consommeAttestation(true)
                    .autoriseAssistance(true)
                    .autoriseCarteVerte(true)
                    .renouvelleContrat(true)
                    .ordreAffichage(20)
                    .actif(true)
                    .build();
        }
        return TypeMouvementContrat.builder()
                .code(CODE_AFFAIRE_NOUVELLE)
                .libelle("Affaire nouvelle")
                .categorie(CategorieMouvementContrat.AFFAIRE_NOUVELLE)
                .typeImpact(TypeImpactMouvement.NORMAL)
                .typesContratAutorises(new LinkedHashSet<>(Set.of(TypeContrat.PARTICULIER, TypeContrat.CONVENTION, TypeContrat.FLOTTE)))
                .genereQuittance(true)
                .consommeAttestation(true)
                .autoriseAssistance(true)
                .autoriseCarteVerte(true)
                .ordreAffichage(10)
                .actif(true)
                .build();
    }

    private void snapshotVehicules(MouvementContrat mouvement, List<Vehicule> vehicules, NatureSnapshotMouvement nature) {
        for (Vehicule vehicule : vehicules == null ? List.<Vehicule>of() : vehicules) {
            MouvementVehicule snapshot = mouvementVehiculeRepository.save(MouvementVehicule.builder()
                    .mouvementContrat(mouvement)
                    .vehicule(vehicule)
                    .nature(nature)
                    .typeVehicule(vehicule.getTypeVehicule())
                    .usage(vehicule.getUsage())
                    .marque(vehicule.getMarque())
                    .carrosserie(vehicule.getCarrosserie())
                    .categorieTransport(vehicule.getCategorieTransport())
                    .immatriculation(vehicule.getImmatriculation())
                    .immatriculationProvisoire(vehicule.getImmatriculationProvisoire())
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
                    .numeroAttestation(vehicule.getNumeroAttestation())
                    .coefficientProrata(vehicule.getCoefficientProrata())
                    .valeurVenale(vehicule.getValeurVenale())
                    .valeurNeuf(vehicule.getValeurNeuf())
                    .valeurGlace(vehicule.getValeurGlace())
                    .organismeCredit(vehicule.getOrganismeCredit())
                    .nomOrganismeCredit(vehicule.getNomOrganismeCredit())
                    .montantCredit(vehicule.getMontantCredit())
                    .dateFinCredit(vehicule.getDateFinCredit())
                    .build());
            mouvement.getVehicules().add(snapshot);
        }
    }

    private void snapshotRemorques(MouvementContrat mouvement, List<Remorque> remorques, NatureSnapshotMouvement nature) {
        for (Remorque remorque : remorques == null ? List.<Remorque>of() : remorques) {
            MouvementRemorque snapshot = mouvementRemorqueRepository.save(MouvementRemorque.builder()
                    .mouvementContrat(mouvement)
                    .remorque(remorque)
                    .nature(nature)
                    .usage(remorque.getUsage())
                    .marque(remorque.getMarque())
                    .immatriculation(remorque.getImmatriculation())
                    .ptc(remorque.getPtc())
                    .dateMiseEnCirculation(remorque.getDateMiseEnCirculation())
                    .dateEffet(remorque.getDateEffet())
                    .dateEcheance(remorque.getDateEcheance())
                    .crm(remorque.getCrm())
                    .numeroAttestation(remorque.getNumeroAttestation())
                    .coefficientProrata(remorque.getCoefficientProrata())
                    .valeurAssuree(remorque.getValeurAssuree())
                    .build());
            mouvement.getRemorques().add(snapshot);
        }
    }

    private void snapshotGaranties(MouvementContrat mouvement, List<ContratGarantie> garanties, NatureSnapshotMouvement nature) {
        for (ContratGarantie garantie : garanties == null ? List.<ContratGarantie>of() : garanties) {
            MouvementGarantie snapshot = mouvementGarantieRepository.save(MouvementGarantie.builder()
                    .mouvementContrat(mouvement)
                    .contratGarantie(garantie)
                    .garantie(garantie.getGarantie())
                    .vehicule(garantie.getVehicule())
                    .remorque(garantie.getRemorque())
                    .client(garantie.getClient())
                    .ligneGrilleTarifaire(garantie.getLigneGrilleTarifaire())
                    .nature(nature)
                    .modeSelectionne(garantie.getModeSelectionne())
                    .sourceValeurSelectionnee(garantie.getSourceValeurSelectionnee())
                    .formuleGarantiePersonne(garantie.getFormuleGarantiePersonne())
                    .valeurVenale(garantie.getValeurVenale())
                    .valeurNeuf(garantie.getValeurNeuf())
                    .valeurGlace(garantie.getValeurGlace())
                    .formule(garantie.getFormule())
                    .montantDeces(garantie.getMontantDeces())
                    .montantInvalidite(garantie.getMontantInvalidite())
                    .montantFraisMedicaux(garantie.getMontantFraisMedicaux())
                    .montantFraisHospitalisation(garantie.getMontantFraisHospitalisation())
                    .montantFraisFuneraires(garantie.getMontantFraisFuneraires())
                    .montantFraisChirurgie(garantie.getMontantFraisChirurgie())
                    .accessoire(garantie.getAccessoire())
                    .capital(garantie.getCapital())
                    .taux(garantie.getTaux())
                    .prime(garantie.getPrime())
                    .tauxFranchise(garantie.getTauxFranchise())
                    .franchiseMinimale(garantie.getFranchiseMinimale())
                    .build());
            mouvement.getGaranties().add(snapshot);
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private String prochainNumeroMouvement(Contrat contrat) {
        List<MouvementContrat> mouvements = mouvementContratRepository.findByContratIdOrderByCreatedAtDesc(contrat.getId());
        int plusGrandNumero = mouvements.stream()
                .map(MouvementContrat::getNumeroMouvement)
                .map(this::numeroMouvementPositif)
                .max(Integer::compareTo)
                .orElse(0);
        return String.valueOf(Math.max(plusGrandNumero, mouvements.size()) + 1);
    }

    private int numeroMouvementPositif(String value) {
        if (!hasText(value) || !value.trim().matches("\\d+")) {
            return 0;
        }
        try {
            return Math.max(0, Integer.parseInt(value.trim()));
        } catch (NumberFormatException ignored) {
            return 0;
        }
    }

    private QuittanceCalculService.Resultat calculerMontants(
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

    private QuittanceResponse toResponse(Quittance quittance) {
        List<LigneQuittance> lignes = ligneQuittanceRepository.findByQuittanceIdOrderByOrdreAsc(quittance.getId());
        return QuittanceResponse.builder()
                .id(quittance.getId())
                .contratId(quittance.getContrat() != null ? quittance.getContrat().getId() : null)
                .numeroContrat(quittance.getContrat() != null ? quittance.getContrat().getNumeroContrat() : null)
                .mouvementContratId(quittance.getMouvementContrat() != null ? quittance.getMouvementContrat().getId() : null)
                .codeMouvement(quittance.getMouvementContrat() != null && quittance.getMouvementContrat().getTypeMouvement() != null ? quittance.getMouvementContrat().getTypeMouvement().getCode() : null)
                .typeImpactMouvement(quittance.getMouvementContrat() != null && quittance.getMouvementContrat().getTypeMouvement() != null && quittance.getMouvementContrat().getTypeMouvement().getTypeImpact() != null ? quittance.getMouvementContrat().getTypeMouvement().getTypeImpact().name() : null)
                .elementFacturableId(quittance.getElementFacturable() != null ? quittance.getElementFacturable().getId() : null)
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
                .lignes(lignes.stream().map(this::toLigneResponse).toList())
                .targetSummaries(elementFacturableCibleService.listByElementFacturable(
                        quittance.getElementFacturable() != null ? quittance.getElementFacturable().getId() : null
                ))
                .build();
    }

    private QuittanceResponse toPreviewResponse(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            MouvementContratRequest request,
            QuittanceCalculService.Resultat calcul,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques
    ) {
        return toPreviewResponse(contrat, typeMouvement, request, calcul, garanties, vehicules, remorques, null);
    }

    private QuittanceResponse toPreviewResponse(
            Contrat contrat,
            TypeMouvementContrat typeMouvement,
            MouvementContratRequest request,
            QuittanceCalculService.Resultat calcul,
            List<ContratGarantie> garanties,
            List<Vehicule> vehicules,
            List<Remorque> remorques,
            List<ContratGarantie> garantiesAffichees
    ) {
        List<ContratGarantie> garantiesBreakdown = garantiesAffichees != null ? garantiesAffichees : garanties;
        return QuittanceResponse.builder()
                .contratId(contrat.getId())
                .numeroContrat(contrat.getNumeroContrat())
                .codeMouvement(typeMouvement.getCode())
                .typeImpactMouvement(typeMouvement.getTypeImpact() != null ? typeMouvement.getTypeImpact().name() : null)
                .type(typeMouvement.getCode())
                .categorie("TOTAL")
                .globale(true)
                .dateDebut(request.getDateEffet() != null ? request.getDateEffet() : contrat.getDateEffet())
                .dateFin(request.getDateEcheance() != null ? request.getDateEcheance() : contrat.getDateEcheance())
                .primeNette(calcul.primeNette())
                .taxe(calcul.taxe())
                .taxeParafiscale(calcul.taxeParafiscale())
                .accessoire(calcul.accessoire())
                .cnpac(calcul.cnpac())
                .primeTotale(calcul.primeTotale())
                .lignes(calcul.lignes().stream().map(this::toQuittanceLigneResponse).toList())
                .garanties(garantiesAffichees != null || shouldExposeFullBreakdown(typeMouvement)
                        ? garantiesBreakdown.stream()
                                .map(garantie -> toQuittanceGarantieResponse(garantie, vehicules, remorques))
                                .toList()
                        : List.of())
                .targetSummaries(shouldExposeFullBreakdown(typeMouvement)
                        ? elementFacturableCibleService.calculer(
                                contrat,
                                garanties,
                                vehicules,
                                remorques
                        )
                        : List.of())
                .build();
    }

    private boolean shouldExposeFullBreakdown(TypeMouvementContrat typeMouvement) {
        TypeImpactMouvement impact = typeMouvement == null || typeMouvement.getTypeImpact() == null
                ? TypeImpactMouvement.NORMAL
                : typeMouvement.getTypeImpact();
        String code = typeMouvement == null || typeMouvement.getCode() == null
                ? ""
                : typeMouvement.getCode().trim().toUpperCase(Locale.ROOT);
        return impact == TypeImpactMouvement.NORMAL
                || "INC_F".equals(code)
                || "EXR_M".equals(code);
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

    private List<Vehicule> activeVehicules(Contrat contrat) {
        return (contrat.getVehicules() == null ? List.<Vehicule>of() : contrat.getVehicules()).stream()
                .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                .toList();
    }

    private List<Remorque> activeRemorques(Contrat contrat) {
        return (contrat.getRemorques() == null ? List.<Remorque>of() : contrat.getRemorques()).stream()
                .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                .toList();
    }

    private List<ContratGarantie> activeGaranties(Contrat contrat) {
        return (contrat.getGaranties() == null ? List.<ContratGarantie>of() : contrat.getGaranties()).stream()
                .filter(item -> item.getActif() == null || Boolean.TRUE.equals(item.getActif()))
                .toList();
    }

    private QuittanceResponse.Ligne toLigneResponse(LigneQuittance ligne) {
        return QuittanceResponse.Ligne.builder()
                .categorie(ligne.getCategorie() != null ? ligne.getCategorie().name() : null)
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
}
