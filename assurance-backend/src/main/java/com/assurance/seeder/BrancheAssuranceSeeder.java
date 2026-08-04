package com.assurance.seeder;

import com.assurance.entity.BrancheAssurance;
import com.assurance.repository.BrancheAssuranceRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

@Component
@Order(1)
@RequiredArgsConstructor
public class BrancheAssuranceSeeder implements CommandLineRunner {

    private final BrancheAssuranceRepository repository;

    @Override
    @Transactional
    public void run(String... args) {
        seed("AUTOMOBILE", "Automobile");
        seed("RISQUES_DIVERS", "Risques divers");
    }

    private void seed(String code, String libelle) {
        BrancheAssurance branche = repository.findByCodeIgnoreCase(code)
                .orElseGet(BrancheAssurance::new);
        branche.setCode(code);
        branche.setLibelle(libelle);
        branche.setActif(true);
        repository.save(branche);
    }
}
