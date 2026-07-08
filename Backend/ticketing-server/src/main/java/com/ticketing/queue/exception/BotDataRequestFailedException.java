package com.ticketing.queue.exception;

public class BotDataRequestFailedException extends RuntimeException {
    public BotDataRequestFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
