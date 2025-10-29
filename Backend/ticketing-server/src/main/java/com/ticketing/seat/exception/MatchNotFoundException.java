package com.ticketing.seat.exception;

public class MatchNotFoundException extends RuntimeException {
    public MatchNotFoundException(Long matchId) {
        super("Match not found: " + matchId);
    }
}
