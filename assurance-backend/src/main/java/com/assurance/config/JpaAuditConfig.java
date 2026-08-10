package com.assurance.config;

import com.assurance.security.TenantContext;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.domain.AuditorAware;
import org.springframework.data.jpa.repository.config.EnableJpaAuditing;

import java.util.Optional;

@Configuration
@EnableJpaAuditing(auditorAwareRef = "currentUserAuditor")
public class JpaAuditConfig {

    @Bean
    public AuditorAware<Long> currentUserAuditor() {
        return () -> Optional.ofNullable(TenantContext.getCurrentUser());
    }
}
