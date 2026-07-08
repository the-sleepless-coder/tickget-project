package com.ticketing.queue.outbox;

// Outbox event_type 상수 (토픽 매핑/생성 로직과 문자열을 일치시키기 위해 한 곳에서 관리)
public final class OutboxEventType {
    private OutboxEventType() {}

    // 봇 준비 요청 (경기 설정 시)
    public static final String BOT_PREPARE_REQUESTED = "BOT_PREPARE_REQUESTED";
    // 봇 준비 취소 teardown (경기 시작 실패 시)
    public static final String BOT_PREPARE_CANCELLED = "BOT_PREPARE_CANCELLED";
    // room 서버 경기 취소 통지 (best-effort HTTP 대체 — 발행 보장)
    public static final String ROOM_MATCH_CANCELLED = "ROOM_MATCH_CANCELLED";
}