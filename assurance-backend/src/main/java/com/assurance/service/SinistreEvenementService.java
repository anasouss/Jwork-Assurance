package com.assurance.service;

import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreEvenement;
import com.assurance.entity.Utilisateur;
import com.assurance.enums.StatutSinistre;
import com.assurance.enums.TypeEvenementSinistre;
import com.assurance.repository.SinistreEvenementRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;

@Service
@RequiredArgsConstructor
public class SinistreEvenementService {

    private final SinistreEvenementRepository evenementRepository;

    public void record(
            Sinistre sinistre,
            Utilisateur utilisateur,
            TypeEvenementSinistre type,
            String description
    ) {
        record(sinistre, utilisateur, type, description, null, null);
    }

    public void record(
            Sinistre sinistre,
            Utilisateur utilisateur,
            TypeEvenementSinistre type,
            String description,
            StatutSinistre ancienStatut,
            StatutSinistre nouveauStatut
    ) {
        evenementRepository.save(SinistreEvenement.builder()
                .sinistre(sinistre)
                .utilisateur(utilisateur)
                .type(type)
                .description(description)
                .ancienStatut(ancienStatut)
                .nouveauStatut(nouveauStatut)
                .build());
    }
}
