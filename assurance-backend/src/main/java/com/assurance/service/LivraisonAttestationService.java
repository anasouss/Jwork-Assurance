package com.assurance.service;

import com.assurance.dto.request.AddLotAttestationRequest;
import com.assurance.dto.request.CreateLivraisonAttestationRequest;
import com.assurance.dto.response.LivraisonAttestationResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.AttestationStock;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.LigneLivraisonAttestation;
import com.assurance.entity.LivraisonAttestation;
import com.assurance.entity.LotAttestation;
import com.assurance.entity.MouvementStockAttestation;
import com.assurance.entity.Usage;
import com.assurance.enums.SourceLivraisonAttestation;
import com.assurance.enums.StatutAttestationStock;
import com.assurance.enums.StatutLivraisonAttestation;
import com.assurance.enums.TypeMouvementStockAttestation;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AttestationStockRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.GroupeUsageAttestationRepository;
import com.assurance.repository.LigneLivraisonAttestationRepository;
import com.assurance.repository.LivraisonAttestationRepository;
import com.assurance.repository.LotAttestationRepository;
import com.assurance.repository.MouvementStockAttestationRepository;
import com.assurance.repository.UsageRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;

@Service
@RequiredArgsConstructor
public class LivraisonAttestationService {

    private final AgenceRepository agenceRepository;
    private final CompagnieAssuranceRepository compagnieAssuranceRepository;
    private final UsageRepository usageRepository;
    private final GroupeUsageAttestationRepository groupeUsageAttestationRepository;
    private final LivraisonAttestationRepository livraisonAttestationRepository;
    private final LigneLivraisonAttestationRepository ligneLivraisonAttestationRepository;
    private final LotAttestationRepository lotAttestationRepository;
    private final AttestationStockRepository attestationStockRepository;
    private final MouvementStockAttestationRepository mouvementStockAttestationRepository;
    private final AttestationNumeroService attestationNumeroService;

    @Transactional
    public LivraisonAttestationResponse creer(String agenceId, CreateLivraisonAttestationRequest request) {
        Agence agence = resolveAgence(agenceId, request.getAgenceId());
        CompagnieAssurance compagnie = compagnieAssuranceRepository.findById(request.getCompagnieAssuranceId())
                .orElseThrow(() -> new ResourceNotFoundException("CompagnieAssurance", request.getCompagnieAssuranceId()));
        SourceLivraisonAttestation source = request.getSource() == null ? SourceLivraisonAttestation.COMMANDE : request.getSource();

        LivraisonAttestation livraison = livraisonAttestationRepository.save(LivraisonAttestation.builder()
                .agence(agence)
                .compagnieAssurance(compagnie)
                .source(source)
                .dateDemande(source == SourceLivraisonAttestation.COMMANDE ? request.getDateDemande() : null)
                .dateReception(source == SourceLivraisonAttestation.RECEPTION_DIRECTE ? request.getDateReception() : request.getDateReception())
                .referenceBl(request.getReferenceBl())
                .commentaireDecision(request.getCommentaireDecision())
                .quantiteDemandee(0)
                .quantiteRecue(0)
                .validee(false)
                .statut(StatutLivraisonAttestation.DEMANDEE)
                .actif(true)
                .build());
        livraison.setReferenceCommande(genererReference(livraison));

        int totalDemande = 0;
        for (CreateLivraisonAttestationRequest.Ligne input : request.getLignes()) {
            LigneDemandee ligne = resolveLigneDemandee(input);
            validerRestrictionCompagnie(compagnie, ligne.groupe());
            totalDemande += ligne.quantite();

            LigneLivraisonAttestation entity = ligneLivraisonAttestationRepository.save(LigneLivraisonAttestation.builder()
                    .livraison(livraison)
                    .usageRepresentatif(ligne.usage())
                    .groupeUsageAttestation(ligne.groupe())
                    .quantiteDemandee(ligne.quantite())
                    .quantiteRecue(0)
                    .actif(true)
                    .build());
            livraison.getLignes().add(entity);

            if (source == SourceLivraisonAttestation.RECEPTION_DIRECTE) {
                creerLot(livraison, ligne.usage(), ligne.groupe(), ligne.quantite(), input.getNumeroDebut(), input.getNumeroFin());
            }
        }

        livraison.setQuantiteDemandee(totalDemande);
        recalculer(livraison);
        return toResponse(livraisonAttestationRepository.save(livraison));
    }

