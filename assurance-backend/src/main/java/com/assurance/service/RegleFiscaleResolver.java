package com.assurance.service;

import com.assurance.entity.Contrat;
import com.assurance.entity.ContratGarantie;
import com.assurance.entity.RegleFiscale;
import com.assurance.entity.Usage;
import com.assurance.enums.BaseCalculRegleFiscale;
import com.assurance.enums.CategorieQuittance;
import com.assurance.enums.NatureRegleFiscale;
import com.assurance.repository.RegleFiscaleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class RegleFiscaleResolver {

    private final RegleFiscaleRepository regleFiscaleRepository;

    @Transactional(readOnly = true)
    public Catalogue catalogue(LocalDate dateEffet) {
        if (dateEffet == null) {
            throw new IllegalArgumentException("La date d'effet est obligatoire pour résoudre les règles fiscales");
        }
        return new Catalogue(regleFiscaleRepository.findActiveAt(dateEffet));
    }

    public static final class Catalogue {
        private final List<RegleFiscale> rules;

        private Catalogue(List<RegleFiscale> rules) {
            this.rules = List.copyOf(rules);
        }

        public Optional<RegleFiscale> forGuarantee(NatureRegleFiscale nature, Contrat contrat, ContratGarantie guarantee) {
            return best(nature, BaseCalculRegleFiscale.PRIME_GARANTIE, null, contrat, guarantee);
        }

        public Optional<RegleFiscale> forCategory(NatureRegleFiscale nature, CategorieQuittance category, Contrat contrat) {
            return best(nature, BaseCalculRegleFiscale.PRIME_CATEGORIE, category, contrat, null);
        }

        public Optional<RegleFiscale> forUnits(NatureRegleFiscale nature, Contrat contrat) {
            return best(nature, BaseCalculRegleFiscale.UNITE_ASSUREE, null, contrat, null);
        }

        private Optional<RegleFiscale> best(
                NatureRegleFiscale nature,
                BaseCalculRegleFiscale base,
                CategorieQuittance category,
                Contrat contrat,
                ContratGarantie guarantee
        ) {
            return rules.stream()
                    .filter(rule -> rule.getNature() == nature && rule.getBaseCalcul() == base)
                    .filter(rule -> category == null || rule.getCategorieBase() == category)
                    .filter(rule -> matches(rule, contrat, guarantee))
                    .max(Comparator.comparingInt(Catalogue::specificity)
                            .thenComparingInt(rule -> rule.getPriorite() == null ? 0 : rule.getPriorite())
                            .thenComparing(RegleFiscale::getDateDebut)
                            .thenComparing(rule -> rule.getId() == null ? 0L : rule.getId()));
        }

        private boolean matches(RegleFiscale rule, Contrat contrat, ContratGarantie guarantee) {
            if (rule.getCompagnieAssurance() != null && !sameId(rule.getCompagnieAssurance(), contrat.getCompagnieAssurance())) return false;
            if (rule.getCategorieClient() != null && !sameId(rule.getCategorieClient(), contrat.getCategorieClient())) return false;
            if (rule.getTypeContrat() != null && rule.getTypeContrat() != contrat.getTypeContrat()) return false;
            if (rule.getGarantie() != null && (guarantee == null || !sameId(rule.getGarantie(), guarantee.getGarantie()))) return false;
            if (rule.getTypeGarantie() != null && (guarantee == null || guarantee.getGarantie() == null
                    || rule.getTypeGarantie() != guarantee.getGarantie().getTypeGarantie())) return false;
            Usage usage = usage(contrat, guarantee);
            if (rule.getUsage() != null && !sameId(rule.getUsage(), usage)) return false;
            return rule.getGroupeUsageAttestation() == null
                    || usage != null && sameId(rule.getGroupeUsageAttestation(), usage.getGroupeUsageAttestation());
        }

        private static Usage usage(Contrat contrat, ContratGarantie guarantee) {
            if (guarantee != null && guarantee.getVehicule() != null) return guarantee.getVehicule().getUsage();
            if (guarantee != null && guarantee.getRemorque() != null) return guarantee.getRemorque().getUsage();
            return contrat.getUsage();
        }

        private static int specificity(RegleFiscale rule) {
            int score = 0;
            if (rule.getGarantie() != null) score += 64;
            if (rule.getCompagnieAssurance() != null) score += 32;
            if (rule.getCategorieClient() != null) score += 24;
            if (rule.getUsage() != null) score += 16;
            if (rule.getGroupeUsageAttestation() != null) score += 8;
            if (rule.getTypeGarantie() != null) score += 4;
            if (rule.getTypeContrat() != null) score += 2;
            if (rule.getCategorieBase() != null) score += 1;
            return score;
        }

        private static boolean sameId(Object left, Object right) {
            Long leftId = left instanceof com.assurance.entity.BaseEntity entity ? entity.getId() : null;
            Long rightId = right instanceof com.assurance.entity.BaseEntity entity ? entity.getId() : null;
            return leftId != null && Objects.equals(leftId, rightId);
        }
    }
}
