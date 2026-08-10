package com.assurance.config;

import com.assurance.audit.AuditHibernateEventListener;
import com.assurance.audit.AuditHibernateIntegrator;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.hibernate.jpa.boot.spi.IntegratorProvider;
import org.springframework.boot.autoconfigure.orm.jpa.HibernatePropertiesCustomizer;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import java.util.List;

@Configuration
public class AuditHibernateConfig {

    @Bean
    public HibernatePropertiesCustomizer auditEventHibernateCustomizer(ObjectMapper objectMapper) {
        AuditHibernateIntegrator integrator = new AuditHibernateIntegrator(
                new AuditHibernateEventListener(objectMapper)
        );
        return properties -> properties.put(
                "hibernate.integrator_provider",
                (IntegratorProvider) () -> List.of(integrator)
        );
    }
}
