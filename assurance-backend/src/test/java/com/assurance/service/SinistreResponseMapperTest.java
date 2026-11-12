package com.assurance.service;

import com.assurance.entity.Agence;
import com.assurance.entity.Contrat;
import com.assurance.entity.MissionExpertise;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.Sinistre;
import com.assurance.entity.SinistreCouverture;
import com.assurance.entity.SinistreGarantie;
import com.assurance.enums.EtapeSuiviSinistre;
import com.assurance.enums.ModeReparationSinistre;
import com.assurance.enums.StatutMissionExpertise;
import com.assurance.enums.StatutSinistre;
import com.assurance.repository.MissionExpertiseRepository;
import com.assurance.repository.ProvisionSinistreRepository;
import com.assurance.repository.SinistreCouvertureRepository;
import com.assurance.repository.SinistreDocumentRepository;
import com.assurance.repository.SinistreEvenementRepository;
import com.assurance.repository.SinistreGarantieRepository;
import com.assurance.repository.SinistreOperationRepository;
import com.assurance.repository.SinistrePartieRepository;
import org.junit.jupiter.api.Test;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class SinistreResponseMapperTest {
    private final SinistreGarantieRepository guarantees = mock(SinistreGarantieRepository.class);
    private final MissionExpertiseRepository missions = mock(MissionExpertiseRepository.class);
    private final SinistreReadinessService readiness = mock(SinistreReadinessService.class);
    private final SinistreResponseMapper mapper = new SinistreResponseMapper(
            mock(SinistreCouvertureRepository.class), guarantees, mock(SinistrePartieRepository.class),
            mock(SinistreDocumentRepository.class), missions, mock(ProvisionSinistreRepository.class),
            mock(SinistreOperationRepository.class), mock(SinistreDocumentRequirementService.class),
            mock(SinistreEvenementRepository.class), readiness, mock(SinistreSuiviService.class));

    @Test
    void detailAndSummaryShareOriginalSnapshotsAndDeterministicFirstExpert() {
        Agence agency = new Agence();
        agency.setId(1L);
        Sinistre claim = Sinistre.builder().agence(agency)
                .contrat(Contrat.builder().numeroPolice("Police modifiee").build())
                .mouvementCouverture(new MouvementContrat())
                .statut(StatutSinistre.DECLARE).etapeSuivi(EtapeSuiviSinistre.INSTANCE_CLIENT)
                .modeReparation(ModeReparationSinistre.NORMAL)
                .couverture(SinistreCouverture.builder().numeroPolice("Police historique")
                        .assure("Assure historique").immatriculation("123-A-1").build()).build();
        claim.setId(10L);
        MissionExpertise first = mission(20L, "Premier expert", StatutMissionExpertise.VALIDEE);
        MissionExpertise second = mission(21L, "Second expert", StatutMissionExpertise.MANDATEE);
        MissionExpertise cancelled = mission(19L, "Expert annule", StatutMissionExpertise.ANNULEE);
        when(missions.findBySinistreIdOrderByDateMissionDescCreatedAtDesc(10L)).thenReturn(List.of(second, cancelled, first));
        when(guarantees.findForDetailOrderByConfiguredDisplay(10L)).thenReturn(List.of(
                SinistreGarantie.builder().garantie(new com.assurance.entity.Garantie()).impliquee(true)
                        .snapshotLibelle("RC historique").responsabiliteCivile(true).build()));
        when(readiness.totalIndemnisable(10L)).thenReturn(BigDecimal.ZERO);

        var summary = mapper.toSummary(claim);
        var detail = mapper.toDetail(claim);

        assertThat(summary.getNumeroPolice()).isEqualTo("Police historique");
        assertThat(summary.getAssure()).isEqualTo("Assure historique");
        assertThat(detail.getCouverture().getNumeroPolice()).isEqualTo(summary.getNumeroPolice());
        assertThat(detail.getPremierExpert()).isEqualTo(summary.getPremierExpert()).isEqualTo("Premier expert");
        assertThat(detail.getGarantiesImpliquees()).isEqualTo(summary.getGarantiesImpliquees()).containsExactly("RC historique");
        assertThat(detail.getEtapeSuivi()).isEqualTo(summary.getEtapeSuivi());
        assertThat(detail.getModeReparation()).isEqualTo(summary.getModeReparation());
        assertThat(detail.getGaranties().get(0).isResponsabiliteCivile()).isTrue();
    }

    private MissionExpertise mission(Long id, String name, StatutMissionExpertise status) {
        MissionExpertise result = MissionExpertise.builder().expert(new com.assurance.entity.ExpertSinistre())
                .expertNomSnapshot(name).dateMission(LocalDate.of(2026, 11, 1)).statut(status).build();
        result.setId(id);
        return result;
    }
}
