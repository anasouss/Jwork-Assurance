package com.assurance.enums;

import com.fasterxml.jackson.annotation.JsonProperty;

public enum ModeReglementConvention {
    @JsonProperty("bureau") BUREAU,
    @JsonProperty("facture") FACTURE
}
