package com.assurance.seeder;

import com.assurance.repository.AgenceRepository;
import com.assurance.service.DomaineInterventionSinistreService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(20)
@RequiredArgsConstructor
public class DomaineInterventionSinistreSeeder implements CommandLineRunner {
    private final AgenceRepository agencies;
    private final DomaineInterventionSinistreService domains;

    @Override
    @Transactional
    public void run(String... args) {
        agencies.findAll().forEach(domains::seedDefaults);
    }
}
