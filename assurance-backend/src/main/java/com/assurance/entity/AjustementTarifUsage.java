package com.assurance.entity;

import com.assurance.enums.SensAjustementTarifUsage;
import com.assurance.enums.TypeCalculAjustementTarifUsage;
import com.assurance.enums.TypeOperationTarifUsage;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.Index;
import jakarta.persistence.Table;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.math.BigDecimal;
import java.time.LocalDate;

@Entity
@Table(name = "ajustements_tarif_usage", indexes = {
        @Index(name = "idx_ajustement_tarif_usage_dates", columnList = "date_debut,date_fin"),
        @Index(name = "idx_ajustement_tarif_usage_created_by", columnList = "created_by_user_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AjustementTarifUsage extends AuditedEntity {

    @Enumerated(EnumType.STRING)
    @Column(name = "type_operation", nullable = false, length = 24)
    private TypeOperationTarifUsage typeOperation;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_calcul", length = 24)
    private TypeCalculAjustementTarifUsage typeCalcul;

    @Enumerated(EnumType.STRING)
    @Column(length = 12)
    private SensAjustementTarifUsage sens;

    @Column(precision = 14, scale = 4)
    private BigDecimal valeur;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Column(nullable = false, length = 500)
    private String motif;
}
