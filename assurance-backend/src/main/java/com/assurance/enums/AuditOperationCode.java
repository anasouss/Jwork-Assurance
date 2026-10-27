package com.assurance.enums;

import java.util.EnumSet;
import java.util.Set;

public enum AuditOperationCode {
    CONTRACT_CREATED,
    CONTRACT_DRAFT_CREATED,
    CONTRACT_DRAFT_UPDATED,
    CONTRACT_SUBSCRIBER_SAVED,
    CONTRACT_OWNER_SAVED,
    CONTRACT_DETAILS_SAVED,
    CONTRACT_TARIFF_GRID_SELECTED,
    CONTRACT_GUARANTEES_SAVED,
    CONTRACT_VEHICLE_SAVED,
    CONTRACT_VEHICLE_GUARANTEES_SAVED,
    CONTRACT_TRAILER_SAVED,
    CONTRACT_TRAILER_GUARANTEES_SAVED,
    CONTRACT_TARIFFS_RECALCULATED,
    CONTRACT_FINALIZED,
    CLIENT_PAYMENT_UPDATED;

    private static final Set<AuditOperationCode> DRAFT_SECTION_OPERATIONS = EnumSet.of(
            CONTRACT_DRAFT_UPDATED,
            CONTRACT_SUBSCRIBER_SAVED,
            CONTRACT_OWNER_SAVED,
            CONTRACT_DETAILS_SAVED,
            CONTRACT_TARIFF_GRID_SELECTED,
            CONTRACT_GUARANTEES_SAVED,
            CONTRACT_VEHICLE_SAVED,
            CONTRACT_VEHICLE_GUARANTEES_SAVED
    );

    public static AuditOperationCode draftSection(String value) {
        if (value == null || value.isBlank()) {
            return CONTRACT_DRAFT_UPDATED;
        }
        try {
            AuditOperationCode code = valueOf(value.trim());
            return DRAFT_SECTION_OPERATIONS.contains(code) ? code : CONTRACT_DRAFT_UPDATED;
        } catch (IllegalArgumentException exception) {
            return CONTRACT_DRAFT_UPDATED;
        }
    }
}
