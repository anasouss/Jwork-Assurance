package com.assurance.security;

import com.assurance.enums.StatutAgence;
import com.assurance.repository.AgenceRepository;
import com.assurance.repository.RefreshSessionRepository;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.RequiredArgsConstructor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.web.authentication.WebAuthenticationDetailsSource;
import org.springframework.stereotype.Component;
import org.springframework.util.StringUtils;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.LocalDateTime;

@Component
@RequiredArgsConstructor
public class JwtAuthenticationFilter extends OncePerRequestFilter {

    private final JwtTokenProvider tokenProvider;
    private final UserDetailsServiceImpl userDetailsService;
    private final AgenceRepository agenceRepository;
    private final RefreshSessionRepository refreshSessionRepository;

    @Override
    protected void doFilterInternal(HttpServletRequest request, HttpServletResponse response, FilterChain filterChain)
            throws ServletException, IOException {
        try {
            String jwt = resolveToken(request);
            if (StringUtils.hasText(jwt)) {
                if (!tokenProvider.validateToken(jwt)) {
                    rejectInvalidToken(response);
                    return;
                }
                try {
                    Long userId = tokenProvider.getUserIdFromToken(jwt);
                    UserDetails userDetails = userDetailsService.loadUserById(userId);
                    Long effectiveAgenceId = tokenProvider.getAgenceIdFromToken(jwt);
                    Long sessionId = tokenProvider.getSessionIdFromToken(jwt);
                    if (!(userDetails instanceof UserPrincipal principal)
                            || !isValidAgencyContext(principal, effectiveAgenceId)
                            || sessionId == null
                            || !refreshSessionRepository.existsValidContext(
                                    sessionId,
                                    userId,
                                    effectiveAgenceId,
                                    LocalDateTime.now()
                            )) {
                        rejectInvalidToken(response);
                        return;
                    }
                    UsernamePasswordAuthenticationToken authentication =
                            new UsernamePasswordAuthenticationToken(userDetails, null, userDetails.getAuthorities());
                    authentication.setDetails(new WebAuthenticationDetailsSource().buildDetails(request));
                    SecurityContextHolder.getContext().setAuthentication(authentication);

                    TenantContext.setCurrentUser(principal.getId());
                    TenantContext.setCurrentAgence(effectiveAgenceId);
                    TenantContext.setCurrentSession(sessionId);
                    TenantContext.setCurrentUsername(principal.getUsername());
                } catch (RuntimeException ex) {
                    rejectInvalidToken(response);
                    return;
                }
            }
            filterChain.doFilter(request, response);
        } finally {
            TenantContext.clear();
        }
    }

    private boolean isValidAgencyContext(UserPrincipal principal, Long effectiveAgenceId) {
        boolean platformAdmin = principal.getAgenceId() == null
                && "SUPER_ADMIN".equalsIgnoreCase(principal.getRoleCode());
        if (!platformAdmin && !java.util.Objects.equals(principal.getAgenceId(), effectiveAgenceId)) {
            return false;
        }
        return effectiveAgenceId == null
                ? platformAdmin
                : agenceRepository.existsByIdAndStatut(effectiveAgenceId, StatutAgence.ACTIVE);
    }

    private String resolveToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (StringUtils.hasText(header) && header.startsWith("Bearer ")) {
            return header.substring(7);
        }
        return null;
    }

    private void rejectInvalidToken(HttpServletResponse response) throws IOException {
        SecurityContextHolder.clearContext();
        TenantContext.clear();
        response.sendError(HttpServletResponse.SC_UNAUTHORIZED, "Invalid authentication token");
    }
}
