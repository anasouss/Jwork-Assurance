package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
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

@Entity
@Table(name = "client_telephones", indexes = {
        @Index(name = "idx_client_telephone_client", columnList = "client_id")
})
@Getter
@Setter
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ClientTelephone extends BaseEntity {

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "client_id", nullable = false)
    private Client client;

    @Column(name = "numero", nullable = false, length = 60)
    private String numero;

    @Builder.Default
    @Column(name = "whatsapp", nullable = false)
    private Boolean whatsapp = false;

    @Builder.Default
    @Column(name = "principal", nullable = false)
    private Boolean principal = false;
}
