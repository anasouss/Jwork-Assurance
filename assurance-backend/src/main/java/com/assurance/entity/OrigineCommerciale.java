package com.assurance.entity;

import com.assurance.enums.TypeOrigineCommerciale;
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

@Entity
@Table(name = "origines_commerciales", uniqueConstraints = {
        @UniqueConstraint(name = "uk_origine_commerciale_agence_code", columnNames = {"agence_id", "code"})
}, indexes = {
        @Index(name = "idx_origine_commerciale_agence_actif", columnList = "agence_id,actif")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class OrigineCommerciale extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 60)
    private String code;

    @Column(nullable = false, length = 160)
    private String libelle;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 30)
    private TypeOrigineCommerciale type;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @Builder.Default
    @Column(nullable = false)
    private Integer ordre = 100;
}
