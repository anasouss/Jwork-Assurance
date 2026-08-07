package com.assurance.dto.response;

import com.assurance.enums.TypeContrat;
import com.assurance.enums.NatureElementFacturable;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Getter
@Builder
public class SourceDocumentClientResponse {
    private Long elementFacturableId;
    private Long documentClientId;
    private NatureElementFacturable nature;
    private Long quittanceId;
    private Long contratId;
    private Long mouvementId;
    private String dossier;
    private String police;
    private TypeContrat typeContrat;
    private String mouvement;
    private String reference;
    private String compagnie;
    private LocalDate dateEffet;
    private LocalDate dateEcheance;
    private String payeurType;
    private Long payeurId;
    private String payeurNom;
    private Long souscripteurId;
    private String souscripteurNom;
    private BigDecimal primeNette;
    private BigDecimal taxes;
    private BigDecimal accessoires;
    private BigDecimal montantTtc;
    private boolean dejaFacturee;
    private boolean facturable;
}
