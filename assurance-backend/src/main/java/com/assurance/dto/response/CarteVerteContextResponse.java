package com.assurance.dto.response;

import com.assurance.enums.TypeContrat;
import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

@Data
@Builder
public class CarteVerteContextResponse {
    private Long contratId;
    private String numeroDossier;
    private String numeroPolice;
    private TypeContrat typeContrat;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private Long mouvementContratId;
    private String mouvementCode;
    private String mouvementLibelle;
    private String prefixeCarteVerte;
    private BigDecimal montant;
    private List<VehiculeCarteVerteOption> vehiculesEligibles;
    private List<CarteVerteResponse> cartesVertes;

    @Data
    @Builder
    public static class VehiculeCarteVerteOption {
        private Long id;
        private String immatriculation;
        private String usageCode;
        private String usageLibelle;
        private LocalDate dateEffet;
        private LocalDate dateEcheance;
    }
}
