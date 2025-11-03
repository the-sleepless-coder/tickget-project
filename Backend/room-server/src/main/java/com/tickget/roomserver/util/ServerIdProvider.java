package com.tickget.roomserver.util;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.UUID;
import lombok.Getter;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;

@Slf4j
@Component
@Getter
public class ServerIdProvider {

    private String serverId;

    public ServerIdProvider() {
        // 1순위: K3s/K8s Pod 이름 (HOSTNAME 환경변수)
        String hostname = System.getenv("HOSTNAME");

        if (hostname != null && !hostname.isEmpty()) {
            this.serverId = hostname;
            log.info("서버 ID 설정 (K3s Pod 이름): {}", serverId);
            return;
        }

        // 2순위: 로컬 호스트명
        try {
            InetAddress ip = InetAddress.getLocalHost();
            this.serverId = ip.getHostName();
            log.info("서버 ID 설정 (호스트명): {}", serverId);
            return;
        } catch (UnknownHostException e) {
            log.warn("호스트명 조회 실패", e);
        }

        // 3순위: 랜덤 UUID
        serverId = "server-" + UUID.randomUUID().toString().substring(0, 8);
        log.info("서버 ID 설정 (랜덤): {}", serverId);
    }
}
