package com.tickget.userserver.exception;

public class NicknameConflictException extends RuntimeException {
    public NicknameConflictException(String message) {
        super(message);
    }
}