package com.assurance.dto.response;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityChange;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityReference;
import com.assurance.activity.ActivitySurface;

import java.time.LocalDateTime;
import java.util.List;

public record BusinessActivityResponse(
        Long id,
        Long agenceId,
        Long actorUserId,
        String actorName,
        LocalDateTime occurredAt,
        ActivityModule module,
        ActivityAction action,
        String title,
        String origin,
        ActivitySurface surface,
        String surfaceLabel,
        ActivityReference subject,
        List<ActivityReference> references,
        List<ActivityChange> changes
) {
}