    @Transactional
    public LivraisonAttestationResponse ajouterLot(String livraisonId, AddLotAttestationRequest request) {
        LivraisonAttestation livraison = findLivraison(livraisonId);
        if (Boolean.TRUE.equals(livraison.getValidee()) || livraison.getStatut() == StatutLivraisonAttestation.REFUSEE) {
            throw new BadRequestException("Livraison attestation verrouillee");
        }
        LigneDemandee ligne = resolveLigneDemandee(request.getUsageId(), request.getGroupeUsageAttestationId(),
                request.getGroupeUsageAttestationCode(), request.getQuantite(), request.getNumeroDebut(), request.getNumeroFin());
        validerRestrictionCompagnie(livraison.getCompagnieAssurance(), ligne.groupe());
        creerLot(livraison, ligne.usage(), ligne.groupe(), ligne.quantite(), request.getNumeroDebut(), request.getNumeroFin());
        recalculer(livraison);
        return toResponse(livraisonAttestationRepository.save(livraison));
    }

    @Transactional
    public LivraisonAttestationResponse valider(String livraisonId) {
        LivraisonAttestation livraison = findLivraison(livraisonId);
        recalculer(livraison);
        if (livraison.getQuantiteRecue() == null || livraison.getQuantiteRecue() <= 0) {
            throw new BadRequestException("Aucun lot recu pour cette livraison d'attestations");
        }
        livraison.setValidee(true);
        livraison.setStatut(StatutLivraisonAttestation.VALIDEE);
        if (livraison.getDateReception() == null) {
            livraison.setDateReception(LocalDate.now());
        }
        return toResponse(livraisonAttestationRepository.save(livraison));
    }

    @Transactional(readOnly = true)
    public List<LivraisonAttestationResponse> lister(String agenceId, SourceLivraisonAttestation source) {
        SourceLivraisonAttestation sourceEffective = source == null ? SourceLivraisonAttestation.COMMANDE : source;
        return livraisonAttestationRepository.findByAgenceIdAndSourceAndActifTrueOrderByCreatedAtDesc(agenceId, sourceEffective)
                .stream()
                .map(this::toResponse)
                .toList();
    }

    private void creerLot(
            LivraisonAttestation livraison,
            Usage usage,
            GroupeUsageAttestation groupe,
            int quantite,
            String numeroDebut,
            String numeroFin
    ) {
        if (!hasText(livraison.getCompagnieAssurance().getPrefixeAttestation())) {
            throw new BadRequestException("La compagnie n'a pas de prefixe d'attestation configure");
        }
        PlageNumeros plage = buildPlage(livraison.getCompagnieAssurance(), usage, quantite, numeroDebut, numeroFin);
        LotAttestation lot = lotAttestationRepository.save(LotAttestation.builder()
                .livraison(livraison)
                .usageRepresentatif(usage)
                .groupeUsageAttestation(groupe)
                .prefixe(attestationNumeroService.normaliserPrefixe(livraison.getCompagnieAssurance().getPrefixeAttestation()))
                .numeroDebut(numeroDebut)
                .numeroFin(numeroFin)
                .quantite(quantite)
                .actif(true)
                .build());
        livraison.getLots().add(lot);

        for (NumeroGenere numero : plage.numeros()) {
            AttestationStock attestation = attestationStockRepository.save(AttestationStock.builder()
                    .lot(lot)
                    .compagnieAssurance(livraison.getCompagnieAssurance())
                    .groupeUsageAttestation(groupe)
                    .usageRepresentatif(usage)
                    .numero(numero.numero())
                    .serie(numero.serie())
                    .statut(StatutAttestationStock.DISPONIBLE)
                    .actif(true)
                    .build());
            lot.getAttestations().add(attestation);
            mouvementStockAttestationRepository.save(MouvementStockAttestation.builder()
                    .attestationStock(attestation)
                    .typeMouvement(TypeMouvementStockAttestation.RECEPTION)
                    .numeroApres(numero.numero())
                    .dateMouvement(LocalDateTime.now())
                    .notes("Reception attestation")
                    .build());
        }
    }

