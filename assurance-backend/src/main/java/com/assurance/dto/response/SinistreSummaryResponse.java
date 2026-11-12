package com.assurance.dto.response;

import com.assurance.enums.NatureSinistre;
import com.assurance.enums.StatutSinistre;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class SinistreSummaryResponse {
    private Long id;
    private String numeroSinistre;
    private String referenceCompagnie;
    private StatutSinistre statut;
    private com.assurance.enums.EtapeSuiviSinistre etapeSuivi;
    private com.assurance.enums.TypeDommageSinistre typeDommage;
    private com.assurance.enums.ModeReparationSinistre modeReparation;
    private BigDecimal tauxResponsabilite;
    private Long garageId;
    private String garage;
    private String premierExpert;
    private java.util.List<String> garantiesImpliquees;
    private NatureSinistre nature;
    private LocalDate dateSinistre;
    private LocalDate dateDeclaration;
    private String numeroPolice;
    private String numeroDossier;
    private String compagnie;
    private String assure;
    private String immatriculation;
    private String gestionnaire;
    private String prochaineAction;
    private LocalDate dateEcheanceAction;
    private BigDecimal provisionCourante;
    private BigDecimal totalRegle;
    private BigDecimal totalRecours;
    private LocalDateTime updatedAt;
}
