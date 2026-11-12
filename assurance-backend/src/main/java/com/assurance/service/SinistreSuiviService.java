package com.assurance.service;

import com.assurance.dto.request.TransitionEtapeSinistreRequest;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreEvenement;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.PhaseExpertiseSinistre;
import com.assurance.enums.StatutMissionExpertise;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.SinistreEvenementRepository;
import com.assurance.repository.SinistreRepository;
import com.assurance.repository.UtilisateurRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.ArrayList;
import java.util.EnumSet;
import java.util.List;
import java.util.Objects;
import java.util.Set;

@Service
@RequiredArgsConstructor
public class SinistreSuiviService {
    private final SinistreRepository sinistreRepository;
    private final UtilisateurRepository utilisateurRepository;
    private final MissionExpertiseRepository missionRepository;
    private final SinistreEvenementRepository evenementRepository;
    private final SinistreReadinessService readinessService;
    private final SinistreWorkflowService workflowService;

    public boolean requiresReason(EtapeSuiviSinistre source, EtapeSuiviSinistre cible) {
        return cible == EtapeSuiviSinistre.INSTANCE_CLIENT
                || source == EtapeSuiviSinistre.OUVERTURE && cible == EtapeSuiviSinistre.COMPAGNIE
                || source == EtapeSuiviSinistre.INSTANCE_CLIENT && cible == EtapeSuiviSinistre.COMPAGNIE
                || source == EtapeSuiviSinistre.INSTANCE_CLIENT && cible == EtapeSuiviSinistre.EXPERTISE_AVANT
                || source == EtapeSuiviSinistre.EXPERTISE_AVANT && cible == EtapeSuiviSinistre.COMPAGNIE
                || source == EtapeSuiviSinistre.EXPERTISE_AVANT && cible == EtapeSuiviSinistre.EXPERTISE_APRES;
    }

    public Set<EtapeSuiviSinistre> destinations(EtapeSuiviSinistre etape) {
        return switch (etape) {
            case OUVERTURE -> EnumSet.of(EtapeSuiviSinistre.EXPERTISE_AVANT,
                    EtapeSuiviSinistre.INSTANCE_CLIENT, EtapeSuiviSinistre.COMPAGNIE);
            case EXPERTISE_AVANT -> EnumSet.of(EtapeSuiviSinistre.INSTANCE_CLIENT,
                    EtapeSuiviSinistre.EXPERTISE_APRES, EtapeSuiviSinistre.COMPAGNIE);
            case INSTANCE_CLIENT -> EnumSet.of(EtapeSuiviSinistre.EXPERTISE_AVANT,
                    EtapeSuiviSinistre.EXPERTISE_APRES, EtapeSuiviSinistre.COMPAGNIE);
            case EXPERTISE_APRES -> EnumSet.of(EtapeSuiviSinistre.INSTANCE_CLIENT, EtapeSuiviSinistre.COMPAGNIE);
            case COMPAGNIE -> EnumSet.of(EtapeSuiviSinistre.INSTANCE_CLIENT, EtapeSuiviSinistre.CLOTURE);
            case CLOTURE -> EnumSet.of(EtapeSuiviSinistre.INSTANCE_CLIENT);
        };
    }

