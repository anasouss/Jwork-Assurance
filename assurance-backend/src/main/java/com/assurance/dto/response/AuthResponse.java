package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.util.Set;

@Data
@Builder
public class AuthResponse {
    private String accessToken;
    private String refreshToken;
    private Long sessionId;
    private String tokenType;
    private long expiresIn;
    private UtilisateurInfo user;

    @Data
    @Builder
    public static class UtilisateurInfo {
        private Long id;
        private String email;
        private String fullName;
        private String roleCode;
        private String roleName;
        private Long agenceId;
        private String agenceName;
        private Set<String> permissions;
    }
}
