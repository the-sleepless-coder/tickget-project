package com.tickget.roomserver.exception;

public class CreateMatchFailedException extends RuntimeException {
    public CreateMatchFailedException(String message, Exception e) {
        super(message);
    }
}
