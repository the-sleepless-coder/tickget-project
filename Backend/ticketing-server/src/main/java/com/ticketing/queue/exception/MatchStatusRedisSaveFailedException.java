package com.ticketing.queue.exception;

public class MatchStatusRedisSaveFailedException extends MatchStartFlowException {
    public MatchStatusRedisSaveFailedException(String message, Throwable cause) {
        super(message, cause);
    }
}
