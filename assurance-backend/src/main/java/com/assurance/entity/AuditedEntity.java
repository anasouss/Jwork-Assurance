package com.assurance.entity;

import jakarta.persistence.Column;
import jakarta.persistence.EntityListeners;
import jakarta.persistence.MappedSuperclass;
import lombok.Getter;
import lombok.Setter;
import org.springframework.data.annotation.CreatedBy;
import org.springframework.data.annotation.LastModifiedBy;
import org.springframework.data.jpa.domain.support.AuditingEntityListener;

@Getter
@Setter
@MappedSuperclass
@EntityListeners(AuditingEntityListener.class)
public abstract class AuditedEntity extends BaseEntity {

    @CreatedBy
    @Column(name = "created_by_user_id", updatable = false)
    private Long createdByUserId;

    @LastModifiedBy
    @Column(name = "updated_by_user_id")
    private Long updatedByUserId;
}
