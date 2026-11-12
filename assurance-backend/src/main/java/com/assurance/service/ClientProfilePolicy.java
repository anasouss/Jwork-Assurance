package com.assurance.service;

import com.assurance.dto.request.CreateClientRequest;
import com.assurance.entity.Client;
import com.assurance.enums.TypeClient;
import com.assurance.enums.TypePieceIdentite;
import com.assurance.exception.BadRequestException;

import java.time.LocalDate;
import java.util.Locale;
import java.util.Set;

final class ClientProfilePolicy {
    private static final Set<String> COUNTRIES = Set.of(Locale.getISOCountries());

    private ClientProfilePolicy() {
    }

    static TypePieceIdentite identityType(CreateClientRequest request) {
        if (request.getTypePieceIdentite() != null) return request.getTypePieceIdentite();
        if (hasText(request.getCin())) return TypePieceIdentite.CIN;
        if (hasText(request.getPassport())) return TypePieceIdentite.PASSEPORT;
        if (hasText(request.getCarteResidence())) return TypePieceIdentite.CARTE_RESIDENCE;
        return null;
    }

    static void normalize(CreateClientRequest request) {
        if (request.getVilleEtrangere() != null && request.getVilleEtrangere().length() > 160) {
            throw new BadRequestException("La ville a l'etranger est limitee a 160 caracteres");
        }
        String country = request.getPaysResidence();
        if (hasText(country)) {
            country = country.trim().toUpperCase(Locale.ROOT);
            if (!COUNTRIES.contains(country)) throw new BadRequestException("Pays de residence invalide");
            request.setPaysResidence(country);
            if (!"MA".equals(country) && request.getVilleId() != null) {
                throw new BadRequestException("Une residence a l'etranger ne peut pas etre rattachee a une ville marocaine");
            }
            if ("MA".equals(country) && hasText(request.getVilleEtrangere())) {
                throw new BadRequestException("Selectionnez une ville marocaine pour une residence au Maroc");
            }
        } else if (request.getVilleId() != null) {
            request.setPaysResidence("MA");
        } else if (hasText(request.getVilleEtrangere())) {
            throw new BadRequestException("Le pays de residence est obligatoire pour une ville a l'etranger");
        } else {
            request.setPaysResidence(null);
        }
        if (request.getTypeClient() == TypeClient.PERSONNE_PHYSIQUE) {
            request.setTypePieceIdentite(identityType(request));
        } else {
            request.setTypePieceIdentite(null);
        }
        if (request.getClientEtranger() == null) {
            request.setClientEtranger((request.getTypePieceIdentite() != null
                    && request.getTypePieceIdentite() != TypePieceIdentite.CIN)
                    || (hasText(request.getPaysResidence()) && !"MA".equals(request.getPaysResidence())));
        }
    }

    static void validateIdentity(CreateClientRequest request) {
        if (request.getTypeClient() != TypeClient.PERSONNE_PHYSIQUE) return;
        TypePieceIdentite type = identityType(request);
        if (type == null) throw new BadRequestException("Selectionnez une piece d'identite");
        String number = switch (type) {
            case CIN -> request.getCin();
            case PASSEPORT -> request.getPassport();
            case CARTE_RESIDENCE -> request.getCarteResidence();
        };
        LocalDate expiry = switch (type) {
            case CIN -> request.getCinValidite();
            case PASSEPORT -> request.getPassportValidite();
            case CARTE_RESIDENCE -> request.getCarteResidenceValidite();
        };
        if (!hasText(number) || expiry == null) {
            throw new BadRequestException("Le numero et la validite de la piece d'identite selectionnee sont obligatoires");
        }
        if (expiry.isBefore(LocalDate.now())) {
            throw new BadRequestException("La piece d'identite selectionnee est expiree");
        }
    }

    static void validateResidence(CreateClientRequest request) {
        String country = request.getPaysResidence();
        boolean foreign = hasText(country) && !"MA".equals(country);
        if ((foreign ? !hasText(request.getVilleEtrangere()) : request.getVilleId() == null)
                || !hasText(request.getAdresse())) {
            throw new BadRequestException("La ville et l'adresse de residence sont obligatoires");
        }
    }

    static CreateClientRequest profile(Client client) {
        CreateClientRequest request = new CreateClientRequest();
        org.springframework.beans.BeanUtils.copyProperties(client, request);
        request.setVilleId(client.getVille() == null ? null : client.getVille().getId());
        normalize(request);
        return request;
    }

    private static boolean hasText(String value) {
        return value != null && !value.isBlank();
    }
}
