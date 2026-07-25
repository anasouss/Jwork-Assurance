package com.assurance.service;

import com.assurance.entity.AttestationStock;
import com.assurance.entity.Contrat;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementStockAttestation;
import com.assurance.entity.Remorque;
import com.assurance.entity.SeuilStockAttestation;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Usage;
import com.assurance.entity.Vehicule;
import com.assurance.enums.StatutAttestationStock;
import com.assurance.enums.TypeMouvementStockAttestation;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AttestationStockRepository;
import com.assurance.repository.MouvementStockAttestationRepository;
import com.assurance.repository.SeuilStockAttestationRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AttestationStockService {

    public static final String PARAM_CONTROLE_STOCK_ATTESTATION = "ENABLE_ATTESTATION_STOCK_CHECK";

    private final AttestationStockRepository attestationStockRepository;
    private final MouvementStockAttestationRepository mouvementStockAttestationRepository;
    private final SeuilStockAttestationRepository seuilStockAttestationRepository;
    private final ParametreApplicationService parametreApplicationService;
    private final AttestationNumeroService attestationNumeroService;

    public boolean controleActif(String agenceId) {
        return parametreApplicationService.getBoolean(agenceId, PARAM_CONTROLE_STOCK_ATTESTATION, true);
    }

    public String normaliserNumero(String numero, Contrat contrat, Usage usage) {
        return attestationNumeroService.normaliser(numero, contrat != null ? contrat.getCompagnieAssurance() : null, usage);
    }

    public List<String> listerDisponibles(String fragment, Contrat contrat, Usage usage) {
        if (!controleActif(contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null)
                || contrat == null
                || contrat.getCompagnieAssurance() == null
                || !hasText(fragment)) {
            return List.of();
        }
        GroupeUsageAttestation groupe = groupeStock(usage);
        if (groupe == null) {
            return List.of();
        }
        return attestationStockRepository.findDisponibles(
                fragment.trim(),
                StatutAttestationStock.DISPONIBLE,
                contrat.getCompagnieAssurance().getId(),
                groupe.getId()
        );
    }

    @Transactional
    public void consommerPourMouvement(Contrat contrat, MouvementContrat mouvement, String numero, Usage usage, Vehicule vehicule, Remorque remorque) {
        if (!doitConsommer(contrat, mouvement != null ? mouvement.getTypeMouvement() : null, usage)) {
            return;
        }
        String numeroNormalise = normaliserNumero(numero, contrat, usage);
        if (!hasText(numeroNormalise)) {
            throw new BadRequestException("Numero d'attestation obligatoire pour ce mouvement");
        }
        AttestationStock attestation = trouverDisponiblePourUpdate(contrat, usage, numeroNormalise);
        attestation.setStatut(StatutAttestationStock.UTILISEE);
        attestation.setDateUtilisation(LocalDateTime.now());
        attestation.setNumeroDossier(contrat.getNumeroDossier());
        attestation.setNumeroPolice(contrat.getNumeroPolice());
        attestation.setContrat(contrat);
        attestation.setMouvementContrat(mouvement);
        attestation.setVehicule(vehicule);
        attestation.setRemorque(remorque);
        attestationStockRepository.save(attestation);
        enregistrerMouvement(attestation, TypeMouvementStockAttestation.UTILISATION, contrat, mouvement, null, numeroNormalise);
        recalculerSeuil(attestation);
    }

    @Transactional
    public void liberer(Contrat contrat, MouvementContrat mouvement, String numero, Usage usage) {
        if (!controleActif(contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null) || !hasText(numero)) {
            return;
        }
        if (contrat == null || contrat.getCompagnieAssurance() == null) {
            return;
        }
        GroupeUsageAttestation groupe = groupeStock(usage);
        if (groupe == null) {
            return;
        }
        String numeroNormalise = normaliserNumero(numero, contrat, usage);
        List<AttestationStock> attestations = attestationStockRepository.findGestionnableForUpdate(
                attestationNumeroService.candidats(numeroNormalise, contrat.getCompagnieAssurance(), usage),
                contrat.getCompagnieAssurance().getId(),
                groupe.getId()
        );
        for (AttestationStock attestation : attestations) {
            if (contrat != null && attestation.getContrat() != null && !contrat.getId().equals(attestation.getContrat().getId())) {
                continue;
            }
            attestation.setStatut(StatutAttestationStock.DISPONIBLE);
            attestation.setDateUtilisation(null);
            attestation.setNumeroDossier(null);
            attestation.setNumeroPolice(null);
            attestation.setContrat(null);
            attestation.setMouvementContrat(null);
            attestation.setVehicule(null);
            attestation.setRemorque(null);
            attestationStockRepository.save(attestation);
            enregistrerMouvement(attestation, TypeMouvementStockAttestation.LIBERATION, contrat, mouvement, numeroNormalise, null);
            recalculerSeuil(attestation);
            return;
        }
    }

    public boolean doitConsommer(Contrat contrat, TypeMouvementContrat typeMouvement, Usage usage) {
        if (!controleActif(contrat != null && contrat.getAgence() != null ? contrat.getAgence().getId() : null)) {
            return false;
        }
        return Boolean.TRUE.equals(typeMouvement != null ? typeMouvement.getConsommeAttestation() : null)
                && Boolean.TRUE.equals(usage != null ? usage.getConsommeAttestation() : null)
                && groupeStock(usage) != null;
    }

    private AttestationStock trouverDisponiblePourUpdate(Contrat contrat, Usage usage, String numeroNormalise) {
        if (contrat == null || contrat.getCompagnieAssurance() == null) {
            throw new BadRequestException("Compagnie invalide pour le controle du stock d'attestation");
        }
        GroupeUsageAttestation groupe = groupeStock(usage);
        if (groupe == null) {
            throw new BadRequestException("Usage invalide pour le controle du stock d'attestation");
        }
        List<AttestationStock> candidates = attestationStockRepository.findGestionnableForUpdate(
                attestationNumeroService.candidats(numeroNormalise, contrat.getCompagnieAssurance(), usage),
                contrat.getCompagnieAssurance().getId(),
                groupe.getId()
        );
        return candidates.stream()
                .filter(attestation -> attestation.getStatut() == StatutAttestationStock.DISPONIBLE)
                .findFirst()
                .orElseThrow(() -> new BadRequestException("Ce numero d'attestation n'est pas disponible en stock"));
    }

    private GroupeUsageAttestation groupeStock(Usage usage) {
        GroupeUsageAttestation groupe = usage != null ? usage.getGroupeUsageAttestation() : null;
        if (groupe == null || !Boolean.TRUE.equals(groupe.getVisibleStock()) || !Boolean.TRUE.equals(groupe.getActif())) {
            return null;
        }
        return groupe;
    }

    private void enregistrerMouvement(
            AttestationStock attestation,
            TypeMouvementStockAttestation typeMouvement,
            Contrat contrat,
            MouvementContrat mouvementContrat,
            String numeroAvant,
            String numeroApres
    ) {
        mouvementStockAttestationRepository.save(MouvementStockAttestation.builder()
                .attestationStock(attestation)
                .typeMouvement(typeMouvement)
                .contrat(contrat)
                .mouvementContrat(mouvementContrat)
                .numeroAvant(numeroAvant)
                .numeroApres(numeroApres)
                .dateMouvement(LocalDateTime.now())
                .build());
    }

    private void recalculerSeuil(AttestationStock attestation) {
        seuilStockAttestationRepository
                .findByCompagnieAssuranceIdAndGroupeUsageAttestationIdAndActifTrue(
                        attestation.getCompagnieAssurance().getId(),
                        attestation.getGroupeUsageAttestation().getId()
                )
                .ifPresent(seuil -> {
                    long disponible = attestationStockRepository.countDisponibles(
                            attestation.getCompagnieAssurance().getId(),
                            attestation.getGroupeUsageAttestation().getId()
                    );
                    seuil.setStockDisponible((int) disponible);
                    seuil.setStockFaible(disponible <= Math.max(0, seuil.getMinimumStock()));
                    seuil.setDerniereEvaluation(LocalDateTime.now());
                    seuilStockAttestationRepository.save(seuil);
                });
    }

    private boolean hasText(String value) {
        return value != null && !value.trim().isEmpty();
    }
}
