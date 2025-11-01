package com.ticketing.seat.mongodb;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.data.mongodb.repository.Query;
import org.springframework.stereotype.Repository;

import java.util.Date;
import java.util.List;

@Repository
public interface SeatConfirmationLogRepository extends MongoRepository<SeatConfirmationLog, String> {

    List<SeatConfirmationLog> findByMatchId(Long matchId);

    List<SeatConfirmationLog> findByUserId(Long userId);

    List<SeatConfirmationLog> findByEventType(String eventType);

    @Query("{'timestamp': {$gte: ?0, $lte: ?1}}")
    List<SeatConfirmationLog> findByTimestampBetween(Date start, Date end);

    @Query("{'matchId': ?0, 'success': true}")
    List<SeatConfirmationLog> findSuccessfulConfirmationsByMatchId(Long matchId);
}