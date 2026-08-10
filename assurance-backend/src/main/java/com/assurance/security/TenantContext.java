package com.assurance.security;

public final class TenantContext {

    private static final ThreadLocal<Long> CURRENT_AGENCY = new ThreadLocal<>();
    private static final ThreadLocal<Long> CURRENT_USER = new ThreadLocal<>();
    private static final ThreadLocal<String> CURRENT_USERNAME = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setCurrentAgence(Long agenceId) {
        CURRENT_AGENCY.set(agenceId);
    }

    public static Long getCurrentAgence() {
        return CURRENT_AGENCY.get();
    }

    public static void setCurrentUser(Long userId) {
        CURRENT_USER.set(userId);
    }

    public static Long getCurrentUser() {
        return CURRENT_USER.get();
    }

    public static void setCurrentUsername(String username) {
        CURRENT_USERNAME.set(username);
    }

    public static String getCurrentUsername() {
        return CURRENT_USERNAME.get();
    }

    public static void clear() {
        CURRENT_AGENCY.remove();
        CURRENT_USER.remove();
        CURRENT_USERNAME.remove();
    }
}
