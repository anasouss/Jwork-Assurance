package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class ReferenceOptionResponse {
    private String id;
    private String code;
    private String libelle;
    private String description;
    private Boolean actif;
    private String compagnieAssuranceId;
    private String compagnieAssuranceLibelle;
}
