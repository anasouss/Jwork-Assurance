package com.assurance.security;

public final class AuditRequestContext {

    private static final ThreadLocal<String> REQUEST_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> SOURCE = new ThreadLocal<>();

    private AuditRequestContext() {
    }

    public static void set(String requestId, String source) {
        REQUEST_ID.set(requestId);
        SOURCE.set(source);
    }

    public static String getRequestId() {
        return REQUEST_ID.get();
    }

    public static String getSource() {
        String source = SOURCE.get();
        return source == null ? "SYSTEM" : source;
    }

    public static void clear() {
        REQUEST_ID.remove();
        SOURCE.remove();
    }
}
