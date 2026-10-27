package com.assurance.dto.response;

import com.assurance.enums.TypeTiersCompagnie;
import lombok.Builder;
import lombok.Data;

@Data
@Builder
public class TiersCompagnieResponse {
    private Long id;
    private TypeTiersCompagnie type;
    private Long sourceId;
    private String code;
    private String libelle;
    private Boolean actif;
}
