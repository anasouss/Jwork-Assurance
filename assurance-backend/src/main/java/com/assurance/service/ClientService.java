package com.assurance.service;

import com.assurance.dto.request.CreateClientRequest;
import com.assurance.dto.response.ClientResponse;
import com.assurance.entity.Agence;
import com.assurance.entity.CategorieClient;
import com.assurance.entity.Client;
import com.assurance.entity.ClientTelephone;
import com.assurance.entity.Ville;
import com.assurance.exception.BadRequestException;
import com.assurance.exception.ResourceNotFoundException;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.CategorieClientRepository;
import com.assurance.repository.ClientRepository;
import com.assurance.repository.ClientTelephoneRepository;
import com.assurance.repository.VilleRepository;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@RequiredArgsConstructor
public class ClientService {

    private final AgenceRepository agenceRepository;
    private final ClientRepository clientRepository;
    private final ClientTelephoneRepository clientTelephoneRepository;
    private final VilleRepository villeRepository;
    private final CategorieClientRepository categorieClientRepository;

    @Transactional
    public ClientResponse create(CreateClientRequest request) {
        return toResponse(createEntity(request));
    }

    @Transactional
    public Client createEntity(CreateClientRequest request) {
        if (request.getAgenceId() == null || request.getAgenceId().isBlank()) {
            throw new BadRequestException("L'agence est obligatoire");
        }
        if (request.getTypeClient() == null) {
            throw new BadRequestException("Le type client est obligatoire");
        }
        Agence agence = agenceRepository.findById(request.getAgenceId())
                .orElseThrow(() -> new ResourceNotFoundException("Agence", request.getAgenceId()));
        Client clientParent = request.getClientParentId() == null ? null :
                clientRepository.findByAgenceIdAndId(request.getAgenceId(), request.getClientParentId())
                        .orElseThrow(() -> new ResourceNotFoundException("Client parent", request.getClientParentId()));
        Ville ville = request.getVilleId() == null ? null :
                villeRepository.findById(request.getVilleId())
                        .orElseThrow(() -> new ResourceNotFoundException("Ville", request.getVilleId()));
        CategorieClient categorieClient = request.getCategorieClientId() == null ? null :
                categorieClientRepository.findById(request.getCategorieClientId())
                        .orElseThrow(() -> new ResourceNotFoundException("CategorieClient", request.getCategorieClientId()));
        if (Boolean.TRUE.equals(request.getSahara()) && (ville == null || !Boolean.TRUE.equals(ville.getSaharienne()))) {
            throw new BadRequestException("La reduction saharienne n'est disponible que pour une ville saharienne");
        }
        String telephonePrincipal = resolveTelephonePrincipal(request);
        Client client = Client.builder()
                .agence(agence)
                .clientParent(clientParent)
                .ville(ville)
                .categorieClient(categorieClient)
                .typeClient(request.getTypeClient())
                .codeClient(request.getCodeClient())
                .civilite(request.getCivilite())
                .prenom(request.getPrenom())
                .nom(request.getNom())
                .raisonSociale(request.getRaisonSociale())
                .cin(request.getCin())
                .rc(request.getRc())
                .ice(request.getIce())
                .numeroPermis(request.getNumeroPermis())
                .dateDelivrancePermis(request.getDateDelivrancePermis())
                .dateValiditePermis(request.getDateValiditePermis())
                .dateNaissance(request.getDateNaissance())
                .adresse(request.getAdresse())
                .telephone(telephonePrincipal)
                .email(request.getEmail())
                .cinValidite(request.getCinValidite())
                .nationalite(request.getNationalite())
                .passport(request.getPassport())
                .carteResidence(request.getCarteResidence())
                .iff(request.getIff())
                .patente(request.getPatente())
                .cnss(request.getCnss())
                .activite(request.getActivite())
                .conducteurHabituel(request.getConducteurHabituel() == null ? true : request.getConducteurHabituel())
                .sahara(request.getSahara() == null ? false : request.getSahara())
                .justificatifSahara(request.getJustificatifSahara())
                .build();
        client = clientRepository.save(client);
        saveTelephones(client, request);
        return client;
    }

