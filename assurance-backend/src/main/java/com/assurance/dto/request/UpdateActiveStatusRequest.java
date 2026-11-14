package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;

public record UpdateActiveStatusRequest(@NotNull Boolean actif) {
}
