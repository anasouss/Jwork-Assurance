package com.assurance.dto.request;

import jakarta.validation.constraints.NotNull;

public record AssignUserRoleRequest(@NotNull Long roleId) {
}
