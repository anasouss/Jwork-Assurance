package com.assurance.service;

import com.assurance.dto.request.CreateClientRequest;
import com.assurance.entity.Client;
import com.assurance.enums.TypeClient;
import com.assurance.enums.TypePieceIdentite;
import com.assurance.exception.BadRequestException;
import org.junit.jupiter.api.Test;

import java.time.LocalDate;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class ClientProfilePolicyTest {
    @Test
    void preservesLegacyCinAndDerivesMoroccanResidenceFromReferenceCity() {
        var request = person();
        request.setCin("AB123");
        request.setCinValidite(LocalDate.now().plusYears(2));
        request.setVilleId(1L);
        ClientProfilePolicy.normalize(request);
        assertThat(request.getPaysResidence()).isEqualTo("MA");
        assertThat(request.getTypePieceIdentite()).isEqualTo(TypePieceIdentite.CIN);
        assertThatCode(() -> ClientProfilePolicy.validateIdentity(request)).doesNotThrowAnyException();
    }

    @Test
    void validatesSelectedPassportWithoutRequiringCinOrUsingItsExpiredDate() {
        var request = person();
        request.setTypePieceIdentite(TypePieceIdentite.PASSEPORT);
        request.setPassport("PA123");
        request.setPassportValidite(LocalDate.now().plusYears(3));
        request.setCin("OLD-CIN");
        request.setCinValidite(LocalDate.now().minusYears(1));
        assertThatCode(() -> ClientProfilePolicy.validateIdentity(request)).doesNotThrowAnyException();
        assertThat(request.getCin()).isEqualTo("OLD-CIN");
    }

    @Test
    void acceptsResidenceCardWithItsOwnValidityAndRejectsAnExpiredOne() {
        var request = person();
        request.setCarteResidence("CS123");
        request.setCarteResidenceValidite(LocalDate.now().plusYears(1));
        ClientProfilePolicy.normalize(request);
        assertThat(request.getTypePieceIdentite()).isEqualTo(TypePieceIdentite.CARTE_RESIDENCE);
        assertThatCode(() -> ClientProfilePolicy.validateIdentity(request)).doesNotThrowAnyException();
        request.setCarteResidenceValidite(LocalDate.now().minusDays(1));
        assertThatThrownBy(() -> ClientProfilePolicy.validateIdentity(request)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void requiresNumberAndValidityForTheSelectedDocument() {
        var request = person();
        request.setTypePieceIdentite(TypePieceIdentite.PASSEPORT);
        request.setCin("AB123");
        request.setCinValidite(LocalDate.now().plusYears(1));
        assertThatThrownBy(() -> ClientProfilePolicy.validateIdentity(request)).isInstanceOf(BadRequestException.class);
        request.setPassport("PA123");
        assertThatThrownBy(() -> ClientProfilePolicy.validateIdentity(request)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void storesActualForeignResidenceIndependentOfNationality() {
        var request = person();
        request.setNationalite("Marocaine");
        request.setPaysResidence("fr");
        request.setVilleEtrangere("Lyon");
        request.setAdresse("Rue 1");
        ClientProfilePolicy.normalize(request);
        assertThat(request.getPaysResidence()).isEqualTo("FR");
        assertThatCode(() -> ClientProfilePolicy.validateResidence(request)).doesNotThrowAnyException();
        request.setVilleEtrangere(null);
        assertThatThrownBy(() -> ClientProfilePolicy.validateResidence(request)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsInvalidCountriesAndConflictingLocalAndForeignCities() {
        var request = person();
        request.setPaysResidence("ETRANGER");
        assertThatThrownBy(() -> ClientProfilePolicy.normalize(request)).isInstanceOf(BadRequestException.class);
        request.setPaysResidence("FR");
        request.setVilleId(1L);
        assertThatThrownBy(() -> ClientProfilePolicy.normalize(request)).isInstanceOf(BadRequestException.class);
        request.setPaysResidence("MA");
        request.setVilleEtrangere("Lyon");
        assertThatThrownBy(() -> ClientProfilePolicy.normalize(request)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void doesNotInferCountryFromNationalityOrAnAddressPlaceholder() {
        var request = person();
        request.setNationalite("Française");
        request.setAdresse("ETRANGER");
        ClientProfilePolicy.normalize(request);
        assertThat(request.getPaysResidence()).isNull();
    }

    @Test
    void formatsForeignCityAndCountryWithoutAPlaceholderMoroccanCity() {
        var client = Client.builder().paysResidence("FR").villeEtrangere("Lyon").build();
        assertThat(client.getVilleResidence()).isEqualTo("Lyon, France");
    }

    private static CreateClientRequest person() {
        var request = new CreateClientRequest();
        request.setTypeClient(TypeClient.PERSONNE_PHYSIQUE);
        return request;
    }
}
