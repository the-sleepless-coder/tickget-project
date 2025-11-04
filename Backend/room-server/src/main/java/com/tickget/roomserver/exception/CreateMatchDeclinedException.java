package com.tickget.roomserver.exception;

public class CreateMatchDeclinedException extends RuntimeException {
    public CreateMatchDeclinedException(String message) {
        super(message);
    }
}
