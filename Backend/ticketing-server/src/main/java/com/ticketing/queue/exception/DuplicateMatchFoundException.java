package com.ticketing.queue.exception;

public class DuplicateMatchFoundException extends RuntimeException{
    // 해당 Exception이 발생할 시 message를 보낸다.
    public DuplicateMatchFoundException(String message){
        super(message);
    }

}
