package com.assurance.dto.response;

import com.assurance.enums.StatutSessionCaisse;
import lombok.Builder;
import lombok.Getter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Getter
@Builder
public class SessionCaisseResponse {
    private Long id;
    private Long compteTresorerieId;
    private String compteTresorerie;
    private Long utilisateurId;
    private String utilisateur;
    private StatutSessionCaisse statut;
    private LocalDateTime ouverteLe;
    private LocalDateTime fermeeLe;
    private BigDecimal soldeTheoriqueOuverture;
    private BigDecimal montantOuverture;
    private BigDecimal ecartOuverture;
    private BigDecimal soldeTheoriqueCloture;
    private BigDecimal montantCompteCloture;
    private BigDecimal ecartCloture;
    private String noteOuverture;
    private String noteCloture;
}
