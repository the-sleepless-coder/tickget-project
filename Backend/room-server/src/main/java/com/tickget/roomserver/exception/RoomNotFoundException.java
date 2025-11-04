package com.tickget.roomserver.exception;

public class RoomNotFoundException extends RuntimeException {
    public RoomNotFoundException(Long message) {
        super(String.valueOf(message));
    }
}
