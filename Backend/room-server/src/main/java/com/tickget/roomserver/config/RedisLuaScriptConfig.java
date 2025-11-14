package com.tickget.roomserver.config;

import lombok.extern.slf4j.Slf4j;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.core.io.ClassPathResource;
import org.springframework.data.redis.core.script.RedisScript;
import org.springframework.scripting.support.ResourceScriptSource;

import java.io.IOException;

/**
 * Redis Lua Script 설정
 * - 전역 세션 등록/삭제의 원자성 보장을 위한 Lua Script 등록
 */
@Slf4j
@Configuration
public class RedisLuaScriptConfig {

    /**
     * 전역 세션 등록 Lua Script
     * 기능:
     * - 현재 version 조회 → version 증가 → 세션 정보 저장 (원자적)
     * - 동시 등록 시 순서 보장으로 version 충돌 방지
     *
     * @return RedisScript<Long> - 새로운 version 반환
     */
    @Bean
    public RedisScript<Long> registerGlobalSessionScript() {
        try {
            String scriptPath = "lua/register_global_session.lua";
            ClassPathResource resource = new ClassPathResource(scriptPath);

            if (!resource.exists()) {
                log.error("Lua Script 파일을 찾을 수 없음: {}", scriptPath);
                throw new IllegalStateException("Lua Script 파일 없음: " + scriptPath);
            }

            String scriptContent = new ResourceScriptSource(resource).getScriptAsString();

            log.info("Lua Script 로드 완료: {}", scriptPath);

            return RedisScript.of(scriptContent, Long.class);

        } catch (IOException e) {
            log.error("Lua Script 로드 실패: register_global_session.lua", e);
            throw new IllegalStateException("Lua Script 로드 실패", e);
        }
    }

    /**
     * 전역 세션 조건부 삭제 Lua Script
     * 기능:
     * - sessionId 일치 확인 → 삭제 (원자적)
     * - 새 세션이 등록된 경우 자동으로 삭제 방지
     *
     * @return RedisScript<Long> - 1=삭제됨, 0=삭제 안됨
     */
    @Bean
    public RedisScript<Long> removeGlobalSessionIfMatchScript() {
        try {
            String scriptPath = "lua/remove_global_session_if_match.lua";
            ClassPathResource resource = new ClassPathResource(scriptPath);

            if (!resource.exists()) {
                log.error("Lua Script 파일을 찾을 수 없음: {}", scriptPath);
                throw new IllegalStateException("Lua Script 파일 없음: " + scriptPath);
            }

            String scriptContent = new ResourceScriptSource(resource).getScriptAsString();

            log.info("Lua Script 로드 완료: {}", scriptPath);

            return RedisScript.of(scriptContent, Long.class);

        } catch (IOException e) {
            log.error("Lua Script 로드 실패: remove_global_session_if_match.lua", e);
            throw new IllegalStateException("Lua Script 로드 실패", e);
        }
    }
}