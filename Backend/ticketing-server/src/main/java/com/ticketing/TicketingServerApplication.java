package com.ticketing;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class TicketingServerApplication {
    // CI테스트 주석 (테스트 333)
    public static void main(String[] args) {
        SpringApplication.run(TicketingServerApplication.class, args);
    }

}
