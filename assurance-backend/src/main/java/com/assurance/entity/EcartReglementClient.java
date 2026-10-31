package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.Index;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;

@Entity
@Table(name = "ecarts_reglements_clients", uniqueConstraints = @UniqueConstraint(
        name = "uk_ecart_reglement_element", columnNames = {"reglement_id", "element_facturable_id"}),
        indexes = @Index(name = "idx_ecart_agence_element", columnList = "agence_id, element_facturable_id"))
@Getter
@Setter
@NoArgsConstructor
public class EcartReglementClient extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "reglement_id", nullable = false)
    private ReglementClient reglement;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "element_facturable_id", nullable = false)
    private ElementFacturable elementFacturable;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "document_client_id")
    private DocumentClient documentClient;

    @Column(nullable = false, precision = 16, scale = 2)
    private BigDecimal montant;

    @Column(nullable = false, length = 500)
    private String motif;
}
