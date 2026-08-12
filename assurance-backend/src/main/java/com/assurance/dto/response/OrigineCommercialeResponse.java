package com.assurance.dto.response;

import com.assurance.enums.TypeOrigineCommerciale;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class OrigineCommercialeResponse {
    private Long id;
    private String code;
    private String libelle;
    private TypeOrigineCommerciale type;
    private Boolean actif;
    private Integer ordre;
}
