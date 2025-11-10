package com.ticketing.repository;

import com.ticketing.entity.Match;
import com.ticketing.entity.TotalArea;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;

public interface TotalAreaRepository extends JpaRepository<TotalArea, Long> {
    Optional<TotalArea> findByKopisId(String kopisId);
}
