package com.ticketing.queue.DTO;

import com.fasterxml.jackson.annotation.JsonUnwrapped;
import lombok.AllArgsConstructor;
import lombok.Getter;
import lombok.NoArgsConstructor;
import org.springframework.data.mongodb.core.mapping.Unwrapped;

import java.util.UUID;

@Getter
@NoArgsConstructor
@AllArgsConstructor
public class QueueLogDTO {

    // Queue(예매 단계)에서 Log 정보 저장을 위한 DTO
    // 계층 간 넘나들 정보를 다 정의.
    // MongoDB에 넣을 때 평탄화를 한다.
    @Unwrapped(onEmpty = Unwrapped.OnEmpty.USE_NULL, prefix = "")
    QueueDTO queueInfo;

    @Unwrapped(onEmpty = Unwrapped.OnEmpty.USE_NULL, prefix = "")
    QueueUserInfoDTO queueUserInfo;

    public void setEventId(String uuid) {
        if(queueUserInfo!=null){
            queueInfo.setEventId(uuid);
        }
    }
}
