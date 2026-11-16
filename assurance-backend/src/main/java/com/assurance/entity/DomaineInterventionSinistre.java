package com.assurance.entity;

import com.assurance.enums.TypePrestataireSinistre;
import jakarta.persistence.*;
import lombok.*;
import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "domaines_intervention_sinistre", uniqueConstraints = @UniqueConstraint(
        name = "uk_domaine_intervention_agence_code", columnNames = {"agence_id", "code"}))
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class DomaineInterventionSinistre extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 40)
    private String code;

    @Column(nullable = false, length = 180)
    private String libelle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "branche_assurance_id", nullable = false)
    private BrancheAssurance brancheAssurance;

    @Builder.Default
    @Column(nullable = false)
    private boolean actif = true;

    @Builder.Default
    @ElementCollection
    @CollectionTable(name = "domaines_intervention_operateurs", joinColumns = @JoinColumn(name = "domaine_id"),
            uniqueConstraints = @UniqueConstraint(name = "uk_domaine_operateur", columnNames = {"domaine_id", "type_prestataire"}))
    @Enumerated(EnumType.STRING)
    @Column(name = "type_prestataire", nullable = false, length = 30)
    private Set<TypePrestataireSinistre> operateurs = new LinkedHashSet<>();
}
