package com.assurance.util;

import jakarta.servlet.http.HttpServletRequest;

public final class DeviceInfoParser {

    private DeviceInfoParser() {
    }

    public static String getClientIp(HttpServletRequest request) {
        if (request == null) {
            return null;
        }
        String forwarded = request.getHeader("X-Forwarded-For");
        if (forwarded != null && !forwarded.isBlank()) {
            return forwarded.split(",")[0].trim();
        }
        return request.getRemoteAddr();
    }

    public static String buildUserAgent(HttpServletRequest request) {
        return request == null ? null : request.getHeader("User-Agent");
    }

    public static String parseDeviceName(HttpServletRequest request) {
        return request == null ? null : request.getHeader("X-Device-Name");
    }

    public static String parseDeviceType(HttpServletRequest request) {
        return request == null ? null : request.getHeader("X-Client-Type");
    }
}
