package com.tickget.roomserver.exception;

public class RoomFullException extends RuntimeException {
  public RoomFullException(String message) {
    super(message);
  }

  public RoomFullException(Long roomId, int maxUserCount) {
    super(String.format("방 ID %d는 최대 인원(%d명)으로 가득 찼습니다.", roomId, maxUserCount));
  }
}
