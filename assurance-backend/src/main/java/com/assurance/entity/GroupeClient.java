package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.FetchType;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.OneToMany;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "groupes_clients",
        uniqueConstraints = @UniqueConstraint(
                name = "uk_groupe_client_agence_code",
                columnNames = {"agence_id", "code"}
        ),
        indexes = {
                @Index(name = "idx_groupe_client_agence", columnList = "agence_id"),
                @Index(name = "idx_groupe_client_actif", columnList = "actif")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupeClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @Column(nullable = false, length = 60)
    private String code;

    @Column(nullable = false, length = 180)
    private String libelle;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_tete_id")
    private Client clientTete;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_tresorerie_id")
    private Client clientTresorerie;

    @Builder.Default
    @Column(name = "facturation_consolidee_defaut", nullable = false)
    private Boolean facturationConsolideeDefaut = false;

    @Builder.Default
    @Column(nullable = false)
    private Boolean actif = true;

    @OneToMany(mappedBy = "groupe")
    @Builder.Default
    private List<GroupeClientMembre> membres = new ArrayList<>();
}
