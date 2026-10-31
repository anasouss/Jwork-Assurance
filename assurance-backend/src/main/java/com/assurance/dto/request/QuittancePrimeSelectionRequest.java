package com.assurance.dto.request;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.Pattern;
import jakarta.validation.constraints.Size;

import java.util.List;

public record QuittancePrimeSelectionRequest(
        @Size(min = 1, max = 500)
        List<@NotBlank @Pattern(regexp = "[CAD]:[0-9]+") String> policyKeys
) {
}
