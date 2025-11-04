package com.tickget.roomserver.exception;

public class PresetHallNotFoundException extends RuntimeException {
    public PresetHallNotFoundException(Long message) {
        super(String.valueOf(message));
    }
}