    private PlageNumeros buildPlage(CompagnieAssurance compagnie, Usage usage, int quantite, String numeroDebut, String numeroFin) {
        if (!hasText(numeroDebut) || !hasText(numeroFin)) {
            throw new BadRequestException("Les bornes du lot d'attestations sont obligatoires");
        }
        int debut;
        int fin;
        try {
            debut = Integer.parseInt(numeroDebut.trim());
            fin = Integer.parseInt(numeroFin.trim());
        } catch (NumberFormatException ex) {
            throw new BadRequestException("Les bornes du lot d'attestations doivent etre numeriques");
        }
        if (debut > fin) {
            throw new BadRequestException("La borne debut doit etre inferieure ou egale a la borne fin");
        }
        int expected = (fin - debut) + 1;
        if (quantite != expected) {
            throw new BadRequestException("La quantite doit correspondre a la plage de numeros");
        }
        int pad = Math.max(numeroDebut.trim().length(), numeroFin.trim().length());
        List<NumeroGenere> numeros = new ArrayList<>();
        for (int value = debut; value <= fin; value++) {
            String serie = String.format("%0" + pad + "d", value);
            String numero = attestationNumeroService.normaliser(serie, compagnie, usage);
            if (attestationStockRepository.existsByNumeroIgnoreCase(numero)) {
                throw new BadRequestException("Numero d'attestation deja existant : " + numero);
            }
            numeros.add(new NumeroGenere(numero, serie));
        }
        return new PlageNumeros(numeros);
    }

    private LigneDemandee resolveLigneDemandee(CreateLivraisonAttestationRequest.Ligne input) {
        return resolveLigneDemandee(input.getUsageId(), input.getGroupeUsageAttestationId(),
                input.getGroupeUsageAttestationCode(), input.getQuantiteDemandee(), input.getNumeroDebut(), input.getNumeroFin());
    }

    private LigneDemandee resolveLigneDemandee(
            String usageId,
            String groupeUsageAttestationId,
            String groupeUsageAttestationCode,
            Integer quantite,
            String numeroDebut,
            String numeroFin
    ) {
        if (quantite == null || quantite <= 0) {
            quantite = quantiteDepuisPlage(numeroDebut, numeroFin);
        }
        if (quantite == null || quantite <= 0) {
            throw new BadRequestException("Quantite attestation invalide");
        }
        Usage usage = usageId == null || usageId.isBlank() ? null : usageRepository.findById(usageId)
                .orElseThrow(() -> new ResourceNotFoundException("Usage", usageId));
        GroupeUsageAttestation groupe = null;
        if (hasText(groupeUsageAttestationId)) {
            groupe = groupeUsageAttestationRepository.findById(groupeUsageAttestationId)
                    .orElseThrow(() -> new ResourceNotFoundException("GroupeUsageAttestation", groupeUsageAttestationId));
        } else if (hasText(groupeUsageAttestationCode)) {
            groupe = groupeUsageAttestationRepository.findByCodeIgnoreCase(groupeUsageAttestationCode)
                    .orElseThrow(() -> new ResourceNotFoundException("GroupeUsageAttestation", groupeUsageAttestationCode));
        } else if (usage != null) {
            groupe = usage.getGroupeUsageAttestation();
        }
        if (groupe == null || !Boolean.TRUE.equals(groupe.getVisibleStock())) {
            throw new BadRequestException("Groupe d'usage attestation invalide");
        }
        if (usage == null) {
            GroupeUsageAttestation groupeFinal = groupe;
            usage = usageRepository.findAll().stream()
                    .filter(item -> item.getGroupeUsageAttestation() != null && groupeFinal.getId().equals(item.getGroupeUsageAttestation().getId()))
                    .findFirst()
                    .orElseThrow(() -> new BadRequestException("Aucun usage representatif pour le groupe " + groupeFinal.getCode()));
        }
        return new LigneDemandee(usage, groupe, quantite);
    }

