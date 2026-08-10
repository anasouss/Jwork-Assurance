package com.assurance.dto.response;

import com.assurance.enums.SensMouvementTresorerie;
import com.assurance.enums.StatutOperationTresorerie;
import com.assurance.enums.TypeOperationTresorerie;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;

@Getter
@Builder
public class OperationTresorerieResponse {
    private Long id;
    private String numero;
    private TypeOperationTresorerie typeOperation;
    private StatutOperationTresorerie statut;
    private Long compteSourceId;
    private String compteSource;
    private Long compteDestinationId;
    private String compteDestination;
    private SensMouvementTresorerie sensAjustement;
    private BigDecimal montant;
    private LocalDate dateOperation;
    private LocalDate dateValeur;
    private String reference;
    private String motif;
    private LocalDateTime confirmeeLe;
    private Long confirmeeParId;
    private String confirmeePar;
    private Long operationExtourneeId;
    private String operationExtourneeNumero;
    private LocalDateTime annuleeLe;
    private String motifAnnulation;
}
