package com.tickget.roomserver.domain.repository;

import com.tickget.roomserver.domain.entity.PresetHall;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface PresetHallRepository extends JpaRepository<PresetHall, Long> {
}
