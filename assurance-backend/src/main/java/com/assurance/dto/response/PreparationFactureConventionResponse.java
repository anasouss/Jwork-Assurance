package com.assurance.dto.response;

import java.util.List;

public record PreparationFactureConventionResponse(List<Long> echeanceIds, ConventionInvoicePreviewResponse apercu) {
}
