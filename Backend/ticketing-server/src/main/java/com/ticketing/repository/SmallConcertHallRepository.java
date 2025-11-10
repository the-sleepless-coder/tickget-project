package com.ticketing.repository;

import com.ticketing.entity.SmallConcertHall;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface SmallConcertHallRepository extends JpaRepository<SmallConcertHall,Long> {
    Optional<SmallConcertHall> findByConcertHallId(String concertHallId);
}
