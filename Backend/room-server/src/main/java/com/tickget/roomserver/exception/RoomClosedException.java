package com.tickget.roomserver.exception;

public class RoomClosedException extends RuntimeException {
  public RoomClosedException(String message) {
    super(message);
  }
}
