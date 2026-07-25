package com.assurance.exception;

public class ResourceNotFoundException extends RuntimeException {
    public ResourceNotFoundException(String resource, String id) {
        super(resource + " not found: " + id);
    }

    public ResourceNotFoundException(String message) {
        super(message);
    }
}
