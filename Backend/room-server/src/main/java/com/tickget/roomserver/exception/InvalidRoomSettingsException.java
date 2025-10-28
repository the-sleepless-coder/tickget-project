package com.tickget.roomserver.exception;

public class InvalidRoomSettingsException extends RuntimeException {
    public InvalidRoomSettingsException(String message) {
        super(message);
    }
}
