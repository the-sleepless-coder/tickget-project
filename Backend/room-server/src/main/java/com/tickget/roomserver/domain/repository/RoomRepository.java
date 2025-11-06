package com.tickget.roomserver.domain.repository;

import com.tickget.roomserver.domain.entity.Room;
import com.tickget.roomserver.domain.enums.RoomStatus;
import java.util.List;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Slice;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface RoomRepository extends JpaRepository<Room, Long> {
    Slice<Room> findByStatusIn(List<RoomStatus> visibleStatuses, Pageable pageable);
}
