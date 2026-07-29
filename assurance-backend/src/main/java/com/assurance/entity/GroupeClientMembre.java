package com.assurance.entity;

import com.assurance.enums.RelationGroupeClient;
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

import java.time.LocalDate;

@Entity
@Table(name = "groupes_clients_membres", indexes = {
        @Index(name = "idx_groupe_membre_groupe", columnList = "groupe_id"),
        @Index(name = "idx_groupe_membre_client", columnList = "client_id"),
        @Index(name = "idx_groupe_membre_validite", columnList = "date_debut,date_fin")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GroupeClientMembre extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "groupe_id", nullable = false)
    private GroupeClient groupe;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Enumerated(EnumType.STRING)
    @Column(name = "type_relation", nullable = false, length = 30)
    private RelationGroupeClient typeRelation;

    @Column(name = "date_debut", nullable = false)
    private LocalDate dateDebut;

    @Column(name = "date_fin")
    private LocalDate dateFin;

    @Builder.Default
    @Column(nullable = false)
    private Boolean principal = false;
}
