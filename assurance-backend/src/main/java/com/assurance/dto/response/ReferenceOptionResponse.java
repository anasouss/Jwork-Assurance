package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReferenceOptionResponse {
    private Long id;
    private String code;
    private String libelle;
    private String description;
    private Boolean actif;
    private Long compagnieAssuranceId;
    private String compagnieAssuranceLibelle;
}
