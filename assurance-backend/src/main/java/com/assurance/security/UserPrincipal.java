package com.assurance.security;

import com.assurance.entity.Utilisateur;
import lombok.AllArgsConstructor;
import lombok.Getter;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;

import java.util.Collection;
import java.util.Set;
import java.util.stream.Collectors;

@Getter
@AllArgsConstructor
public class UserPrincipal implements UserDetails {

    private final String id;
    private final String email;
    private final String password;
    private final String roleCode;
    private final String agenceId;
    private final boolean active;
    private final Set<String> permissions;

    public static UserPrincipal from(Utilisateur user) {
        return new UserPrincipal(
                user.getId(),
                user.getEmail(),
                user.getPassword(),
                user.getProfilCode(),
                user.getAgence() != null ? user.getAgence().getId() : null,
                Boolean.TRUE.equals(user.getActif()),
                user.getPermissions()
        );
    }

    @Override
    public Collection<? extends GrantedAuthority> getAuthorities() {
        return permissions.stream()
                .map(permission -> new SimpleGrantedAuthority("PERM_" + permission))
                .collect(Collectors.toSet());
    }

    @Override
    public String getUsername() {
        return email;
    }

    @Override
    public boolean isAccountNonExpired() {
        return true;
    }

    @Override
    public boolean isAccountNonLocked() {
        return true;
    }

    @Override
    public boolean isCredentialsNonExpired() {
        return true;
    }

    @Override
    public boolean isEnabled() {
        return active;
    }
}