    private Integer quantiteDepuisPlage(String numeroDebut, String numeroFin) {
        if (!hasText(numeroDebut) || !hasText(numeroFin)) {
            return null;
        }
        try {
            return Integer.parseInt(numeroFin.trim()) - Integer.parseInt(numeroDebut.trim()) + 1;
        } catch (NumberFormatException ex) {
            return null;
        }
    }

    private void recalculer(LivraisonAttestation livraison) {
        int quantiteRecue = lotAttestationRepository.sumQuantiteByLivraison(livraison);
        livraison.setQuantiteRecue(Math.max(quantiteRecue, 0));

        Map<String, Integer> recuParGroupe = new LinkedHashMap<>();
        for (LotAttestation lot : lotAttestationRepository.findByLivraisonAndActifTrue(livraison)) {
            String groupeId = lot.getGroupeUsageAttestation().getId();
            recuParGroupe.put(groupeId, recuParGroupe.getOrDefault(groupeId, 0) + Math.max(0, lot.getQuantite()));
        }
        for (LigneLivraisonAttestation ligne : ligneLivraisonAttestationRepository.findByLivraisonAndActifTrue(livraison)) {
            ligne.setQuantiteRecue(recuParGroupe.getOrDefault(ligne.getGroupeUsageAttestation().getId(), 0));
            ligneLivraisonAttestationRepository.save(ligne);
        }

        if (Boolean.TRUE.equals(livraison.getValidee())) {
            livraison.setStatut(StatutLivraisonAttestation.VALIDEE);
            return;
        }
        if (livraison.getStatut() == StatutLivraisonAttestation.REFUSEE) {
            return;
        }
        int demandee = livraison.getQuantiteDemandee() == null ? 0 : livraison.getQuantiteDemandee();
        if (quantiteRecue <= 0) {
            livraison.setStatut(StatutLivraisonAttestation.DEMANDEE);
        } else if (demandee > 0 && quantiteRecue < demandee) {
            livraison.setStatut(StatutLivraisonAttestation.RECEPTION_PARTIELLE);
        } else {
            livraison.setStatut(StatutLivraisonAttestation.RECEPTION_COMPLETE);
        }
    }

    private LivraisonAttestationResponse toResponse(LivraisonAttestation livraison) {
        List<LigneLivraisonAttestation> lignes = ligneLivraisonAttestationRepository.findByLivraisonAndActifTrue(livraison);
        List<LotAttestation> lots = lotAttestationRepository.findByLivraisonAndActifTrue(livraison);
        return LivraisonAttestationResponse.builder()
                .id(livraison.getId())
                .agenceId(livraison.getAgence() != null ? livraison.getAgence().getId() : null)
                .compagnieAssuranceId(livraison.getCompagnieAssurance().getId())
                .compagnieAssuranceNom(livraison.getCompagnieAssurance().getNom())
                .source(livraison.getSource())
                .statut(livraison.getStatut())
                .dateDemande(livraison.getDateDemande())
                .dateReception(livraison.getDateReception())
                .referenceCommande(livraison.getReferenceCommande())
                .referenceBl(livraison.getReferenceBl())
                .quantiteDemandee(livraison.getQuantiteDemandee())
                .quantiteRecue(livraison.getQuantiteRecue())
                .validee(livraison.getValidee())
                .lignes(lignes.stream().map(this::toLigneView).toList())
                .lots(lots.stream().map(this::toLotView).toList())
                .build();
    }

