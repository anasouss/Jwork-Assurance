package com.assurance.security;

import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;
import static org.assertj.core.api.Assertions.*;

class ClientPortalCredentialsTest {
    @Test
    void supportsCinAndCompanyRcWithConsistentNormalization() {
        assertThat(ClientPortalCredentials.normalizeIdentifier(" ab 123456 ")).isEqualTo("AB123456");
        assertThat(ClientPortalCredentials.normalizeIdentifier("12345/Agadir")).isEqualTo("12345/AGADIR");
        assertThatThrownBy(() -> ClientPortalCredentials.normalizeIdentifier("../"))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void passwordsRespectBcryptByteLimitNotOnlyCharacterCount() {
        assertThatThrownBy(() -> ClientPortalCredentials.validatePassword("short")).isInstanceOf(BadRequestException.class);
        assertThatCode(() -> ClientPortalCredentials.validatePassword("long-password-123")).doesNotThrowAnyException();
        assertThatThrownBy(() -> ClientPortalCredentials.validatePassword("é".repeat(40)))
                .isInstanceOf(BadRequestException.class);
    }

    @Test
    void refreshTokenHashDoesNotContainTheSecret() {
        assertThat(ClientPortalCredentials.hash("a-secret-refresh-token")).hasSize(64)
                .doesNotContain("secret").isEqualTo(ClientPortalCredentials.hash("a-secret-refresh-token"));
    }
}
