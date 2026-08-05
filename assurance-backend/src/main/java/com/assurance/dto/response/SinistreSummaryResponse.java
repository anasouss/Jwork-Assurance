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
    private NatureSinistre nature;
    private LocalDate dateSinistre;
    private LocalDate dateDeclaration;
    private String numeroPolice;
    private String numeroDossier;
    private String compagnie;
    private String assure;
    private String immatriculation;
    private String gestionnaire;
    private BigDecimal provisionCourante;
    private BigDecimal totalRegle;
    private BigDecimal totalRecours;
    private LocalDateTime updatedAt;
}
