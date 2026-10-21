package com.assurance.seeder;

import com.assurance.entity.Agence;
import com.assurance.entity.Banque;
import com.assurance.entity.CompteTresorerie;
import com.assurance.enums.NatureCaisseTresorerie;
import com.assurance.enums.TypeCompteTresorerie;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BanqueRepository;
import com.assurance.repository.CompteTresorerieRepository;
import com.assurance.service.BanqueService;
import lombok.RequiredArgsConstructor;
import org.springframework.boot.CommandLineRunner;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;

@Component
@Order(4)
@RequiredArgsConstructor
public class TresorerieReferenceSeeder implements CommandLineRunner {

    private final AgenceRepository agenceRepository;
    private final BanqueRepository banqueRepository;
    private final CompteTresorerieRepository compteTresorerieRepository;
    private final BanqueService banqueService;

    @Override
    @Transactional
    public void run(String... args) {
        Agence agence = agenceRepository.findByCode("AG-001").orElse(null);
        if (agence == null) {
            return;
        }

        if (banqueRepository.countByAgenceId(agence.getId()) == 0) {
            banqueService.initializeDefaults(agence.getId());
        }
        if (compteTresorerieRepository.count() > 0) {
            return;
        }

        Banque cih = banqueRepository.findByAgenceIdAndCodeIgnoreCase(agence.getId(), "CIH_BANK")
                .orElse(null);
        if (cih == null) {
            return;
        }

        compteTresorerieRepository.save(CompteTresorerie.builder()
                .agence(agence)
                .code("CAISSE-CENTRALE")
                .libelle("Caisse centrale")
                .typeCompte(TypeCompteTresorerie.CAISSE)
                .natureCaisse(NatureCaisseTresorerie.CENTRALE)
                .devise("MAD")
                .soldeInitial(BigDecimal.ZERO)
                .actif(true)
                .build());
        compteTresorerieRepository.save(CompteTresorerie.builder()
                .agence(agence)
                .code("BANQUE")
                .libelle("BANQUE")
                .typeCompte(TypeCompteTresorerie.BANQUE)
                .banqueReference(cih)
                .rib("230 010 4117341221023600 37")
                .devise("MAD")
                .soldeInitial(BigDecimal.ZERO)
                .actif(true)
                .build());
    }
}
