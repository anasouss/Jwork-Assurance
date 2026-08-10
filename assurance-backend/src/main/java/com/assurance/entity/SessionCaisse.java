package com.assurance.entity;

import com.assurance.enums.StatutSessionCaisse;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDateTime;

@Entity
@Table(
        name = "sessions_caisse",
        indexes = {
                @Index(name = "idx_session_caisse_compte_statut", columnList = "compte_tresorerie_id,statut"),
                @Index(name = "idx_session_caisse_user_statut", columnList = "agence_id,utilisateur_id,statut")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class SessionCaisse extends AuditedEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compte_tresorerie_id", nullable = false)
    private CompteTresorerie compteTresorerie;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "utilisateur_id", nullable = false)
    private Utilisateur utilisateur;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutSessionCaisse statut;

    @Column(name = "ouverte_le", nullable = false)
    private LocalDateTime ouverteLe;

    @Column(name = "fermee_le")
    private LocalDateTime fermeeLe;

    @Column(name = "solde_theorique_ouverture", nullable = false, precision = 16, scale = 2)
    private BigDecimal soldeTheoriqueOuverture;

    @Column(name = "montant_ouverture", nullable = false, precision = 16, scale = 2)
    private BigDecimal montantOuverture;

    @Column(name = "ecart_ouverture", nullable = false, precision = 16, scale = 2)
    private BigDecimal ecartOuverture;

    @Column(name = "solde_theorique_cloture", precision = 16, scale = 2)
    private BigDecimal soldeTheoriqueCloture;

    @Column(name = "montant_compte_cloture", precision = 16, scale = 2)
    private BigDecimal montantCompteCloture;

    @Column(name = "ecart_cloture", precision = 16, scale = 2)
    private BigDecimal ecartCloture;

    @Column(name = "note_ouverture", length = 1000)
    private String noteOuverture;

    @Column(name = "note_cloture", length = 1000)
    private String noteCloture;
}
