package com.assurance.dto.response;

import com.assurance.enums.NatureMouvementTresorerie;
import com.assurance.enums.SensMouvementTresorerie;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Builder
public class MouvementTresorerieResponse {
    private Long id;
    private Long compteTresorerieId;
    private String compteTresorerie;
    private Long instrumentReglementId;
    private NatureMouvementTresorerie nature;
    private SensMouvementTresorerie sens;
    private LocalDate dateOperation;
    private LocalDate dateValeur;
    private BigDecimal montant;
    private String reference;
    private String libelle;
}
