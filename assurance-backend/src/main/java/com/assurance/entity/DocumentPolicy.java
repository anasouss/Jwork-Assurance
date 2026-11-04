package com.assurance.entity;

import com.assurance.enums.DocumentOwner;
import com.assurance.enums.DocumentExpiry;
import com.assurance.enums.DocumentValiditySource;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import lombok.Getter;
import lombok.Setter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "document_policies", uniqueConstraints = @UniqueConstraint(
        name = "uk_document_policy_agence_nature", columnNames = {"agence_id", "nature_id"}))
@Getter
@Setter
@NoArgsConstructor
public class DocumentPolicy extends BaseEntity {
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", nullable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "nature_id", nullable = false)
    private NaturePieceJointe nature;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentOwner owner = DocumentOwner.CONTRAT;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private DocumentExpiry expiry = DocumentExpiry.NONE;

    @Enumerated(EnumType.STRING)
    @Column(name = "validity_source", nullable = false, length = 40)
    private DocumentValiditySource validitySource = DocumentValiditySource.MANUAL;
}
