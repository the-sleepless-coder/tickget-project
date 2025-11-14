-- sessionId가 일치하는 경우에만 전역 세션 삭제 (원자적)
-- KEYS[1]: userId
-- ARGV[1]: expectedSessionId
-- 반환값: 1=삭제됨, 0=삭제 안됨 (불일치 또는 세션 없음)

local key = 'global:session:' .. KEYS[1]

-- 현재 세션 조회
local currentSessionId = redis.call('HGET', key, 'sessionId')

-- 세션이 없으면 0 반환
if not currentSessionId then
    return 0
end

-- sessionId가 일치하는지 확인
if currentSessionId == ARGV[1] then
    -- 일치하면 삭제
    redis.call('DEL', key)
    return 1
else
    -- 불일치하면 삭제 안함 (새 세션이 이미 등록됨)
    return 0
end