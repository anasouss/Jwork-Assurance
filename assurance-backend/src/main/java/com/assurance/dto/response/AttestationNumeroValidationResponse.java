package com.assurance.dto.response;

import com.assurance.enums.StatutAttestationStock;
import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AttestationNumeroValidationResponse {
    private Boolean controleStockActif;
    private Boolean validationRequise;
    private Boolean disponible;
    private String numeroNormalise;
    private String prefixe;
    private String codeUsageStock;
    private StatutAttestationStock statut;
    private String message;
    private List<String> suggestions;
}
