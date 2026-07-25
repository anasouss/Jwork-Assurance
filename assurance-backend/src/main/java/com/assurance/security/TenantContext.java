package com.assurance.security;

public final class TenantContext {

    private static final ThreadLocal<String> CURRENT_AGENCY = new ThreadLocal<>();
    private static final ThreadLocal<String> CURRENT_USER = new ThreadLocal<>();

    private TenantContext() {
    }

    public static void setCurrentAgence(String agenceId) {
        CURRENT_AGENCY.set(agenceId);
    }

    public static String getCurrentAgence() {
        return CURRENT_AGENCY.get();
    }

    public static void setCurrentUser(String userId) {
        CURRENT_USER.set(userId);
    }

    public static String getCurrentUser() {
        return CURRENT_USER.get();
    }

    public static void clear() {
        CURRENT_AGENCY.remove();
        CURRENT_USER.remove();
    }
}
