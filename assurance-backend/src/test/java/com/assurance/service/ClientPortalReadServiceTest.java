package com.assurance.service;

import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.*;
import com.assurance.security.ClientPortalPrincipal;
import org.junit.jupiter.api.*;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.*;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import java.util.List;
import java.util.Optional;
import static org.assertj.core.api.Assertions.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ClientPortalReadServiceTest {
    @Mock ClientPortalAuthService auth;
    @Mock ClientPortalAccessRepository accesses;
    @Mock ClientPortalDocumentRepository documents;
    @Mock ClientPortalClaimUpdateRepository updates;
    @Mock ClientPortalVehicleRepository vehicles;
    @Mock ClientPortalCoverageRepository coverages;
    @Mock ClientPortalAssistanceRepository assistances;
    @Mock StorageLayoutService storage;
    @InjectMocks ClientPortalReadService service;

    @BeforeEach
    void setup() {
        SecurityContextHolder.getContext().setAuthentication(new UsernamePasswordAuthenticationToken(
                new ClientPortalPrincipal(9L, 1L, 4L), null, List.of()));
    }

    @AfterEach
    void cleanup() {
        SecurityContextHolder.clearContext();
    }

    @Test
    void guessedContractIdNeverLoadsVehiclesWithoutAccountAndAgencyGrant() {
        when(accesses.visibleContract(1L, 9L, 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.contract(99L, 0, 25)).isInstanceOf(ResourceNotFoundException.class);
        verify(auth).currentAccount(true);
        verifyNoInteractions(vehicles);
    }

    @Test
    void guessedDocumentIdNeverResolvesAStoragePath() {
        when(documents.visible(1L, 9L, 99L)).thenReturn(Optional.empty());
        assertThatThrownBy(() -> service.download(99L)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void corruptedCrossAgencyDocumentSourceIsRejectedBeforeStorageLookup() {
        var agency = com.assurance.entity.Agence.builder().code("OTHER").nom("Other agency").build();
        agency.setId(2L);
        var contract = com.assurance.entity.Contrat.builder().agence(agency).build();
        contract.setId(69L);
        var access = new com.assurance.entity.ClientPortalAccess();
        access.setContrat(contract);
        var piece = com.assurance.entity.PieceJointe.builder().contrat(contract).build();
        var publication = new com.assurance.entity.ClientPortalDocument();
        publication.setAccess(access);
        publication.setPieceJointe(piece);
        when(documents.visible(1L, 9L, 99L)).thenReturn(Optional.of(publication));
        assertThatThrownBy(() -> service.download(99L)).isInstanceOf(ResourceNotFoundException.class);
        verifyNoInteractions(storage);
    }

    @Test
    void claimTimelineIsNotTheInternalClaimHistory() {
        assertThat(ClientPortalReadService.publicClaimStatus(com.assurance.enums.StatutSinistre.PARTIELLEMENT_REGLE))
                .isEqualTo("REGLEMENT_EN_COURS");
        assertThatThrownBy(() -> ClientPortalReadService.publicClaimStatus(com.assurance.enums.StatutSinistre.BROUILLON))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
