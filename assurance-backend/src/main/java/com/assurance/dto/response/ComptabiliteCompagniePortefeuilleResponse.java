package com.assurance.dto.response;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ComptabiliteCompagniePortefeuilleResponse {

    private long quittances;
    private long bordereaux;
    private BigDecimal netCompagnie;
    private String statut;
}
