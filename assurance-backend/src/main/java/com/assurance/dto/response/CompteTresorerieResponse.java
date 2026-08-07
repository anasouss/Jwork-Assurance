package com.assurance.dto.response;

import com.assurance.enums.TypeCompteTresorerie;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;

@Getter
@Builder
public class CompteTresorerieResponse {
    private Long id;
    private String code;
    private String libelle;
    private TypeCompteTresorerie typeCompte;
    private String nomBanque;
    private String rib;
    private String devise;
    private BigDecimal soldeInitial;
    private BigDecimal soldeCourant;
    private Boolean actif;
}
