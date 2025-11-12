package com.ticketing.config;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.context.annotation.Configuration;

@Configuration
@OpenAPIDefinition(
        info = @Info(title = "Ticketing API", version = "v1", description = "경기 관련 데이터 API 문서")
)
public class SwaggerConfig {
}
