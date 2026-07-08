package com.ticketing.seat.service;

import com.ticketing.seat.dto.ConfirmedSeatDto;
import com.ticketing.seat.dto.SeatConfirmationRequest;
import com.ticketing.seat.dto.SeatConfirmationResponse;
import com.ticketing.entity.Match;
import com.ticketing.entity.UserStats;
import com.ticketing.seat.event.MatchEndEvent;
import com.ticketing.seat.exception.MatchNotFoundException;
import com.ticketing.seat.redis.MatchStatusRepository;
import com.ticketing.repository.MatchRepository;
import com.ticketing.repository.UserStatsRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.LocalDateTime;
import java.util.ArrayDeque;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.Set;
import java.util.concurrent.CompletableFuture;

@Slf4j
@Service
@RequiredArgsConstructor
public class SeatConfirmationService {
    static int MATCH_REDIS_TTL_SECONDS = 900;
    private final MatchRepository matchRepository;
    private final MatchStatusRepository matchStatusRepository;
    private final EventPublisherService eventPublisherService;
    private final UserStatsRepository userStatsRepository;
    private final StringRedisTemplate redisTemplate;
    private final RoomServerClient roomServerClient;
    private final StatsServerClient statsServerClient;
    private final ApplicationEventPublisher eventPublisher;
    private final HandleFullMatchService handleFullMatchService;

    public SeatConfirmationResponse confirmSeats(Long matchId, SeatConfirmationRequest request) {
        long startTime = System.currentTimeMillis();

        if (request.getUserId() == null) {
            return buildErrorResponse("사용자 ID는 필수 입력 항목입니다.");
        }

        Long userId = request.getUserId();
        boolean isBot = userId < 0;  // 봇 여부 판단

        try {
            // 1. Match 조회
            Match match = matchRepository.findById(matchId)
                    .orElseThrow(() -> new MatchNotFoundException(matchId));

            // DB 상태가 WAITING일 때만 차단 (PLAYING, FINISHED 모두 허용)
            if (match.getStatus() == Match.MatchStatus.WAITING) {
                return buildErrorResponse("경기가 아직 시작되지 않았습니다.");
            }

            // ===== 봇과 실제 유저 분기 처리 =====
            if (isBot) {
                // ========== 봇 Confirm 처리 ==========
                return handleBotConfirm(matchId, userId, match, startTime);
            } else {
                // ========== 실제 유저 Confirm 처리 ==========
                return handleUserConfirm(matchId, request, match, startTime);
            }

        } catch (Exception e) {
            log.error("좌석 확정 중 오류 발생: {}", e.getMessage(), e);

            SeatConfirmationResponse response = buildErrorResponse("좌석 확정 처리 중 오류가 발생했습니다: " + e.getMessage());
            publishConfirmationEvent(userId, matchId, List.of(), null,
                    false, e.getMessage(), startTime);

            return response;
        }
    }

    /**
     * 봇 Confirm 처리
     * - 좌석 키 조회 필요 (좌석 수 확인용)
     * - reserved_count 증가 (좌석 수만큼)
     * - total_rank_counter 증가
     * - success_bot_count 증가
     * - humanusers 변경 없음
     * - user_stats 저장 안 함
     */


