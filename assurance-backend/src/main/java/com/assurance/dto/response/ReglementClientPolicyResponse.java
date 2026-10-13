package com.assurance.dto.response;

import lombok.Builder;
import lombok.Data;

import java.math.BigDecimal;

@Data
@Builder
public class ReglementClientPolicyResponse {

    private BigDecimal creditNonAffecteMaximum;
}
