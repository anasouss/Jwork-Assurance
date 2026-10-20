package com.assurance.security;

import com.assurance.enums.AuditOperationCode;

public final class AuditRequestContext {

    private static final ThreadLocal<String> REQUEST_ID = new ThreadLocal<>();
    private static final ThreadLocal<String> SOURCE = new ThreadLocal<>();
    private static final ThreadLocal<AuditOperationCode> OPERATION_CODE = new ThreadLocal<>();

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

    public static void setOperation(AuditOperationCode operationCode) {
        if (operationCode == null) {
            OPERATION_CODE.remove();
            return;
        }
        OPERATION_CODE.set(operationCode);
    }

    public static String getOperationCode() {
        AuditOperationCode operationCode = OPERATION_CODE.get();
        return operationCode == null ? null : operationCode.name();
    }

    public static void clear() {
        REQUEST_ID.remove();
        SOURCE.remove();
        OPERATION_CODE.remove();
    }
}
