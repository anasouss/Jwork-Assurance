package com.assurance.service;

import com.assurance.dto.request.QuoteAssistanceVoyageRequest;
import com.assurance.dto.response.AssistanceVoyageQuoteResponse;
import com.assurance.entity.CompagnieAssistance;
import com.assurance.entity.CodePromoAssistance;
import com.assurance.entity.ProduitAssistance;
import com.assurance.entity.TarifProduitAssistance;
import com.assurance.exception.BadRequestException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.AssistanceContratRepository;
import com.assurance.repository.BrancheAssuranceRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.CompagnieAssistanceRepository;
import com.assurance.repository.ContratClientRepository;
import com.assurance.repository.ContratRepository;
import com.assurance.repository.ElementFacturableRepository;
import com.assurance.repository.MouvementContratRepository;
import com.assurance.repository.LigneTarificationAssistanceRepository;
import com.assurance.repository.ProduitAssistanceRepository;
import com.assurance.repository.TypeMouvementContratRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Optional;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class AssistanceVoyageServiceTest {

    @Mock private AgenceRepository agenceRepository;
    @Mock private BrancheAssuranceRepository brancheAssuranceRepository;
    @Mock private CompagnieAssistanceRepository compagnieAssistanceRepository;
    @Mock private ProduitAssistanceRepository produitAssistanceRepository;
    @Mock private ContratRepository contratRepository;
    @Mock private ContratClientRepository contratClientRepository;
    @Mock private ClientRepository clientRepository;
    @Mock private ClientService clientService;
    @Mock private TarifProduitAssistanceService tarifProduitAssistanceService;
    @Mock private CodePromoAssistanceService codePromoAssistanceService;
    @Mock private TypeMouvementContratRepository typeMouvementContratRepository;
    @Mock private MouvementContratRepository mouvementContratRepository;
    @Mock private AssistanceContratRepository assistanceContratRepository;
    @Mock private ElementFacturableRepository elementFacturableRepository;
    @Mock private LigneTarificationAssistanceRepository ligneTarificationAssistanceRepository;

    @InjectMocks
    private AssistanceVoyageService service;

    @Test
    void quoteUsesSixMonthTariffAndAppliesConfiguredPromotion() {
        CompagnieAssistance compagnie = CompagnieAssistance.builder().actif(true).build();
        compagnie.setId(10L);
        ProduitAssistance produit = ProduitAssistance.builder()
                .compagnieAssistance(compagnie)
                .type("Assistance Voyage")
                .actif(true)
                .build();
        produit.setId(20L);
        TarifProduitAssistance tarif = TarifProduitAssistance.builder()
                .montantHt(new BigDecimal("120.00"))
                .montantTtc(new BigDecimal("144.00"))
                .actif(true)
                .build();
        CodePromoAssistance promo = CodePromoAssistance.builder()
                .code("VOYAGE10")
                .tauxReduction(new BigDecimal("10"))
                .actif(true)
                .build();
        QuoteAssistanceVoyageRequest request = request(6);
        request.setCodePromo("voyage10");

        when(compagnieAssistanceRepository.findById(10L)).thenReturn(Optional.of(compagnie));
        when(produitAssistanceRepository.findById(20L)).thenReturn(Optional.of(produit));
        when(tarifProduitAssistanceService.resolveTravelTarif(produit, request.getDateEffet(), 6, 30))
                .thenReturn(tarif);
        when(codePromoAssistanceService.resolve(produit, "voyage10", request.getDateEffet()))
                .thenReturn(promo);

        AssistanceVoyageQuoteResponse quote = service.quote(request);

        assertThat(quote.getDateEcheance()).isEqualTo(LocalDate.of(2026, 6, 30));
        assertThat(quote.getPrimeNette()).isEqualByComparingTo("108.00");
        assertThat(quote.getPrimeTotale()).isEqualByComparingTo("129.60");
        assertThat(quote.getMontantReduction()).isEqualByComparingTo("14.40");
    }

    @Test
    void quoteRejectsUnsupportedDuration() {
        assertThatThrownBy(() -> service.quote(request(18)))
                .isInstanceOf(BadRequestException.class)
                .hasMessageContaining("6 mois ou de 1 à 5 ans");
    }

    private QuoteAssistanceVoyageRequest request(int durationMonths) {
        QuoteAssistanceVoyageRequest request = new QuoteAssistanceVoyageRequest();
        request.setCompagnieAssistanceId(10L);
        request.setProduitAssistanceId(20L);
        request.setDateEffet(LocalDate.of(2026, 1, 1));
        request.setDureeMois(durationMonths);
        request.setDatesNaissanceAssures(List.of(LocalDate.of(1996, 1, 1)));
        return request;
    }
}
