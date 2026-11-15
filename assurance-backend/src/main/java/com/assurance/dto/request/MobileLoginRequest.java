package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Size;

public record MobileLoginRequest(
        @NotBlank @Size(max = 254) String identifiant,
        @NotBlank @Size(max = 72) String password
) {
}
