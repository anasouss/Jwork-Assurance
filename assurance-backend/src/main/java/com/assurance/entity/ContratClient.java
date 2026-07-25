package com.assurance.entity;

import com.assurance.enums.RoleClientContrat;
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
@Table(name = "contrat_clients",
        uniqueConstraints = @UniqueConstraint(name = "uk_contrat_client_role", columnNames = {"contrat_id", "client_id", "role"}),
        indexes = {
                @Index(name = "idx_contrat_client_contrat", columnList = "contrat_id"),
                @Index(name = "idx_contrat_client_client", columnList = "client_id"),
                @Index(name = "idx_contrat_client_role", columnList = "role")
        })
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ContratClient extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "contrat_id", nullable = false)
    private Contrat contrat;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40)
    private RoleClientContrat role;

    @Builder.Default
    @Column(name = "principal_pour_role", nullable = false)
    private Boolean principalPourRole = false;
}
