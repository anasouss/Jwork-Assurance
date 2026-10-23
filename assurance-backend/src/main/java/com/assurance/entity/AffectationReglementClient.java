package com.assurance.entity;

import com.assurance.enums.StatutAffectationReglement;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(
        name = "affectations_reglements_clients",
        uniqueConstraints = {
                @UniqueConstraint(
                        name = "uk_affectation_reglement_instrument_element",
                        columnNames = {"instrument_id", "element_facturable_id"}
                ),
                @UniqueConstraint(
                        name = "uk_affectation_reglement_instrument_document_element",
                        columnNames = {
                                "instrument_id",
                                "document_client_id",
                                "element_facturable_id"
                        }
                )
        },
        indexes = {
                @Index(
                        name = "idx_affectation_reglement_element_statut",
                        columnList = "element_facturable_id,statut"
                ),
                @Index(
                        name = "idx_affectation_reglement_document_statut",
                        columnList = "document_client_id,statut"
                ),
                @Index(name = "idx_affectation_reglement_client_payeur", columnList = "client_payeur_id"),
                @Index(name = "idx_affectation_reglement_groupe_payeur", columnList = "groupe_payeur_id")
        }
)
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AffectationReglementClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "instrument_id", nullable = false)
    private InstrumentReglementClient instrument;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "element_facturable_id")
    private ElementFacturable elementFacturable;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_client_id")
    private DocumentClient documentClient;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_payeur_id")
    private Client clientPayeur;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_payeur_id")
    private GroupeClient groupePayeur;

    @Column(name = "payeur_nom_snapshot", nullable = false, length = 220)
    private String payeurNomSnapshot;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private StatutAffectationReglement statut;
}
