package com.assurance.dto.request;

import com.assurance.enums.ModeTermeRenouvellement;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

@Data
public class FinalizeRenouvellementRequest {
    @NotNull
    private ModeTermeRenouvellement modeTermeRenouvellement;
}