    private SeatConfirmationResponse handleBotConfirm(Long matchId, Long userId,
                                                      Match match, long startTime) {
        log.info("봇 Confirm 처리 시작: matchId={}, botId={}", matchId, userId);

        // 1. Redis에서 봇이 선점한 좌석 조회
        List<String> seatIds = findUserSeats(matchId, userId);

        if (seatIds.isEmpty()) {
            log.warn("봇의 선점 좌석 없음: matchId={}, botId={}", matchId, userId);
            return buildErrorResponse("선점된 좌석이 없습니다.");
        }

        int seatCount = seatIds.size();

        // 2. reserved_count 증가 (좌석 수만큼) + TTL 갱신
        String reservedCountKey = "match:" + matchId + ":reserved_count";
        Long reservedCount = redisTemplate.opsForValue().increment(reservedCountKey, seatCount);
        redisTemplate.expire(reservedCountKey, Duration.ofSeconds(900));

        // 3. total_rank_counter 증가 (봇도 전체 등수에 포함) + TTL 갱신
        String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
        Long totalRankLong = redisTemplate.opsForValue().increment(totalRankCounterKey);
        redisTemplate.expire(totalRankCounterKey, Duration.ofSeconds(900));
        Integer totalRank = (totalRankLong != null) ? totalRankLong.intValue() : null;

        log.info("봇 Confirm 완료: matchId={}, botId={}, totalRank={}, reservedCount={}, seatCount={}",
                matchId, userId, totalRank, reservedCount, seatCount);

        // 5. 경기 종료 조건 체크 (유저와 동일한 로직)
        Integer totalSeats = getTotalSeats(matchId);
        boolean isFull = reservedCount != null && totalSeats != null && reservedCount >= totalSeats;

        // humanusers 확인 (봇은 humanusers에 영향 안 줌)
        String humanUsersKey = "humanusers:match:" + matchId;
        String humanUsersValue = redisTemplate.opsForValue().get(humanUsersKey);
        Long remainingHumanUsers = (humanUsersValue != null) ? Long.parseLong(humanUsersValue) : null;

        if ((remainingHumanUsers != null && remainingHumanUsers <= 0) || isFull) {
            if (match.getStatus() == Match.MatchStatus.PLAYING) {
                log.info("봇 Confirm으로 경기 종료 조건 만족: matchId={}, remainingHumanUsers={}, isFull={}",
                        matchId, remainingHumanUsers, isFull);
                handleFullMatchService.handleFullMatchAtConfirm(matchId, match);
            }
        }

        // 6. 성공 응답
        return SeatConfirmationResponse.builder()
                .success(true)
                .message("봇 확정 완료")
                .userRank(-1)
                .confirmedSeats(
                        seatIds.stream()
                                .map(seatId -> ConfirmedSeatDto.builder()
                                        .seatId(seatId)
                                        .sectionId(extractSection(seatId))
                                        .build())
                                .toList()
                )
                .totalRank(-1)
                .matchId(matchId)
                .userId(userId)
                .build();
    }


