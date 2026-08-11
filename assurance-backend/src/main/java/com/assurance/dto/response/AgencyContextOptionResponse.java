package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class AgencyContextOptionResponse {
    private Long id;
    private String code;
    private String nom;
    private String ville;
}
