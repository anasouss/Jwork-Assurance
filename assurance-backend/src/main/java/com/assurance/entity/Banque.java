package com.assurance.entity;

import jakarta.persistence.CollectionTable;
import jakarta.persistence.Column;
import jakarta.persistence.ElementCollection;
import jakarta.persistence.Entity;
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

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "banques", uniqueConstraints = {
        @UniqueConstraint(name = "uk_banque_agence_code", columnNames = {"agence_id", "code"})
}, indexes = {
        @Index(name = "idx_banque_agence_actif", columnList = "agence_id,actif")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class Banque extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 60)
    private String code;

    @Column(nullable = false, length = 160)
    private String libelle;

    @ElementCollection(fetch = FetchType.LAZY)
    @CollectionTable(name = "banque_aliases", joinColumns = @JoinColumn(name = "banque_id"))
    @Column(name = "alias", nullable = false, length = 160)
    @Builder.Default
    private Set<String> aliases = new LinkedHashSet<>();

    @Column(nullable = false)
    @Builder.Default
    private Boolean actif = true;

    @Column(nullable = false)
    @Builder.Default
    private Integer ordre = 100;
}