    private LivraisonAttestationResponse.LigneView toLigneView(LigneLivraisonAttestation ligne) {
        return LivraisonAttestationResponse.LigneView.builder()
                .id(ligne.getId())
                .usageId(ligne.getUsageRepresentatif() != null ? ligne.getUsageRepresentatif().getId() : null)
                .usageCode(ligne.getUsageRepresentatif() != null ? ligne.getUsageRepresentatif().getCode() : null)
                .groupeUsageAttestationId(ligne.getGroupeUsageAttestation().getId())
                .groupeUsageAttestationCode(ligne.getGroupeUsageAttestation().getCode())
                .groupeUsageAttestationLibelle(ligne.getGroupeUsageAttestation().getLibelle())
                .quantiteDemandee(ligne.getQuantiteDemandee())
                .quantiteRecue(ligne.getQuantiteRecue())
                .build();
    }

    private LivraisonAttestationResponse.LotView toLotView(LotAttestation lot) {
        return LivraisonAttestationResponse.LotView.builder()
                .id(lot.getId())
                .groupeUsageAttestationCode(lot.getGroupeUsageAttestation().getCode())
                .prefixe(lot.getPrefixe())
                .numeroDebut(lot.getNumeroDebut())
                .numeroFin(lot.getNumeroFin())
                .quantite(lot.getQuantite())
                .actif(lot.getActif())
                .build();
    }

    private LivraisonAttestation findLivraison(String livraisonId) {
        return livraisonAttestationRepository.findById(livraisonId)
                .filter(item -> Boolean.TRUE.equals(item.getActif()))
                .orElseThrow(() -> new ResourceNotFoundException("LivraisonAttestation", livraisonId));
    }

    private Agence resolveAgence(String agenceIdCourante, String agenceIdRequest) {
        String agenceId = hasText(agenceIdRequest) ? agenceIdRequest : agenceIdCourante;
        if (!hasText(agenceId)) {
            return null;
        }
        return agenceRepository.findById(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
    }

    private String genererReference(LivraisonAttestation livraison) {
        String prefix = livraison.getSource() == SourceLivraisonAttestation.RECEPTION_DIRECTE ? "REC-ATT" : "CMD-ATT";
        String date = DateTimeFormatter.BASIC_ISO_DATE.format(LocalDate.now());
        String compagnie = livraison.getCompagnieAssurance().getCode() == null ? "COMP" : livraison.getCompagnieAssurance().getCode();
        return (prefix + "-" + date + "-" + compagnie + "-" + livraison.getId().substring(0, 8)).toUpperCase(Locale.ROOT);
    }

    private void validerRestrictionCompagnie(CompagnieAssurance compagnie, GroupeUsageAttestation groupe) {
        if (groupe == null || !hasText(groupe.getRestrictionCompagnie())) {
            return;
        }
        String code = groupe.getCode() == null ? "" : groupe.getCode().trim().toUpperCase(Locale.ROOT);
        if (!"B".equals(code) && !"F".equals(code)) {
            return;
        }
        String nom = compagnie != null && compagnie.getNom() != null ? compagnie.getNom().toUpperCase(Locale.ROOT) : "";
        if (!(nom.contains("MATU") || nom.equals("CAT") || nom.startsWith("CAT ") || nom.endsWith(" CAT") || nom.contains(" CAT "))) {
            throw new BadRequestException("Les usages B et F ne sont autorises que pour les compagnies MATU et CAT");
        }
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }

    private record LigneDemandee(Usage usage, GroupeUsageAttestation groupe, int quantite) {
    }

    private record PlageNumeros(List<NumeroGenere> numeros) {
    }

    private record NumeroGenere(String numero, String serie) {
    }
}