    public List<String> blockers(Sinistre sinistre, EtapeSuiviSinistre cible) {
        List<String> blockers = new ArrayList<>();
        if (cible == null || !destinations(sinistre.getEtapeSuivi()).contains(cible)) {
            return List.of("Transition de suivi non autorisee");
        }
        if (sinistre.getStatut() == StatutSinistre.BROUILLON
                || sinistre.getStatut() == StatutSinistre.REJETE && cible != EtapeSuiviSinistre.CLOTURE) {
            blockers.add("Declare ou rouvrez le dossier avant de poursuivre le suivi");
        }
        if (sinistre.getEtapeSuivi() == EtapeSuiviSinistre.CLOTURE) {
            if (sinistre.getStatut() != StatutSinistre.ROUVERT) {
                blockers.add("Rouvrez le statut financier avant de reprendre le suivi");
            }
        } else if (sinistre.getStatut() == StatutSinistre.ANNULE
                || sinistre.getStatut() == StatutSinistre.CLOTURE && cible != EtapeSuiviSinistre.CLOTURE) {
            blockers.add("Le dossier est ferme : rouvrez son statut financier");
        }
        if (cible == EtapeSuiviSinistre.EXPERTISE_AVANT || cible == EtapeSuiviSinistre.EXPERTISE_APRES) {
            PhaseExpertiseSinistre phase = cible == EtapeSuiviSinistre.EXPERTISE_AVANT
                    ? PhaseExpertiseSinistre.AVANT : PhaseExpertiseSinistre.APRES;
            boolean active = missionRepository.findBySinistreIdOrderByDateMissionDescCreatedAtDesc(sinistre.getId())
                    .stream().anyMatch(mission -> mission.getPhase() == phase
                            && mission.getStatut() != StatutMissionExpertise.ANNULEE);
            if (!active) {
                blockers.add("Enregistrez une mission d'expertise " + phase + " active");
            }
        }
        if (cible == EtapeSuiviSinistre.COMPAGNIE) {
            blockers.addAll(readinessService.blockers(sinistre, StatutSinistre.TRANSMIS_COMPAGNIE));
        }
        if (cible == EtapeSuiviSinistre.CLOTURE) {
            if (sinistre.getStatut() != StatutSinistre.REGLE && sinistre.getStatut() != StatutSinistre.REJETE
                    && sinistre.getStatut() != StatutSinistre.CLOTURE) {
                blockers.add("Le statut financier doit etre regle, rejete ou cloture");
            }
            blockers.addAll(readinessService.blockers(sinistre, StatutSinistre.CLOTURE));
        }
        return List.copyOf(blockers);
    }

    @Transactional
    public void transition(Long agenceId, Long utilisateurId, Long id, TransitionEtapeSinistreRequest request) {
        Sinistre sinistre = sinistreRepository.findByIdAndAgenceIdForUpdate(id, agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Sinistre", id));
        if (request.getVersion() != null && request.getVersion() != sinistre.getVersion()) {
            throw new BadRequestException("Le dossier a ete modifie, rechargez-le avant de poursuivre");
        }
        var acteur = utilisateurRepository.findById(utilisateurId)
                .orElseThrow(() -> new ResourceNotFoundException("Utilisateur", utilisateurId));
        if (acteur.getAgence() != null && !Objects.equals(acteur.getAgence().getId(), agenceId)) {
            throw new ResourceNotFoundException("Utilisateur", utilisateurId);
        }
        List<String> blockers = blockers(sinistre, request.getEtapeSuivi());
        if (!blockers.isEmpty()) {
            throw new BadRequestException(String.join(". ", blockers));
        }
        if (requiresReason(sinistre.getEtapeSuivi(), request.getEtapeSuivi())
                && (request.getMotif() == null || request.getMotif().isBlank())) {
            throw new BadRequestException("Precisez le motif du changement de suivi ou de l'attente client");
        }
        EtapeSuiviSinistre ancienne = sinistre.getEtapeSuivi();
        StatutSinistre ancienStatut = sinistre.getStatut();
        sinistre.setEtapeSuivi(request.getEtapeSuivi());
        if (request.getEtapeSuivi() == EtapeSuiviSinistre.COMPAGNIE && sinistre.getDateTransmission() == null) {
            sinistre.setDateTransmission(java.time.LocalDate.now());
        }
        if (request.getEtapeSuivi() == EtapeSuiviSinistre.COMPAGNIE
                && (sinistre.getStatut() == StatutSinistre.DECLARE
                || sinistre.getStatut() == StatutSinistre.DOSSIER_INCOMPLET
                || sinistre.getStatut() == StatutSinistre.ROUVERT)) {
            workflowService.transition(sinistre, StatutSinistre.TRANSMIS_COMPAGNIE);
        }
        if (request.getEtapeSuivi() == EtapeSuiviSinistre.CLOTURE) {
            workflowService.transition(sinistre, StatutSinistre.CLOTURE);
            if (sinistre.getDateCloture() == null) {
                sinistre.setDateCloture(java.time.LocalDate.now());
            }
        }
        sinistreRepository.save(sinistre);
        sinistreRepository.flush();
        String description = "Suivi : " + ancienne + " vers " + request.getEtapeSuivi();
        if (request.getMotif() != null && !request.getMotif().isBlank()) {
            description += " : " + request.getMotif().trim();
        }
        evenementRepository.save(SinistreEvenement.builder()
                .sinistre(sinistre)
                .utilisateur(acteur)
                .type(TypeEvenementSinistre.CHANGEMENT_ETAPE)
                .description(description)
                .ancienneEtape(ancienne)
                .nouvelleEtape(request.getEtapeSuivi())
                .ancienStatut(ancienStatut)
                .nouveauStatut(sinistre.getStatut())
                .build());
    }
}
