package com.assurance.dto.request;

import jakarta.validation.constraints.*;

public final class ClientPortalRequests {
    private ClientPortalRequests() {
    }

    public record CreateAccount(@NotNull Long clientId, @Size(max = 120) String identifiant,
                                @NotBlank @Size(min = 12, max = 72) String password) {
    }

    public record Password(@NotBlank @Size(min = 12, max = 72) String password) {
    }

    public record Login(@NotBlank @Size(max = 50) String agenceCode,
                        @NotBlank @Size(max = 120) String identifiant,
                        @NotBlank @Size(max = 72) String password) {
    }

    public record Refresh(@NotBlank @Size(max = 200) String refreshToken) {
    }

    public record ChangePassword(@NotBlank @Size(max = 72) String currentPassword,
                                 @NotBlank @Size(min = 12, max = 72) String newPassword) {
    }

    public record Grant(Long contratId, Long sinistreId) {
    }

    public record Active(@NotNull Boolean actif) {
    }

    public record PublishDocument(Long pieceJointeId, Long sinistreDocumentId,
                                  @NotBlank @Size(max = 180) String titre) {
    }

    public record PublishUpdate(@NotBlank @Size(max = 180) String titre,
                                @NotBlank @Size(max = 2000) String message) {
    }
}
