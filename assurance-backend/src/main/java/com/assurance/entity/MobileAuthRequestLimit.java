package com.assurance.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Entity
@Table(name = "mobile_auth_request_limits", indexes = @Index(name = "idx_mobile_auth_window", columnList = "window_slot"))
@Getter
@NoArgsConstructor
public class MobileAuthRequestLimit {
    @Id
    @Column(name = "bucket_key", length = 64)
    private String bucketKey;

    @Column(name = "window_slot", nullable = false)
    private long windowSlot;

    @Column(nullable = false)
    private int attempts;
}
