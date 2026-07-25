package com.assurance.dto.request;

import com.assurance.enums.SourceLivraisonAttestation;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import lombok.Getter;
import lombok.Setter;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Getter
@Setter
public class CreateLivraisonAttestationRequest {

    private String agenceId;

    @NotBlank
    private String compagnieAssuranceId;

    private SourceLivraisonAttestation source = SourceLivraisonAttestation.COMMANDE;

    private LocalDate dateDemande;
    private LocalDate dateReception;
    private String referenceBl;
    private String commentaireDecision;

    @NotEmpty
    private List<Ligne> lignes = new ArrayList<>();

    @Getter
    @Setter
    public static class Ligne {
        private String usageId;
        private String groupeUsageAttestationId;
        private String groupeUsageAttestationCode;
        private Integer quantiteDemandee;
        private String numeroDebut;
        private String numeroFin;
    }
}
