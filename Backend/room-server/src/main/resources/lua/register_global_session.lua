-- 전역 세션 등록 (원자적)
-- KEYS[1]: userId
-- ARGV[1]: sessionId
-- ARGV[2]: serverId
-- 반환값: 새로운 version (Long)

local key = 'global:session:' .. KEYS[1]

-- 현재 version 조회
local currentVersion = redis.call('HGET', key, 'version')
local newVersion

if currentVersion then
    -- 기존 세션이 있으면 version 증가
    newVersion = tonumber(currentVersion) + 1
else
    -- 새로운 세션이면 version 1
    newVersion = 1
end

-- sessionId, serverId, version을 한 번에 저장
redis.call('HMSET', key,
    'sessionId', ARGV[1],
    'serverId', ARGV[2],
    'version', newVersion
)

-- TTL 설정 (세션은 24시간 후 자동 삭제)
redis.call('EXPIRE', key, 86400)

return newVersion