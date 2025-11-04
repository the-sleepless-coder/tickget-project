package com.ticketing.seat.exception;

public class MatchClosedException extends RuntimeException {
    public MatchClosedException(Long matchId) {
        super("Match " + matchId + " is closed or not available for reservation.");
    }
}
