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
        String supplied = header(request, "X-Device-Name", 120);
        if (supplied != null) {
            return supplied;
        }
        return parseDeviceName(buildUserAgent(request));
    }

    public static String parseDeviceName(String userAgent) {
        return browserName(userAgent);
    }

    public static String parseDeviceId(HttpServletRequest request) {
        return header(request, "X-Device-Id", 80);
    }

    public static String parseDeviceType(HttpServletRequest request) {
        String supplied = header(request, "X-Client-Type", 40);
        if (supplied != null) {
            return supplied;
        }
        return parseDeviceType(buildUserAgent(request));
    }

    public static String parseDeviceType(String userAgent) {
        if (userAgent == null) {
            return null;
        }
        if (containsAny(userAgent, "iPad", "Tablet")) return "TABLET";
        if (containsAny(userAgent, "Mobile", "Android", "iPhone", "iPod")) return "MOBILE";
        return "DESKTOP";
    }

    private static String browserName(String userAgent) {
        if (userAgent == null || userAgent.isBlank()) return null;
        String browser;
        if (userAgent.contains("Edg/")) browser = "Microsoft Edge";
        else if (userAgent.contains("OPR/")) browser = "Opera";
        else if (userAgent.contains("Firefox/")) browser = "Firefox";
        else if (userAgent.contains("Chrome/") || userAgent.contains("CriOS/")) browser = "Chrome";
        else if (userAgent.contains("Safari/")) browser = "Safari";
        else browser = "Navigateur web";

        String system = null;
        if (userAgent.contains("Windows")) system = "Windows";
        else if (userAgent.contains("Android")) system = "Android";
        else if (containsAny(userAgent, "iPhone", "iPad", "iPod")) system = "iOS";
        else if (containsAny(userAgent, "Macintosh", "Mac OS X")) system = "macOS";
        else if (userAgent.contains("Linux")) system = "Linux";
        return system == null ? browser : browser + " sur " + system;
    }

    private static String header(HttpServletRequest request, String name, int maxLength) {
        if (request == null) return null;
        String value = request.getHeader(name);
        if (value == null || value.isBlank()) return null;
        String sanitized = value.replaceAll("[\\r\\n\\t]", " ").trim();
        return sanitized.substring(0, Math.min(sanitized.length(), maxLength));
    }

    private static boolean containsAny(String value, String... candidates) {
        for (String candidate : candidates) {
            if (value.contains(candidate)) return true;
        }
        return false;
    }
}
