package com.assurance.service;

import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.TiersCompagnie;
import com.assurance.enums.TypeTiersCompagnie;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.TiersCompagnieRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.List;

@Service
@RequiredArgsConstructor
public class TiersCompagnieService {

    private final TiersCompagnieRepository tiersRepository;

    @Transactional(readOnly = true)
    public TiersCompagnie require(Long id) {
        TiersCompagnie tiers = tiersRepository.findById(id)
                .orElseThrow(() -> new ResourceNotFoundException("TiersCompagnie", id));
        validate(tiers);
        return tiers;
    }

    @Transactional
    public TiersCompagnie resolveAssurance(CompagnieAssurance compagnie) {
        if (compagnie == null) {
            throw new BadRequestException("La compagnie d'assurance est obligatoire");
        }
        return tiersRepository.findByCompagnieAssuranceId(compagnie.getId())
                .map(this::validated)
                .orElseGet(() -> tiersRepository.save(TiersCompagnie.builder()
                        .type(TypeTiersCompagnie.ASSURANCE)
                        .compagnieAssurance(compagnie)
                        .build()));
    }

    @Transactional
    public TiersCompagnie resolveAssistance(CompagnieAssistance compagnie) {
        if (compagnie == null) {
            throw new BadRequestException("La compagnie d'assistance est obligatoire");
        }
        return tiersRepository.findByCompagnieAssistanceId(compagnie.getId())
                .map(this::validated)
                .orElseGet(() -> tiersRepository.save(TiersCompagnie.builder()
                        .type(TypeTiersCompagnie.ASSISTANCE)
                        .compagnieAssistance(compagnie)
                        .build()));
    }

    @Transactional
    public TiersCompagnie requireActive(Long id) {
        TiersCompagnie tiers = require(id);
        if (!tiers.isActif()) {
            throw new BadRequestException("Le tiers compagnie est inactif");
        }
        return tiers;
    }

    @Transactional(readOnly = true)
    public List<TiersCompagnie> listActive() {
        return tiersRepository.findAllByOrderByTypeAscIdAsc().stream()
                .map(this::validated)
                .filter(TiersCompagnie::isActif)
                .toList();
    }

    private TiersCompagnie validated(TiersCompagnie tiers) {
        validate(tiers);
        return tiers;
    }

    private void validate(TiersCompagnie tiers) {
        boolean assurance = tiers.getCompagnieAssurance() != null;
        boolean assistance = tiers.getCompagnieAssistance() != null;
        if (tiers.getType() == null
                || assurance == assistance
                || (tiers.getType() == TypeTiersCompagnie.ASSURANCE && !assurance)
                || (tiers.getType() == TypeTiersCompagnie.ASSISTANCE && !assistance)) {
            throw new BadRequestException("Configuration du tiers compagnie invalide");
        }
    }
}
