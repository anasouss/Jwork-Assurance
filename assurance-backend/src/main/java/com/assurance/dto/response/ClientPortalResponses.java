package com.assurance.dto.response;

import java.time.LocalDate;
import java.time.LocalDateTime;

public final class ClientPortalResponses {
    private ClientPortalResponses() {
    }

    public record Account(Long id, Long clientId, String clientNom, String identifiant,
                          boolean actif, boolean passwordChangeRequired, LocalDateTime lastLoginAt) {
    }

    public record Profile(Long id, String nom, String agenceCode, String agenceNom,
                          String agenceTelephone, boolean passwordChangeRequired) {
    }

    public record Tokens(String accessToken, String refreshToken, String tokenType,
                         long expiresIn, Profile profile) {
    }

    public record Access(Long id, Long contratId, Long sinistreId, boolean actif, String reference,
                         String numeroPolice, LocalDate dateDebut, LocalDate dateFin, String statut) {
    }

    public record Candidate(Long id, String reference, String numeroPolice, LocalDate date, String statut) {
    }

    public record Source(Long id, String nomFichier, LocalDateTime createdAt) {
    }

    public record Contract(Long id, String numeroDossier, String numeroPolice, String type,
                           String statut, String compagnie, LocalDate dateEffet, LocalDate dateExpiration) {
    }

    public record Claim(Long id, String numero, String numeroPolice, String statut,
                        LocalDate dateSinistre, LocalDate dateDeclaration, LocalDate dateCloture) {
    }

    public record Vehicle(Long id, String immatriculation, String marque,
                          LocalDate dateEffet, LocalDate dateExpiration) {
    }

    public record Coverage(Long id, Long vehiculeId, Long remorqueId, String code, String libelle,
                           String immatriculation, java.math.BigDecimal capital, java.math.BigDecimal tauxFranchise,
                           java.math.BigDecimal franchiseMinimale) {
    }

    public record Assistance(Long id, Long vehiculeId, String numero, String compagnie, String produit,
                             LocalDate dateEffet, LocalDate dateExpiration) {
    }

    public record Update(Long id, String titre, String message, LocalDateTime publishedAt) {
    }

    public record Document(Long id, String titre, Long contratId, Long sinistreId, LocalDateTime publishedAt) {
    }

    public record StaffPublication(Long id, String titre, String message, boolean published,
                                   Long pieceJointeId, Long sinistreDocumentId, LocalDateTime createdAt) {
    }

    public record ContractDetail(Contract contrat, PagedResponse<Vehicle> vehicules) {
    }

    public record Dashboard(long contrats, long contratsActifs, long expirationsProches,
                            long sinistres, long sinistresEnCours) {
    }
}
