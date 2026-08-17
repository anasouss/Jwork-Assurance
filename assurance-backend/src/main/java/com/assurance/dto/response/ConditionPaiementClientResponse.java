package com.assurance.dto.response;

import com.assurance.enums.TypeJustificationConditionPaiement;
import lombok.Builder;
import lombok.Getter;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
public class ConditionPaiementClientResponse {
    private Long id;
    private String payeurType;
    private Long payeurId;
    private Integer delaiJours;
    private TypeJustificationConditionPaiement typeJustification;
    private LocalDate dateDebut;
    private LocalDate dateFin;
    private String statut;
    private boolean justificatifPresent;
    private String nomFichier;
    private String commentaire;
    private LocalDateTime createdAt;
}
