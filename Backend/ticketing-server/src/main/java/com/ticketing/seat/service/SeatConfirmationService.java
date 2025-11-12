package com.ticketing.seat.service;

import com.ticketing.seat.dto.ConfirmedSeatDto;
import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.entity.Match;
import com.ticketing.entity.UserStats;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.seat.redis.SeatReservationRedisRepository;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.UserStatsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Set;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatConfirmationService {

    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final SeatReservationRedisRepository seatReservationRedisRepository;
    private final EventPublisherService eventPublisherService;
    private final UserStatsRepository userStatsRepository;
    private final StringRedisTemplate redisTemplate;
    private final MatchStatusSyncService matchStatusSyncService;
    private final RoomServerClient roomServerClient;

    @Transactional
    public SeatConfirmationResponse confirmSeats(Long matchId, SeatConfirmationRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getUserId() == null) {
            return buildErrorResponse("ì‚¬ìš©ìž IDëŠ” í•„ìˆ˜ ìž…ë ¥ í•­ëª©ìž…ë‹ˆë‹¤.");
        }

        Long userId = request.getUserId();
        boolean isBot = userId < 0;  // ë´‡ ì—¬ë¶€ íŒë‹¨

        try {
            // 1. Match ì¡°íšŒ (DB ìƒíƒœ ì²´í¬ ì•ˆ í•¨! - playingì´ë“  finishedë“  ìƒê´€ì—†ì´ ì§„í–‰)
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            // 2. Redisì—ì„œ í•´ë‹¹ ìœ ì €ê°€ ì„ ì í•œ ì¢Œì„ ì¡°íšŒ (Redis ìƒíƒœ ë¬´ê´€)
            List<String> seatIds = findUserSeats(matchId, userId);

            if (seatIds.isEmpty()) {
                SeatConfirmationResponse response = buildErrorResponse("ì„ ì ëœ ì¢Œì„ì´ ì—†ìŠµë‹ˆë‹¤.");
                publishConfirmationEvent(userId, matchId, List.of(), null,
                        false, response.getMessage(), startTime);
                return response;
            }

            // 3. ì¢Œì„ ì •ë³´ ì¶”ì¶œ
            List<ConfirmedSeatDto> confirmedSeats = new ArrayList<>();
            List<String> sectionIds = new ArrayList<>();
            String selectedSection = "";
            String selectedSeat = "";

            for (String seatId : seatIds) {
                String sectionId = extractSection(seatId);
                confirmedSeats.add(ConfirmedSeatDto.builder()
                        .seatId(seatId)
                        .sectionId(sectionId)
                        .build());
                sectionIds.add(sectionId);

                // ì²« ë²ˆì§¸ ì¢Œì„ ì •ë³´ ì €ìž¥ (user_statsìš©)
                if (selectedSection.isEmpty()) {
                    selectedSection = sectionId;
                    selectedSeat = seatId;
                }
            }

            // 4. ë“±ìˆ˜ ê³„ì‚° (ì‹¤ì œ ìœ ì €ë§Œ, ë´‡ ì œì™¸)
            Integer userRank = calculateUserRank(matchId, userId, isBot);

            // 5. user_stats ì €ìž¥
            UserStats userStats;
            if (isBot) {
                // ë´‡ì´ë©´ í†µê³„ ë°ì´í„° ëª¨ë‘ 0ìœ¼ë¡œ
                userStats = UserStats.builder()
                        .userId(userId)
                        .matchId(matchId)
                        .isSuccess(true)
                        .selectedSection(selectedSection)
                        .selectedSeat(selectedSeat)
                        .dateSelectTime(0)
                        .dateMissCount(0)
                        .seccodeSelectTime(0)
                        .seccodeBackspaceCount(0)
                        .seccodeTryCount(0)
                        .seatSelectTime(0)
                        .seatSelectTryCount(0)
                        .seatSelectClickMissCount(0)
                        .userRank(-1)  // ë´‡ì€ ë“±ìˆ˜ ì—†ìŒ
                        .totalRank(-1)
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
            } else {
                // ì‹¤ì œ ìœ ì €ëŠ” ì •ìƒ ì €ìž¥
                userStats = UserStats.builder()
                        .userId(userId)
                        .matchId(matchId)
                        .isSuccess(true)
                        .selectedSection(selectedSection)
                        .selectedSeat(selectedSeat)
                        .dateSelectTime(request.getDateSelectTime())
                        .dateMissCount(request.getDateMissCount() != null ? request.getDateMissCount() : 0)
                        .seccodeSelectTime(request.getSeccodeSelectTime())
                        .seccodeBackspaceCount(request.getSeccodeBackspaceCount() != null ? request.getSeccodeBackspaceCount() : 0)
                        .seccodeTryCount(request.getSeccodeTryCount() != null ? request.getSeccodeTryCount() : 0)
                        .seatSelectTime(request.getSeatSelectTime())
                        .seatSelectTryCount(request.getSeatSelectTryCount() != null ? request.getSeatSelectTryCount() : 0)
                        .seatSelectClickMissCount(request.getSeatSelectClickMissCount() != null ? request.getSeatSelectClickMissCount() : 0)
                        .userRank(userRank)
                        .totalRank(-1)  // ì „ì²´ ê²½ê¸° ì¢…ë£Œ í›„ ê³„ì‚°
                        .createdAt(LocalDateTime.now())
                        .updatedAt(LocalDateTime.now())
                        .build();
            }

            userStatsRepository.save(userStats);

            // 6. confirmed_count ì¦ê°€ (ì¢Œì„ ìˆ˜ë§Œí¼)
            String confirmedCountKey = "match:" + matchId + ":confirmed_count";
            Long confirmedCount = redisTemplate.opsForValue().increment(confirmedCountKey, seatIds.size());

            // 7. reserved_count ì¡°íšŒ
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            String reservedCountStr = redisTemplate.opsForValue().get(reservedCountKey);

            log.info("Confirm í›„ ìƒíƒœ: matchId={}, confirmed={}, reserved={}",
                    matchId, confirmedCount, reservedCountStr);

            // 8. ëª¨ë“  ìœ ì €(ë´‡ í¬í•¨) Confirm ì™„ë£Œ ì²´í¬ ë° ê²½ê¸° ì¢…ë£Œ ì²˜ë¦¬
            // ì¡°ê±´: Redis CLOSED(ë§Œì„) && confirmed_count >= reserved_count
            String redisStatus = matchStatusRepository.getMatchStatus(matchId);

            if ("CLOSED".equalsIgnoreCase(redisStatus) &&
                    reservedCountStr != null &&
                    confirmedCount != null) {

                int reservedCount = Integer.parseInt(reservedCountStr);

                if (confirmedCount >= reservedCount) {
                    log.info("ë§Œì„ + ëª¨ë“  ìœ ì € Confirm ì™„ë£Œ - ê²½ê¸° ì¢…ë£Œ ì²˜ë¦¬: matchId={}, redisStatus={}, confirmed={}, reserved={}",
                            matchId, redisStatus, confirmedCount, reservedCount);

                    // DB ìƒíƒœë¥¼ FINISHEDë¡œ ë³€ê²½
                    match.setStatus(Match.MatchStatus.FINISHED);
                    match.setEndedAt(LocalDateTime.now());
                    matchRepository.save(match);

                    // Redis ì „ì²´ ì •ë¦¬
                    cleanupAllMatchRedis(matchId);

                    // ë£¸ ì„œë²„ì— ë§¤ì¹˜ ì¢…ë£Œ ì•Œë¦¼
                    Long roomId = match.getRoomId();
                    boolean notificationSuccess = roomServerClient.notifyMatchEnd(roomId);

                    if (notificationSuccess) {
                        log.info("ê²½ê¸° ìžë™ ì¢…ë£Œ ë° ë£¸ ì„œë²„ ì•Œë¦¼ ì™„ë£Œ: matchId={}, roomId={}, status=FINISHED, endedAt={}",
                                matchId, roomId, match.getEndedAt());
                    } else {
                        log.warn("ê²½ê¸°ëŠ” ì¢…ë£Œë˜ì—ˆìœ¼ë‚˜ ë£¸ ì„œë²„ ì•Œë¦¼ ì‹¤íŒ¨: matchId={}, roomId={}", matchId, roomId);
                    }
                } else {
                    log.debug("ë§Œì„ì´ì§€ë§Œ ì•„ì§ Confirm ëŒ€ê¸° ì¤‘: matchId={}, confirmed={}, reserved={}",
                            matchId, confirmedCount, reservedCount);
                }
            } else {
                log.debug("ë§Œì„ ì•„ë‹˜, PLAYING ìœ ì§€: matchId={}, redisStatus={}, confirmed={}, reserved={}",
                        matchId, redisStatus, confirmedCount, reservedCountStr);
            }

            // 9. ì„±ê³µ ì‘ë‹µ ìƒì„±
            SeatConfirmationResponse response = SeatConfirmationResponse.builder()
                    .success(true)
                    .message("ê°œì¸ ê²½ê¸° ì¢…ë£Œ")
                    .userRank(userRank)
                    .confirmedSeats(confirmedSeats)
                    .matchId(matchId)
                    .userId(userId)
                    .build();

            // 8. ì´ë²¤íŠ¸ ë°œí–‰
            publishConfirmationEvent(userId, matchId, seatIds, sectionIds,
                    true, "ê°œì¸ ê²½ê¸° ì¢…ë£Œ", startTime);

            return response;

        } catch (Exception e) {
            log.error("ì¢Œì„ í™•ì • ì¤‘ ì˜¤ë¥˜ ë°œìƒ: {}", e.getMessage(), e);

            SeatConfirmationResponse response = buildErrorResponse("ì¢Œì„ í™•ì • ì²˜ë¦¬ ì¤‘ ì˜¤ë¥˜ê°€ ë°œìƒí–ˆìŠµë‹ˆë‹¤: " + e.getMessage());
            publishConfirmationEvent(userId, matchId, List.of(), null,
                    false, e.getMessage(), startTime);

            return response;
        }
    }

    /**
     * Redis ì „ì²´ ì •ë¦¬ (ëª¨ë“  í‚¤ ì‚­ì œ)
     * - ì¢Œì„ í‚¤: seat:{matchId}:*
     * - ìƒíƒœ í‚¤: match:{matchId}:status
     * - ì¹´ìš´íŠ¸ í‚¤: match:{matchId}:reserved_count
     * - ì‹¤ì œ ìœ ì € í‚¤: humanusers:match:{matchId}, humanusers:match:{matchId}:initial
     */
    private void cleanupAllMatchRedis(Long matchId) {
        log.info("ê²½ê¸° ì¢…ë£Œ - Redis ì „ì²´ ì •ë¦¬ ì‹œìž‘: matchId={}", matchId);

        try {
            // 1. ì¢Œì„ í‚¤ ì‚­ì œ
            String seatPattern = "seat:" + matchId + ":*";
            Set<String> seatKeys = redisTemplate.keys(seatPattern);
            if (seatKeys != null && !seatKeys.isEmpty()) {
                redisTemplate.delete(seatKeys);
                log.info("ì¢Œì„ í‚¤ ì‚­ì œ: matchId={}, count={}", matchId, seatKeys.size());
            }

            // 2. ìƒíƒœ í‚¤ ì‚­ì œ
            String statusKey = "match:" + matchId + ":status";
            redisTemplate.delete(statusKey);

            // 3. ì¹´ìš´íŠ¸ í‚¤ ì‚­ì œ
            String countKey = "match:" + matchId + ":reserved_count";
            redisTemplate.delete(countKey);

            // 3-1. í™•ì • ì¹´ìš´íŠ¸ í‚¤ ì‚­ì œ
            String confirmedCountKey = "match:" + matchId + ":confirmed_count";
            redisTemplate.delete(confirmedCountKey);

            // 4. ì‹¤ì œ ìœ ì € ì¹´ìš´í„° í‚¤ ì‚­ì œ
            String humanUsersKey = "humanusers:match:" + matchId;
            String humanUsersInitialKey = "humanusers:match:" + matchId + ":initial";
            redisTemplate.delete(humanUsersKey);
            redisTemplate.delete(humanUsersInitialKey);

            log.info("ê²½ê¸° Redis ì „ì²´ ì •ë¦¬ ì™„ë£Œ: matchId={}", matchId);

        } catch (Exception e) {
            log.error("ê²½ê¸° Redis ì •ë¦¬ ì¤‘ ì˜¤ë¥˜ ë°œìƒ: matchId={}", matchId, e);
        }
    }

    /**
     * Redisì—ì„œ í•´ë‹¹ ìœ ì €ê°€ ì„ ì í•œ ì¢Œì„ ì¡°íšŒ
     * @return seatId ëª©ë¡ (í˜•ì‹: "8-9-15")
     */
    private List<String> findUserSeats(Long matchId, Long userId) {
        List<String> userSeats = new ArrayList<>();

        String pattern = "seat:" + matchId + ":*";
        Set<String> keys = redisTemplate.keys(pattern);

        if (keys != null) {
            for (String key : keys) {
                String value = redisTemplate.opsForValue().get(key);
                if (value != null) {
                    String[] parts = value.split(":");
                    if (parts.length == 2) {
                        Long ownerId = Long.valueOf(parts[0]);
                        if (ownerId.equals(userId)) {
                            // key í˜•ì‹: seat:100:8:9-15 -> seatId: 8-9-15
                            String seatId = extractSeatIdFromKey(key);
                            userSeats.add(seatId);
                        }
                    }
                }
            }
        }

        return userSeats;
    }

    /**
     * Redis í‚¤ì—ì„œ seatId ì¶”ì¶œ
     * ì˜ˆ: "seat:100:8:9-15" -> "8-9-15"
     */
    private String extractSeatIdFromKey(String key) {
        String[] parts = key.split(":");
        if (parts.length >= 4) {
            return parts[2] + "-" + parts[3];  // sectionId-row-col
        }
        return "";
    }

    /**
     * ë“±ìˆ˜ ê³„ì‚° (ì‹¤ì œ ìœ ì €ë§Œ, ë´‡ ì œì™¸)
     * - ì‚¬ëžŒ í™•ì • ìˆœì„œë¥¼ Redis INCRë¡œ ì•ˆì „í•˜ê²Œ ê³„ì‚° (1ë¶€í„° ì‹œìž‘)
     * - í‚¤ê°€ ì—†ìœ¼ë©´ ìžë™ìœ¼ë¡œ ìƒì„±ë˜ì–´ 1 ë°˜í™˜
     */
    private Integer calculateUserRank(Long matchId, Long userId, boolean isBot) {
        if (isBot) {
            return -1; // ë´‡ì€ ìˆœìœ„ ê³„ì‚° ì œì™¸
        }

        final String rankKey = "match:" + matchId + ":human_rank_counter";

        try {
            Long rank = redisTemplate.opsForValue().increment(rankKey); // atomic
            if (rank == null) {
                log.warn("ìˆœìœ„ ì¹´ìš´í„° ì¦ê°€ ì‹¤íŒ¨: matchId={}, userId={}", matchId, userId);
                return -1;
            }
            log.info("ìœ ì € ë“±ìˆ˜ ê³„ì‚°: userId={}, rank={}", userId, rank);
            return rank.intValue();
        } catch (Exception e) {
            log.error("ìˆœìœ„ ê³„ì‚° ì¤‘ ì˜¤ë¥˜: matchId={}, userId={}, msg={}", matchId, userId, e.getMessage(), e);
            return -1;
        }
    }

    /**
     * seatIdì—ì„œ sectionId ì¶”ì¶œ
     * ì˜ˆ: "8-9-15" -> "8"
     */
    private String extractSection(String seatId) {
        String[] parts = seatId.split("-");
        return parts.length >= 1 ? parts[0] : "";
    }

    private void publishConfirmationEvent(
            Long userId,
            Long matchId,
            List<String> seatIds,
            List<String> sectionIds,
            boolean success,
            String message,
            long startTime) {

        long duration = System.currentTimeMillis() - startTime;

        eventPublisherService.publishSeatConfirmationEvent(
                userId,
                matchId,
                seatIds,
                sectionIds,
                success,
                message,
                duration);
    }

    private SeatConfirmationResponse buildErrorResponse(String message) {
        return SeatConfirmationResponse.builder()
                .success(false)
                .message(message)
                .build();
    }
}