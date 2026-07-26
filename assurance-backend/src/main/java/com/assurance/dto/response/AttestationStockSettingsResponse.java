package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AttestationStockSettingsResponse {
    private Boolean controleStockActif;
}
