package com.assurance.entity;

import com.assurance.activity.ActivityAction;
import com.assurance.activity.ActivityModule;
import com.assurance.activity.ActivityRecordType;
import com.assurance.activity.ActivitySurface;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.FetchType;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Index;
import jakarta.persistence.JoinColumn;
import jakarta.persistence.ManyToOne;
import jakarta.persistence.Table;
import lombok.AccessLevel;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

@Entity
@Table(name = "business_activities", indexes = {
        @Index(name = "idx_activity_agency_date", columnList = "agence_id,occurred_at,id"),
        @Index(name = "idx_activity_module_date", columnList = "agence_id,module,occurred_at"),
        @Index(name = "idx_activity_subject", columnList = "agence_id,subject_type,subject_id"),
        @Index(name = "idx_activity_actor_date", columnList = "actor_user_id,occurred_at")
})
@Getter
@Builder
@NoArgsConstructor(access = AccessLevel.PROTECTED)
@AllArgsConstructor(access = AccessLevel.PRIVATE)
public class BusinessActivity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "agence_id", updatable = false)
    private Agence agence;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "actor_user_id", updatable = false)
    private Utilisateur actor;

    @Column(name = "actor_name", nullable = false, length = 220, updatable = false)
    private String actorName;

    @Column(name = "occurred_at", nullable = false, updatable = false)
    private LocalDateTime occurredAt;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private ActivityModule module;

    @Enumerated(EnumType.STRING)
    @Column(name = "activity_action", nullable = false, length = 30, updatable = false)
    private ActivityAction action;

    @Column(nullable = false, length = 240, updatable = false)
    private String title;

    @Column(nullable = false, length = 100, updatable = false)
    private String origin;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 40, updatable = false)
    private ActivitySurface surface;

    @Enumerated(EnumType.STRING)
    @Column(name = "subject_type", nullable = false, length = 40, updatable = false)
    private ActivityRecordType subjectType;

    @Column(name = "subject_id", nullable = false, length = 80, updatable = false)
    private String subjectId;

    @Column(name = "subject_label", nullable = false, length = 500, updatable = false)
    private String subjectLabel;

    @Column(name = "references_json", nullable = false, columnDefinition = "longtext", updatable = false)
    private String referencesJson;

    @Column(name = "changes_json", nullable = false, columnDefinition = "longtext", updatable = false)
    private String changesJson;

    @Column(name = "request_id", length = 80, updatable = false)
    private String requestId;
}
