package com.tickget.roomserver.kafaka;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.tickget.roomserver.domain.enums.EventType;
import com.tickget.roomserver.dto.cache.QueueStatus;
import com.tickget.roomserver.kafaka.payload.HostChangedPayload;
import com.tickget.roomserver.kafaka.payload.QueueStatusMapPayload;
import com.tickget.roomserver.kafaka.payload.RoomSettingUpdatedPayload;
import com.tickget.roomserver.kafaka.payload.UserDequeuedPayload;
import com.tickget.roomserver.kafaka.payload.UserJoinedPayload;
import com.tickget.roomserver.kafaka.payload.UserLeftPayload;
import java.util.Map;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

@Getter
@Builder
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)  // null 필드는 JSON에서 제외
public class RoomEventMessage {
    private EventType eventType;
    private Long roomId;
    private Long timestamp;
    private String message;


    private Object payload;

    // ===== 정적 팩토리 메서드들 =====

    public static RoomEventMessage userJoined(Long roomId, Long userId,String userName, int totalUsersInRoom) {
        return RoomEventMessage.builder()
                .eventType(EventType.USER_JOINED)
                .roomId(roomId)
                .timestamp(System.currentTimeMillis())
                .message(userId + "이 방에 입장했습니다.")
                .payload(UserJoinedPayload.builder()
                        .userId(userId)
                        .userName(userName)
                        .totalUsersInRoom(totalUsersInRoom)
                        .build())
                .build();
    }

    public static RoomEventMessage userLeft(Long roomId, Long userId, int totalUsersInRoom) {
        return RoomEventMessage.builder()
                .eventType(EventType.USER_LEFT)
                .roomId(roomId)
                .timestamp(System.currentTimeMillis())
                .message(userId + "이 방에서 퇴장했습니다.")
                .payload(UserLeftPayload.builder()
                        .userId(userId)
                        .totalUsersInRoom(totalUsersInRoom)
                        .build())
                .build();
    }

    public static RoomEventMessage hostChanged(Long roomId, String previousHostId, String newHostId, long timestamp) {
        return RoomEventMessage.builder()
                .eventType(EventType.HOST_CHANGED)
                .roomId(roomId)
                .timestamp(timestamp)
                .message("방장이 변경되었습니다.")
                .payload(HostChangedPayload.builder()
                        .previousHostId(previousHostId)
                        .newHostId(newHostId)
                        .build())
                .build();
    }

    public static RoomEventMessage roomSettingUpdated(
            Long roomId,
            String roomName,
            String difficulty,
            Integer maxUserCount,
            Long startTime
    ) {
        return RoomEventMessage.builder()
                .eventType(EventType.ROOM_SETTING_UPDATED)
                .roomId(roomId)
                .timestamp(System.currentTimeMillis())
                .message("방 설정이 변경되었습니다.")
                .payload(RoomSettingUpdatedPayload.builder()
                        .roomName(roomName)
                        .difficulty(difficulty)
                        .maxUserCount(maxUserCount)
                        .startTime(startTime)
                        .build())
                .build();
    }

    public static RoomEventMessage queueStatusUpdate(Long roomId, Map<Long, QueueStatus> queueStatuses) {
        return RoomEventMessage.builder()
                .eventType(EventType.QUEUE_STATUS_UPDATE)
                .roomId(roomId)
                .timestamp(System.currentTimeMillis())
                .message("대기열 상태가 업데이트되었습니다.")
                .payload(QueueStatusMapPayload.builder()
                        .queueStatuses(queueStatuses)
                        .build())
                .build();
    }

    public static RoomEventMessage userDequeued(Long roomId, Long userId, String matchId, Long timestamp) {
        return RoomEventMessage.builder()
                .eventType(EventType.USER_DEQUEUED)
                .roomId(roomId)
                .timestamp(timestamp)
                .message("티켓팅에 성공했습니다!")
                .payload(UserDequeuedPayload.builder()
                        .userId(userId)
                        .matchId(matchId)
                        .timestamp(timestamp)
                        .build())
                .build();
    }
}