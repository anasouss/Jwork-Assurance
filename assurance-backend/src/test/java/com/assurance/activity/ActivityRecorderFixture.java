package com.assurance.activity;

import com.assurance.entity.Agence;
import com.assurance.entity.Utilisateur;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.BusinessActivityRepository;
import com.assurance.repository.UtilisateurRepository;
import com.fasterxml.jackson.databind.ObjectMapper;

import java.util.Optional;

import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.mock;

/** Real recorder/scopes with isolated persistence for existing service unit fixtures. */
public final class ActivityRecorderFixture {
    public final BusinessActivityRepository events = mock(BusinessActivityRepository.class);
    public final BusinessActivityRecorder recorder;

    public ActivityRecorderFixture() {
        AgenceRepository agencies = mock(AgenceRepository.class);
        UtilisateurRepository users = mock(UtilisateurRepository.class);
        lenient().when(agencies.getReferenceById(anyLong())).thenAnswer(call -> {
            Agence agency = Agence.builder().build();
            agency.setId(call.getArgument(0));
            return agency;
        });
        lenient().when(users.findById(anyLong())).thenAnswer(call -> {
            Utilisateur user = Utilisateur.builder().prenom("Test").nom("Operator").build();
            user.setId(call.getArgument(0));
            return Optional.of(user);
        });
        recorder = new BusinessActivityRecorder(events, agencies, users, new ObjectMapper());
    }
}
