package com.stats;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
public class StatsServerApplication {
    //CI용 주석333
    public static void main(String[] args) {
        SpringApplication.run(StatsServerApplication.class, args);
    }
}