    /**
     * 실제 유저 Confirm 처리
     * - 좌석 키 조회 (없으면 실패)
     * - reserved_count 증가 (좌석 수만큼)
     * - UserStats 저장 (통계 데이터 포함)
     * - Confirm 시점에 등수 계산
     * - humanusers 감소
     * - 만석 또는 모든 실제 유저 Confirm 시 경기 종료
     */
    private SeatConfirmationResponse handleUserConfirm(Long matchId,
                                                       SeatConfirmationRequest request,
                                                       Match match, long startTime) {
        Long userId = request.getUserId();

        // 1. 중복 Confirm 체크 (Redis)
        // matchId, userId에 대한 멱등키를 설정, 
        // Redis에 저장된 데이터를 DB에 영속적인 형태로 저장한다.
        String idempotencyKey = "confirm:processed:" + matchId + ":" + userId;
        Boolean acquired = redisTemplate.opsForValue()
                            .setIfAbsent(idempotencyKey, "1", Duration.ofSeconds(MATCH_REDIS_TTL_SECONDS));
        if(!acquired) return buildErrorResponse("이미 처리 중입니다.");

        // 카운터 키 (보상 람다에서 캡처하므로 effectively final)
        String reservedCountKey    = "match:" + matchId + ":reserved_count";
        String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
        String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
        String humanUsersKey       = "humanusers:match:" + matchId;

        // 실제로 성공한 상태 변경만 역순(LIFO)으로 되돌리기 위한 보상 스택.
        // 각 카운터를 올린 "직후"에만 되돌리는 람다를 push 하므로,
        // 예외가 어느 구간에서 터지든 그 시점까지 실제로 적용된 것만 보상된다.
        Deque<Runnable> rollback = new ArrayDeque<>();

        try{
            // 2. Redis에서 해당 유저가 선점한 좌석 조회 (실패해도 부작용 없음 → rollback 비어있음)
            List<String> seatIds = findUserSeats(matchId, userId);

            if (seatIds.isEmpty()) {
                redisTemplate.delete(idempotencyKey);   // 되돌릴 카운터 없음 + 재시도 허용
                SeatConfirmationResponse response = buildErrorResponse("선점된 좌석이 없습니다.");
                publishConfirmationEvent(userId, matchId, List.of(), null,
                        false, response.getMessage(), startTime);
                return response;
            }

            // 3. 좌석 정보 추출 및 리스트에 모으기
            List<ConfirmedSeatDto> confirmedSeats = new ArrayList<>();
            List<String> sectionIds = new ArrayList<>();
            List<String> allSectionIds = new ArrayList<>();  // 모든 sectionId 수집
            List<String> allSeatIds = new ArrayList<>();     // 모든 seatId 수집

            for (String seatId : seatIds) {
                String sectionId = extractSection(seatId);

                // ConfirmedSeat 리스트에 추가
                confirmedSeats.add(ConfirmedSeatDto.builder()
                        .seatId(seatId)
                        .sectionId(sectionId)
                        .build());
                sectionIds.add(sectionId);

                // UserStats용 정보 수집
                allSectionIds.add(sectionId);
                allSeatIds.add(seatId);
            }

            final int seatCount = seatIds.size();

            // ===== 여기서부터 상태 변경. 성공한 "직후"에만 보상을 push =====
            // (push 를 expire 보다 앞에 두어, expire 가 실패해도 increment 는 보상됨)

            // 4. reserved_count 증가 (좌석 수만큼)
            Long reservedCount = redisTemplate.opsForValue().increment(reservedCountKey, seatCount);
            rollback.push(() -> redisTemplate.opsForValue().decrement(reservedCountKey, seatCount));
            redisTemplate.expire(reservedCountKey, Duration.ofSeconds(900));

            // ===== Confirm 시점에 등수 계산 =====

            // 5. human_rank_counter 증가 → userRank
            Long userRankLong = redisTemplate.opsForValue().increment(humanRankCounterKey);
            rollback.push(() -> redisTemplate.opsForValue().decrement(humanRankCounterKey));
            redisTemplate.expire(humanRankCounterKey, Duration.ofSeconds(900));
            Integer userRank = userRankLong.intValue();

            // 6. total_rank_counter 증가 → totalRank
            Long totalRankLong = redisTemplate.opsForValue().increment(totalRankCounterKey);
            rollback.push(() -> redisTemplate.opsForValue().decrement(totalRankCounterKey));
            redisTemplate.expire(totalRankCounterKey, Duration.ofSeconds(900));
            Integer totalRank = totalRankLong.intValue();

            log.info("Confirm 시점 등수 계산: matchId={}, userId={}, userRank={}, totalRank={}",
                    matchId, userId, userRank, totalRank);

            // 7. humanusers 감소
            Long remainingHumanUsers = redisTemplate.opsForValue().decrement(humanUsersKey);
            rollback.push(() -> redisTemplate.opsForValue().increment(humanUsersKey));
            redisTemplate.expire(humanUsersKey, Duration.ofSeconds(900));
            log.info("실제 유저 Confirm: matchId={}, userId={}, 남은 실제 유저={}",
                    matchId, userId, remainingHumanUsers);

            // 9. UserStats 저장 (좌석 정보를 콤마로 연결하여 1개 레코드로 저장)
            String selectedSections = String.join(",", allSectionIds);  // 예: "8,8" 또는 "8,9"
            String selectedSeats = String.join(",", allSeatIds);        // 예: "8-9-15,8-9-16"

            UserStats userStats = UserStats.builder()
                    .userId(userId)
                    .matchId(matchId)
                    .isSuccess(true)
                    .selectedSection(selectedSections)  // 모든 섹션 ID (콤마 구분)
                    .selectedSeat(selectedSeats)        // 모든 좌석 ID (콤마 구분)
                    .dateSelectTime(request.getDateSelectTime())
                    .dateMissCount(request.getDateMissCount() != null ? request.getDateMissCount() : 0)
                    .seccodeSelectTime(request.getSeccodeSelectTime())
                    .seccodeBackspaceCount(request.getSeccodeBackspaceCount() != null ? request.getSeccodeBackspaceCount() : 0)
                    .seccodeTryCount(request.getSeccodeTryCount() != null ? request.getSeccodeTryCount() : 0)
                    .seatSelectTime(request.getSeatSelectTime())
                    .seatSelectTryCount(request.getSeatSelectTryCount() != null ? request.getSeatSelectTryCount() : 0)
                    .seatSelectClickMissCount(request.getSeatSelectClickMissCount() != null ? request.getSeatSelectClickMissCount() : 0)
                    .userRank(userRank)
                    .totalRank(totalRank)
                    .createdAt(LocalDateTime.now())
                    .updatedAt(LocalDateTime.now())
                    .build();

            // 트랜잭션이 없으므로 save는 이 시점에 즉시 커밋된다.
            // 이후 단계(getTotalSeats/handleFullMatch/publish)가 실패하면 DB 롤백이 불가능하므로,
            // save에 대한 보상(행 삭제)도 스택에 push 해 Redis와 동일하게 되돌린다.
            UserStats savedStats = userStatsRepository.save(userStats);
            rollback.push(() -> userStatsRepository.deleteById(savedStats.getId()));
            log.info("유저 통계 저장 완료: userId={}, matchId={}, 좌석수={}, selectedSeats={}, userRank={}, totalRank={}",
                    userId, matchId, allSeatIds.size(), selectedSeats, userRank, totalRank);

            // 10. 경기 종료 조건 체크
            // 조건 1: 모든 실제 유저 confirm 완료 (remainingHumanUsers <= 0)
            // 조건 2: 만석(reservedCount >= totalSeats)
            Integer totalSeats = getTotalSeats(matchId);

            boolean isFull = reservedCount != null && totalSeats != null && reservedCount >= totalSeats;
            boolean humanUsersEnded = remainingHumanUsers != null && remainingHumanUsers <=0 ;

            if (( humanUsersEnded || isFull)
                    && match.getStatus() == Match.MatchStatus.PLAYING) {

                log.info("경기 종료 조건 만족 (모든 유저 확정 또는 만석): matchId={}, remainingHumanUsers={}, reservedCount={}, totalSeats={}",
                        matchId, remainingHumanUsers, reservedCount, totalSeats);

                handleFullMatchService.handleFullMatchAtConfirm(matchId, match);
            } else {
                log.debug("아직 경기 계속 진행: matchId={}, remainingHumanUsers={}, reservedCount={}, totalSeats={}",
                        matchId, remainingHumanUsers, reservedCount, totalSeats);
            }

            // 11. 성공 응답 생성
            SeatConfirmationResponse response = SeatConfirmationResponse.builder()
                    .success(true)
                    .message("개인 경기 종료")
                    .userRank(userRank)
                    .totalRank(totalRank)
                    .confirmedSeats(confirmedSeats)
                    .matchId(matchId)
                    .userId(userId)
                    .build();

            // 12. Kafka 이벤트 발행
            publishConfirmationEvent(userId, matchId, seatIds, sectionIds,
                    true, "개인 경기 종료", startTime);

            return response;
        }
        catch(Exception e)
        {
            // 실제로 성공한 상태 변경만 역순(LIFO)으로 보상.
            // Zone 0(좌석 조회/파싱)에서 터지면 스택이 비어있어 아무것도 되돌리지 않는다.
            rollback.forEach(Runnable::run);

            redisTemplate.delete(idempotencyKey);

            throw new RuntimeException(e);
        }

    }

