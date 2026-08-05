package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.SequenceSinistre;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.SequenceSinistreRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

import java.util.Locale;

@Service
@RequiredArgsConstructor
public class SinistreNumeroService {

    private final AgenceRepository agenceRepository;
    private final SequenceSinistreRepository sequenceRepository;

    public String next(Long agenceId, int annee) {
        Agence agence = agenceRepository.findByIdForUpdate(agenceId)
                .orElseThrow(() -> new ResourceNotFoundException("Agence", agenceId));
        SequenceSinistre sequence = sequenceRepository.findByAgenceIdAndAnnee(agenceId, annee)
                .orElseGet(() -> sequenceRepository.save(SequenceSinistre.builder()
                        .agence(agence)
                        .annee(annee)
                        .prochainNumero(1)
                        .build()));
        int numero = sequence.getProchainNumero();
        sequence.setProchainNumero(numero + 1);
        sequenceRepository.save(sequence);
        return String.format(
                Locale.ROOT,
                "SIN/%s/%d/%05d",
                agence.getCode(),
                annee,
                numero
        );
    }
}
