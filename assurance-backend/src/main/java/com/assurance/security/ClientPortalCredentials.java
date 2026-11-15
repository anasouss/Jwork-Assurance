package com.assurance.security;

import com.assurance.exception.BadRequestException;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.HexFormat;
import java.util.Locale;

public final class ClientPortalCredentials {
    private ClientPortalCredentials() {
    }

    public static String normalizeIdentifier(String value) {
        String normalized = value == null ? "" : value.strip().replaceAll("\\s+", "").toUpperCase(Locale.ROOT);
        if (!normalized.matches("[A-Z0-9][A-Z0-9._/\\-]{1,119}")) {
            throw new BadRequestException("Identifiant invalide");
        }
        return normalized;
    }

    public static void validatePassword(String value) {
        if (value == null || value.length() < 12 || value.getBytes(StandardCharsets.UTF_8).length > 72) {
            throw new BadRequestException("Le mot de passe doit contenir au moins 12 caractères et au maximum 72 octets");
        }
    }

    public static String hash(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException error) {
            throw new IllegalStateException("SHA-256 indisponible", error);
        }
    }
}