    /**
     * Redis에서 roomId를 읽고, totalSeats를 캐시-어사이드 패턴으로 반환
     */
    private Integer getTotalSeats(Long matchId) {
        String roomIdStr = redisTemplate.opsForValue().get("match:" + matchId + ":room");
        if (roomIdStr == null) {
            throw new IllegalStateException("매치 roomId를 찾을 수 없습니다: " + matchId);
        }
        Long roomId = Long.parseLong(roomIdStr);

        String totalSeatsStr = redisTemplate.opsForValue().get("match:" + matchId + ":totalSeats");
        if (totalSeatsStr != null) {
            return Integer.parseInt(totalSeatsStr);
        }
        Integer totalSeats = roomServerClient.getTotalSeats(roomId);
        if (totalSeats != null && totalSeats > 0) {
            redisTemplate.opsForValue().set(
                "match:" + matchId + ":totalSeats",
                String.valueOf(totalSeats),
                Duration.ofSeconds(MATCH_REDIS_TTL_SECONDS)
            );
        }
        return totalSeats;
    }

    /**
     * 경기 종료 시 통계 데이터 저장
     */
    private void saveMatchStatistics(Long matchId, Match match) {
        try {
            // success_user_count, success_bot_count는 이미 Confirm 시점에 증가시킴
            // 여기서는 Redis에서 최종 값 확인만

            log.info("경기 통계 저장: matchId={}, successUserCount={}, successBotCount={}",
                    matchId, match.getSuccessUserCount(), match.getSuccessBotCount());

        } catch (Exception e) {
            log.error("경기 통계 저장 중 오류 발생: matchId={}", matchId, e);
        }
    }

