package com.assurance.dto.response;

import com.assurance.enums.StatutAttestationStock;
import lombok.Builder;
import lombok.Data;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Data
@Builder
public class AttestationStockItemResponse {
    private Long id;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceNom;
    private Long groupeUsageAttestationId;
    private String groupeUsageAttestationCode;
    private String groupeUsageAttestationLibelle;
    private String numero;
    private String serie;
    private StatutAttestationStock statut;
    private LocalDateTime dateUtilisation;
    private String assure;
    private String numeroDossier;
    private String numeroPolice;
    private LocalDate dateEffet;
    private LocalDate dateReception;
    private String referenceLivraison;
}
