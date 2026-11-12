package com.assurance.service;

import com.assurance.entity.BrancheAssurance;
import com.assurance.entity.Client;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.ContratClient;
import com.assurance.entity.Garantie;
import com.assurance.entity.MouvementContrat;
import com.assurance.entity.MouvementGarantie;
import com.assurance.entity.MouvementVehicule;
import com.assurance.entity.TypeMouvementContrat;
import com.assurance.entity.Vehicule;
import com.assurance.enums.NatureSnapshotMouvement;
import com.assurance.enums.RoleClientContrat;
import com.assurance.enums.StatutMouvementContrat;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.MouvementGarantieRepository;
import com.assurance.repository.MouvementVehiculeRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.NullSource;
import org.junit.jupiter.params.provider.ValueSource;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class SinistreCouvertureServiceTest {

    private final ContratRepository contracts = mock(ContratRepository.class);
    private final ContratClientRepository clients = mock(ContratClientRepository.class);
    private final MouvementContratRepository movements = mock(MouvementContratRepository.class);
    private final MouvementVehiculeRepository vehicles = mock(MouvementVehiculeRepository.class);
    private final MouvementGarantieRepository guarantees = mock(MouvementGarantieRepository.class);
    private final SinistreCouvertureService service = new SinistreCouvertureService(
            contracts, clients, movements, vehicles, guarantees
    );
    private final LocalDate lossDate = LocalDate.of(2026, 6, 10);
    private Contrat contract;
    private MouvementContrat initial;
    private MouvementContrat amendment;
    private Vehicule vehicle;
    private Garantie guarantee;

    @BeforeEach
    void setUp() {
        contract = Contrat.builder()
                .brouillon(false)
                .prospection(false)
                .dateEffet(LocalDate.of(2026, 1, 1))
                .dateEcheance(LocalDate.of(2026, 12, 31))
                .brancheAssurance(BrancheAssurance.builder().code("AUTOMOBILE").build())
                .compagnieAssurance(CompagnieAssurance.builder().code("CIE").nom("Compagnie").build())
                .build();
        contract.setId(2L);
        vehicle = new Vehicule();
        vehicle.setId(3L);
        guarantee = Garantie.builder().code("RC").libelle("Responsabilité civile").responsabiliteCivile(true).build();
        guarantee.setId(4L);
        initial = movement(10L, "1", LocalDate.of(2026, 1, 1));
        amendment = movement(11L, "2", LocalDate.of(2026, 5, 1));
        when(contracts.findByAgenceIdAndId(1L, 2L)).thenReturn(Optional.of(contract));
        when(movements.findByContratIdOrderByCreatedAtDesc(2L)).thenReturn(List.of(amendment, initial));
        when(vehicles.findByMouvementContratId(10L)).thenReturn(List.of(vehicleSnapshot(NatureSnapshotMouvement.AJOUT)));
        when(guarantees.findByMouvementContratId(10L)).thenReturn(List.of(guaranteeSnapshot(NatureSnapshotMouvement.AJOUT)));
        when(clients.findByContratIdIn(List.of(2L))).thenReturn(List.of(ContratClient.builder()
                .client(Client.builder().nom("Assuré").build()).role(RoleClientContrat.SOUSCRIPTEUR).build()));
    }

    @Test
    void removedLastVehicleIsNotStillEligibleWithoutAnAfterSnapshot() {
        when(vehicles.findByMouvementContratId(11L)).thenReturn(List.of(vehicleSnapshot(NatureSnapshotMouvement.AVANT)));

        assertThatThrownBy(() -> service.resolve(1L, 2L, 3L, lossDate))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Aucun véhicule couvert");
    }

    @Test
    void removedLastGuaranteeIsNotStillCoveredWithoutAnAfterSnapshot() {
        when(guarantees.findByMouvementContratId(11L)).thenReturn(List.of(guaranteeSnapshot(NatureSnapshotMouvement.AVANT)));

        assertThatThrownBy(() -> service.resolve(1L, 2L, 3L, lossDate))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Aucune garantie couverte");
    }

    @Test
    void laterRetirementDoesNotRemoveCoverageBeforeItsEffectiveDate() {
        amendment.setDateEffet(lossDate.plusDays(1));
        when(vehicles.findByMouvementContratId(11L)).thenReturn(List.of(vehicleSnapshot(NatureSnapshotMouvement.RETRAIT)));
        when(guarantees.findByMouvementContratId(11L)).thenReturn(List.of(guaranteeSnapshot(NatureSnapshotMouvement.RETRAIT)));

        var coverage = service.resolve(1L, 2L, 3L, lossDate);

        assertThat(coverage.vehicule().getId()).isEqualTo(3L);
        assertThat(coverage.garanties()).extracting(item -> item.getGarantie().getId()).containsExactly(4L);
        assertThat(coverage.mouvement().getId()).isEqualTo(10L);
    }

    @Test
    void closedContractIsRejectedFromClosureEffectiveDateButNotBefore() {
        amendment.setTypeMouvement(TypeMouvementContrat.builder().clotureContrat(true).build());

        assertThatThrownBy(() -> service.resolve(1L, 2L, 3L, lossDate))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("clôturé");
        assertThat(service.resolve(1L, 2L, 3L, LocalDate.of(2026, 4, 30)).mouvement().getId()).isEqualTo(10L);
    }

    @Test
    void vehicleCoverageDatesAreAppliedInclusively() {
        var snapshot = vehicleSnapshot(NatureSnapshotMouvement.AJOUT);
        snapshot.setDateEffet(lossDate);
        snapshot.setDateEcheance(lossDate);
        when(vehicles.findByMouvementContratId(10L)).thenReturn(List.of(snapshot));

        assertThat(service.resolve(1L, 2L, 3L, lossDate).vehicule()).isEqualTo(vehicle);
        assertThatThrownBy(() -> service.resolve(1L, 2L, 3L, lossDate.plusDays(1)))
                .isInstanceOf(BadRequestException.class).hasMessageContaining("Aucun véhicule couvert");
    }

    @Test
    void foreignAgencyContractIsRejectedBeforeReadingItsMovements() {
        assertThatThrownBy(() -> service.resolve(9L, 2L, 3L, lossDate))
                .isInstanceOf(ResourceNotFoundException.class);
        verify(contracts).findByAgenceIdAndId(9L, 2L);
        verifyNoInteractions(movements, vehicles, guarantees);
    }

    @ParameterizedTest
    @NullSource
    @ValueSource(booleans = {true, false})
    void coveragePreviewIncludesConfiguredResponsibilityFlag(Boolean responsabiliteCivile) {
        guarantee.setResponsabiliteCivile(responsabiliteCivile);
        var globalSnapshot = guaranteeSnapshot(NatureSnapshotMouvement.AJOUT);
        globalSnapshot.setVehicule(null);
        when(guarantees.findByMouvementContratId(10L)).thenReturn(List.of(globalSnapshot));

        var preview = service.preview(1L, 2L, lossDate);

        boolean expected = Boolean.TRUE.equals(responsabiliteCivile);
        assertThat(preview.getGaranties()).singleElement()
                .satisfies(item -> assertThat(item.isResponsabiliteCivile()).isEqualTo(expected));
        assertThat(preview.getVehicules()).singleElement()
                .satisfies(item -> assertThat(item.getGaranties()).singleElement()
                        .satisfies(coverage -> assertThat(coverage.isResponsabiliteCivile()).isEqualTo(expected)));
    }

    @Test
    void vehicleGuaranteePreviewIncludesResponsibilityFlag() {
        var preview = service.preview(1L, 2L, lossDate);

        assertThat(preview.getGaranties()).isEmpty();
        assertThat(preview.getVehicules()).singleElement()
                .satisfies(item -> assertThat(item.getGaranties()).singleElement()
                        .satisfies(coverage -> assertThat(coverage.isResponsabiliteCivile()).isTrue()));
    }

    private MouvementContrat movement(Long id, String number, LocalDate effectiveDate) {
        var result = MouvementContrat.builder()
                .contrat(contract).numeroMouvement(number).statut(StatutMouvementContrat.VALIDE)
                .dateEffet(effectiveDate).dateEcheance(LocalDate.of(2026, 12, 31))
                .typeMouvement(TypeMouvementContrat.builder().code("AN").libelle("Affaire nouvelle").build()).build();
        result.setId(id);
        return result;
    }

    private MouvementVehicule vehicleSnapshot(NatureSnapshotMouvement nature) {
        return MouvementVehicule.builder().vehicule(vehicle).nature(nature).immatriculation("123-A-1").build();
    }

    private MouvementGarantie guaranteeSnapshot(NatureSnapshotMouvement nature) {
        return MouvementGarantie.builder().garantie(guarantee).vehicule(vehicle).nature(nature).build();
    }
}
