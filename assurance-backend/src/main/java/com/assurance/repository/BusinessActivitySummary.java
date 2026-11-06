package com.assurance.repository;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityRecordType;
import com.assurance.activity.ActivitySurface;

import java.time.LocalDateTime;

/** List projection deliberately excludes the potentially large change snapshot. */
public record BusinessActivitySummary(
        Long id, Long agenceId, Long actorUserId, String actorName, LocalDateTime occurredAt,
        ActivityModule module, ActivityAction action, String title, String origin, ActivitySurface surface,
        ActivityRecordType subjectType, String subjectId, String subjectLabel, String referencesJson
) {
}
