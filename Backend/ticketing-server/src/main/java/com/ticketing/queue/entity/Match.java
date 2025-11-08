package com.ticketing.queue.entity;

import jakarta.persistence.*;
import lombok.Setter;

//SQL내 테이블
/**@Entity
@Table(name="matches")
@Setter
public class Match {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "room_id", nullable=false)
    private Long roomId;

    @Column(name = "match_name", nullable = false, length = 100)
    private String matchName;

    @Enumerated(EnumType.STRING)
    @Column(name="difficulty", nullable = false)
    private Difficulty difficulty;

    @Column(name="max_user", nullable = false)
    private String maxUser;

    @Column(name="user_bot_count", nullable = false)
    private String usedBotCount;

    @Column(name="started_at", nullable = false)
    private String startedAt;

    @Enumerated(EnumType.STRING)
    @Column(name="status", nullable = false)
    private matchStatus status;

    @Column(name="user_count", nullable = true)
    private String userCount;

    @Column(name="success_user_count", nullable = true)
    private String successUserCount;

    @Column(name="success_bot_count", nullable = true)
    private String successBotCount;

    @Column(name="ended_at", nullable = true)
    private String endedAt;

    @Column(name="time_limit_seconds", nullable = true)
    private String timeLimitSeconds;

    @Column(name="created_at", nullable = false)
    private String createdAt;

    @Column(name="update_at", nullable = false)
    private String updateAt;


    public enum Difficulty{
        EASY, NORMAL, HARD
    }

    public enum matchStatus{
        WAITING, PLAYING, FINISHED
    }

}
 */