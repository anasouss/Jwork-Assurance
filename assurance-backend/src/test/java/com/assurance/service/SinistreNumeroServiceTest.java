package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.SequenceSinistre;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.SequenceSinistreRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SinistreNumeroServiceTest {

    @Mock
    private AgenceRepository agencies;

    @Mock
    private SequenceSinistreRepository sequences;

    @InjectMocks
    private SinistreNumeroService service;

    @Test
    void usesShortReferenceAndContinuesExistingAgencyYearCounter() {
        Agence agency = new Agence();
        SequenceSinistre sequence = SequenceSinistre.builder()
                .agence(agency).annee(2026).prochainNumero(2).build();
        when(agencies.findByIdForUpdate(1L)).thenReturn(Optional.of(agency));
        when(sequences.findByAgenceIdAndAnnee(1L, 2026)).thenReturn(Optional.of(sequence));

        assertThat(service.next(1L, 2026)).isEqualTo("SIN26-00002");
        assertThat(sequence.getProchainNumero()).isEqualTo(3);
        verify(sequences).save(sequence);
    }

    @Test
    void initializesCounterForNewAgencyYearWithoutTruncatingLargeNumbers() {
        Agence agency = new Agence();
        when(agencies.findByIdForUpdate(2L)).thenReturn(Optional.of(agency));
        when(sequences.findByAgenceIdAndAnnee(2L, 2027)).thenReturn(Optional.empty());
        when(sequences.save(any(SequenceSinistre.class))).thenAnswer(call -> call.getArgument(0));

        assertThat(service.next(2L, 2027)).isEqualTo("SIN27-00001");

        SequenceSinistre sequence = SequenceSinistre.builder()
                .agence(agency).annee(2027).prochainNumero(100000).build();
        when(sequences.findByAgenceIdAndAnnee(2L, 2027)).thenReturn(Optional.of(sequence));

        assertThat(service.next(2L, 2027)).isEqualTo("SIN27-100000");
    }
}
