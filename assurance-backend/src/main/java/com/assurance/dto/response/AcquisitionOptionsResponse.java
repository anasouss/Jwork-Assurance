package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.List;

@Data
@Builder
public class AcquisitionOptionsResponse {
    private List<OrigineCommercialeResponse> origines;
    private List<UtilisateurOption> collaborateurs;

    @Data
    @Builder
    public static class UtilisateurOption {
        private Long id;
        private String nom;
        private Boolean actif;
    }
}
