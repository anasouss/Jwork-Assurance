package com.assurance.entity;

import com.assurance.enums.TypeTiersCompagnie;
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
@Table(name = "tiers_compagnie", uniqueConstraints = {
        @UniqueConstraint(name = "uk_tiers_compagnie_assurance", columnNames = "compagnie_assurance_id"),
        @UniqueConstraint(name = "uk_tiers_compagnie_assistance", columnNames = "compagnie_assistance_id")
}, indexes = {
        @Index(name = "idx_tiers_compagnie_type", columnList = "type")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TiersCompagnie extends BaseEntity {

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TypeTiersCompagnie type;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assurance_id")
    private CompagnieAssurance compagnieAssurance;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "compagnie_assistance_id")
    private CompagnieAssistance compagnieAssistance;

    public Long getSourceId() {
        return type == TypeTiersCompagnie.ASSISTANCE
                ? compagnieAssistance == null ? null : compagnieAssistance.getId()
                : compagnieAssurance == null ? null : compagnieAssurance.getId();
    }

    public String getCode() {
        return type == TypeTiersCompagnie.ASSISTANCE
                ? compagnieAssistance == null ? null : compagnieAssistance.getCode()
                : compagnieAssurance == null ? null : compagnieAssurance.getCode();
    }

    public String getNom() {
        return type == TypeTiersCompagnie.ASSISTANCE
                ? compagnieAssistance == null ? null : compagnieAssistance.getNom()
                : compagnieAssurance == null ? null : compagnieAssurance.getNom();
    }

    public boolean isActif() {
        return type == TypeTiersCompagnie.ASSISTANCE
                ? compagnieAssistance != null && Boolean.TRUE.equals(compagnieAssistance.getActif())
                : compagnieAssurance != null && Boolean.TRUE.equals(compagnieAssurance.getActif());
    }
}
