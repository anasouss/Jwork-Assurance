package com.assurance.activity;

import com.assurance.dto.request.CancelAttestationStockRequest;
import com.assurance.entity.Agence;
import com.assurance.entity.AttestationStock;
import com.assurance.entity.CompagnieAssurance;
import com.assurance.entity.Contrat;
import com.assurance.entity.GroupeUsageAttestation;
import com.assurance.entity.LivraisonAttestation;
import com.assurance.entity.LotAttestation;
import com.assurance.enums.StatutAttestationStock;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AttestationStockRepository;
import com.assurance.repository.CategorieClientRepository;
import com.assurance.repository.CompagnieAssuranceRepository;
import com.assurance.repository.GroupeUsageAttestationRepository;
import com.assurance.repository.MouvementStockAttestationRepository;
import com.assurance.repository.SeuilStockAttestationRepository;
import com.assurance.repository.UsageRepository;
import com.assurance.service.AttestationNumeroService;
import com.assurance.service.AttestationStockService;
import com.assurance.service.ParametreApplicationService;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.argThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

class StockActivityTest {
    private final AttestationStockRepository stockRepository = mock(AttestationStockRepository.class);
    private final ActivityRecorderFixture activity = new ActivityRecorderFixture();
    private final MouvementStockAttestationRepository movements = mock(MouvementStockAttestationRepository.class);
    private final AttestationStockService service = new AttestationStockService(stockRepository, mock(AgenceRepository.class),
            movements, mock(SeuilStockAttestationRepository.class), mock(CompagnieAssuranceRepository.class),
            mock(CategorieClientRepository.class), mock(GroupeUsageAttestationRepository.class), mock(UsageRepository.class),
            mock(ParametreApplicationService.class), mock(AttestationNumeroService.class), activity.recorder);

    @Test
    void cancellationUsesLockedStockNumberAndRecordsOneActionNotThresholdWrites() {
        var stock = stock();
        when(stockRepository.findGestionnableByIdAndAgenceIdForUpdate(1180L, 7L)).thenReturn(Optional.of(stock));
        var request = new CancelAttestationStockRequest();
        request.setMotif("Mauvaise edition");
        service.annuler(7L, 1180L, request);
        verify(activity.events).save(argThat(event -> event.getAction() == ActivityAction.CANCELLED
                && event.getTitle().equals("Attestation 90A211049998 annulee")
                && event.getSubjectLabel().equals(stock.getNumero())
                && event.getChangesJson().contains("Mauvaise edition")));
        verify(movements).save(argThat(movement -> stock.getNumero().equals(movement.getNumeroAvant())));
    }

    @Test
    void invalidCancellationDoesNotCreateActivity() {
        var stock = stock();
        stock.setStatut(StatutAttestationStock.UTILISEE);
        when(stockRepository.findGestionnableByIdAndAgenceIdForUpdate(1180L, 7L)).thenReturn(Optional.of(stock));
        assertThatThrownBy(() -> service.annuler(7L, 1180L, new CancelAttestationStockRequest()))
                .isInstanceOf(BadRequestException.class);
        verifyNoInteractions(activity.events, movements);
    }

    @Test
    void releaseRetainsOriginalContractReferenceAfterForeignKeyIsCleared() {
        var stock = stock();
        var contract = Contrat.builder().numeroDossier("MATU26-0026").build();
        contract.setId(99L);
        stock.setContrat(contract);
        stock.setNumeroDossier(contract.getNumeroDossier());
        stock.setStatut(StatutAttestationStock.UTILISEE);
        var before = StockActivity.snapshot(stock);
        var oldReferences = StockActivity.references(stock);
        stock.setContrat(null);
        stock.setNumeroDossier(null);
        stock.setStatut(StatutAttestationStock.DISPONIBLE);
        var command = StockActivity.command(stock, before, oldReferences, ActivityAction.UNASSIGNED,
                "Attestation liberee du contrat", "ATTESTATION_CONTRACT_RELEASE");
        assertThat(command.references()).contains(ActivityReference.of(ActivityRecordType.CONTRAT, 99L, "MATU26-0026"));
        assertThat(command.changes()).contains(new ActivityChange("Dossier", "MATU26-0026", null));
    }

    @Test
    void deliveryContainsRangesButDoesNotCreateAReferenceForEveryStockItem() {
        var stock = stock();
        var lot = stock.getLot();
        lot.setNumeroDebut("000001");
        lot.setNumeroFin("001000");
        lot.setQuantite(1000);
        lot.getLivraison().getLots().add(lot);
        lot.getAttestations().addAll(List.of(stock, stock, stock));
        var command = StockActivity.deliveryCommand(lot.getLivraison(), java.util.Map.of(), ActivityAction.SAVED,
                "Reception enregistree", "ATTESTATION_LOTS_RECEIPT");
        assertThat(command.references()).hasSize(2);
        assertThat(command.changes()).contains(new ActivityChange("Lot 1 - Quantite", null, "1000"));
    }

    private AttestationStock stock() {
        var agency = Agence.builder().nom("Agence test").build();
        agency.setId(7L);
        var company = CompagnieAssurance.builder().nom("MATU").build();
        company.setId(4L);
        var group = GroupeUsageAttestation.builder().code("A").libelle("Tourisme").build();
        group.setId(1L);
        var delivery = LivraisonAttestation.builder().agence(agency).compagnieAssurance(company)
                .referenceCommande("CMD-26-000001").build();
        delivery.setId(10L);
        var lot = LotAttestation.builder().livraison(delivery).groupeUsageAttestation(group).build();
        lot.setId(20L);
        var stock = AttestationStock.builder().lot(lot).compagnieAssurance(company).groupeUsageAttestation(group)
                .numero("90A211049998").statut(StatutAttestationStock.DISPONIBLE).build();
        stock.setId(1180L);
        return stock;
    }
}
