package com.assurance.service;

import com.assurance.entity.Sinistre;
import com.assurance.enums.StatutSinistre;
import com.assurance.exception.BadRequestException;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.util.EnumMap;
import java.util.EnumSet;
import java.util.Map;
import java.util.Set;

@Service
public class SinistreWorkflowService {

    private static final Map<StatutSinistre, Set<StatutSinistre>> TRANSITIONS = transitions();

    public void transition(Sinistre sinistre, StatutSinistre cible) {
        StatutSinistre actuel = sinistre.getStatut();
        if (actuel == cible) {
            return;
        }
        if (!TRANSITIONS.getOrDefault(actuel, Set.of()).contains(cible)) {
            throw new BadRequestException(
                    "Transition de statut non autorisée : " + actuel + " vers " + cible
            );
        }
        sinistre.setStatut(cible);
        if (cible == StatutSinistre.TRANSMIS_COMPAGNIE) {
            sinistre.setDateTransmission(LocalDate.now());
        }
        if (cible == StatutSinistre.CLOTURE || cible == StatutSinistre.ANNULE) {
            sinistre.setDateCloture(LocalDate.now());
        } else if (cible == StatutSinistre.ROUVERT) {
            sinistre.setDateCloture(null);
        }
    }

    public boolean isEditable(StatutSinistre statut) {
        return statut != StatutSinistre.CLOTURE
                && statut != StatutSinistre.ANNULE
                && statut != StatutSinistre.REJETE;
    }

    public Set<StatutSinistre> availableTransitions(StatutSinistre statut) {
        return TRANSITIONS.getOrDefault(statut, Set.of());
    }

    private static Map<StatutSinistre, Set<StatutSinistre>> transitions() {
        Map<StatutSinistre, Set<StatutSinistre>> values = new EnumMap<>(StatutSinistre.class);
        values.put(StatutSinistre.BROUILLON, EnumSet.of(
                StatutSinistre.DECLARE,
                StatutSinistre.ANNULE
        ));
        values.put(StatutSinistre.DECLARE, EnumSet.of(
                StatutSinistre.DOSSIER_INCOMPLET,
                StatutSinistre.TRANSMIS_COMPAGNIE,
                StatutSinistre.ANNULE
        ));
        values.put(StatutSinistre.DOSSIER_INCOMPLET, EnumSet.of(
                StatutSinistre.DECLARE,
                StatutSinistre.TRANSMIS_COMPAGNIE,
                StatutSinistre.ANNULE
        ));
        values.put(StatutSinistre.TRANSMIS_COMPAGNIE, EnumSet.of(
                StatutSinistre.EXPERTISE,
                StatutSinistre.EN_ATTENTE_REGLEMENT,
                StatutSinistre.REJETE
        ));
        values.put(StatutSinistre.EXPERTISE, EnumSet.of(
                StatutSinistre.EN_ATTENTE_REGLEMENT,
                StatutSinistre.REJETE
        ));
        values.put(StatutSinistre.EN_ATTENTE_REGLEMENT, EnumSet.of(
                StatutSinistre.PARTIELLEMENT_REGLE,
                StatutSinistre.REGLE,
                StatutSinistre.REJETE
        ));
        values.put(StatutSinistre.PARTIELLEMENT_REGLE, EnumSet.of(
                StatutSinistre.EN_ATTENTE_REGLEMENT,
                StatutSinistre.REGLE
        ));
        values.put(StatutSinistre.REGLE, EnumSet.of(
                StatutSinistre.CLOTURE,
                StatutSinistre.EN_ATTENTE_REGLEMENT,
                StatutSinistre.PARTIELLEMENT_REGLE,
                StatutSinistre.ROUVERT
        ));
        values.put(StatutSinistre.REJETE, EnumSet.of(
                StatutSinistre.CLOTURE,
                StatutSinistre.ROUVERT
        ));
        values.put(StatutSinistre.CLOTURE, EnumSet.of(StatutSinistre.ROUVERT));
        values.put(StatutSinistre.ROUVERT, EnumSet.of(
                StatutSinistre.DOSSIER_INCOMPLET,
                StatutSinistre.TRANSMIS_COMPAGNIE,
                StatutSinistre.EXPERTISE,
                StatutSinistre.EN_ATTENTE_REGLEMENT
        ));
        return Map.copyOf(values);
    }
}