    private ClientResponse toResponse(Client client) {
        var telephones = client.getTelephones() == null ? java.util.List.<ClientResponse.TelephoneView>of() :
                client.getTelephones().stream()
                        .map(telephone -> ClientResponse.TelephoneView.builder()
                                .id(telephone.getId())
                                .numero(telephone.getNumero())
                                .whatsapp(telephone.getWhatsapp())
                                .principal(telephone.getPrincipal())
                                .build())
                        .toList();
        return ClientResponse.builder()
                .id(client.getId())
                .agenceId(client.getAgence() != null ? client.getAgence().getId() : null)
                .clientParentId(client.getClientParent() != null ? client.getClientParent().getId() : null)
                .typeClient(client.getTypeClient())
                .codeClient(client.getCodeClient())
                .nomAffichage(client.getNomAffichage())
                .civilite(client.getCivilite())
                .prenom(client.getPrenom())
                .nom(client.getNom())
                .raisonSociale(client.getRaisonSociale())
                .cin(client.getCin())
                .rc(client.getRc())
                .ice(client.getIce())
                .numeroPermis(client.getNumeroPermis())
                .cinValidite(client.getCinValidite())
                .dateDelivrancePermis(client.getDateDelivrancePermis())
                .dateValiditePermis(client.getDateValiditePermis())
                .dateNaissance(client.getDateNaissance())
                .adresse(client.getAdresse())
                .villeId(client.getVille() != null ? client.getVille().getId() : null)
                .ville(client.getVille() != null ? client.getVille().getNom() : null)
                .villeSaharienne(client.getVille() != null ? client.getVille().getSaharienne() : null)
                .categorieClientId(client.getCategorieClient() != null ? client.getCategorieClient().getId() : null)
                .categorieClientCode(client.getCategorieClient() != null ? client.getCategorieClient().getCode() : null)
                .categorieClientLibelle(client.getCategorieClient() != null ? client.getCategorieClient().getLibelle() : null)
                .telephone(client.getTelephone())
                .email(client.getEmail())
                .nationalite(client.getNationalite())
                .passport(client.getPassport())
                .carteResidence(client.getCarteResidence())
                .iff(client.getIff())
                .patente(client.getPatente())
                .cnss(client.getCnss())
                .activite(client.getActivite())
                .conducteurHabituel(client.getConducteurHabituel())
                .sahara(client.getSahara())
                .justificatifSahara(client.getJustificatifSahara())
                .actif(client.getActif())
                .telephones(telephones)
                .build();
    }

    private String resolveTelephonePrincipal(CreateClientRequest request) {
        if (request.getTelephones() == null || request.getTelephones().isEmpty()) {
            return request.getTelephone();
        }
        return request.getTelephones().stream()
                .filter(input -> Boolean.TRUE.equals(input.getPrincipal()))
                .findFirst()
                .or(() -> request.getTelephones().stream().findFirst())
                .map(CreateClientRequest.TelephoneInput::getNumero)
                .orElse(request.getTelephone());
    }

    private void saveTelephones(Client client, CreateClientRequest request) {
        if (request.getTelephones() == null || request.getTelephones().isEmpty()) {
            if (request.getTelephone() == null || request.getTelephone().isBlank()) {
                return;
            }
            ClientTelephone telephone = clientTelephoneRepository.save(ClientTelephone.builder()
                    .client(client)
                    .numero(request.getTelephone())
                    .principal(true)
                    .whatsapp(false)
                    .build());
            client.getTelephones().add(telephone);
            return;
        }

        boolean principalDejaDefini = false;
        for (CreateClientRequest.TelephoneInput input : request.getTelephones()) {
            if (input.getNumero() == null || input.getNumero().isBlank()) {
                throw new BadRequestException("Le numero de telephone est obligatoire");
            }
            boolean principal = Boolean.TRUE.equals(input.getPrincipal()) && !principalDejaDefini;
            principalDejaDefini = principalDejaDefini || principal;
            ClientTelephone telephone = clientTelephoneRepository.save(ClientTelephone.builder()
                    .client(client)
                    .numero(input.getNumero())
                    .principal(principal)
                    .whatsapp(input.getWhatsapp() == null ? false : input.getWhatsapp())
                    .build());
            client.getTelephones().add(telephone);
        }
        if (!principalDejaDefini && !client.getTelephones().isEmpty()) {
            client.getTelephones().get(0).setPrincipal(true);
        }
    }
}