    /**
     * Redis 전체 정리 (모든 키 삭제)
     * - 좌석 키: seat:{matchId}:*
     * - 상태 키: match:{matchId}:status
     * - 카운트 키: match:{matchId}:reserved_count
     * - 실제 유저 키: humanusers:match:{matchId}
     * - 등수 카운터 키: match:{matchId}:human_rank_counter, total_rank_counter
     */
    private void cleanupAllMatchRedis(Long matchId) {
        log.info("경기 종료 - Redis 전체 정리 시작: matchId={}", matchId);

        try {
            // 1. 좌석 키 삭제
            String seatPattern = "seat:" + matchId + ":*";
            Set<String> seatKeys = redisTemplate.keys(seatPattern);
            if (seatKeys != null && !seatKeys.isEmpty()) {
                redisTemplate.delete(seatKeys);
                log.info("좌석 키 삭제: matchId={}, count={}", matchId, seatKeys.size());
            }

            // 2. 상태 키 삭제
            String statusKey = "match:" + matchId + ":status";
            redisTemplate.delete(statusKey);

            // 3. reserved_count 키 삭제
            String reservedCountKey = "match:" + matchId + ":reserved_count";
            redisTemplate.delete(reservedCountKey);

            // 4. 실제 유저 카운터 키 삭제
            String humanUsersKey = "humanusers:match:" + matchId;
            redisTemplate.delete(humanUsersKey);

            // 5. 등수 카운터 키 삭제
            String humanRankCounterKey = "match:" + matchId + ":human_rank_counter";
            String totalRankCounterKey = "match:" + matchId + ":total_rank_counter";
            redisTemplate.delete(humanRankCounterKey);
            redisTemplate.delete(totalRankCounterKey);

            log.info("경기 종료 - Redis 전체 정리 완료: matchId={}", matchId);

        } catch (Exception e) {
            log.error("Redis 정리 중 오류 발생: matchId={}", matchId, e);
        }
    }

    /**
     * Redis에서 해당 유저가 선점한 좌석 조회
     * @return seatId 목록 (형식: "8-9-15")
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
                            // key 형식: seat:100:8:9-15 -> seatId: 8-9-15
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
     * Redis 키에서 seatId 추출
     * 예: "seat:100:8:9-15" -> "8-9-15"
     */
    private String extractSeatIdFromKey(String key) {
        String[] parts = key.split(":");
        if (parts.length >= 4) {
            return parts[2] + "-" + parts[3];  // sectionId-row-col
        }
        return "";
    }

    /**
     * seatId에서 sectionId 추출
     * 예: "8-9-15" -> "8"
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