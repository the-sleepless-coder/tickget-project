package com.ticketing.config;

import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.data.mongodb.core.MongoTemplate;
import org.springframework.data.mongodb.core.SimpleMongoClientDatabaseFactory;
import org.springframework.beans.factory.annotation.Value;

import com.mongodb.client.MongoClient;
import com.mongodb.client.MongoClients;

@Configuration
public class MongoConfig {

    @Value("${spring.data.mongodb.uri:mongodb://localhost:27017/ticketing_logs}")
    private String mongoUri;

    @Bean
    public MongoClient mongoClient() {
        return MongoClients.create(mongoUri);
    }

    @Bean
    public MongoTemplate mongoTemplate() {
        // URI에서 자동으로 데이터베이스 이름 추출
        return new MongoTemplate(new SimpleMongoClientDatabaseFactory(mongoClient(), getDatabaseName()));
    }

    /**
     * MongoDB URI에서 데이터베이스 이름을 추출합니다.
     *
     * 지원 형식:
     * - mongodb://host:port/dbname
     * - mongodb+srv://user:pass@host/dbname
     * - mongodb+srv://user:pass@host/dbname?params
     *
     * @return 추출된 데이터베이스 이름 (기본값: "ticketing_logs")
     */
    private String getDatabaseName() {
        try {
            // URI에서 마지막 '/' 이후의 문자열이 데이터베이스 이름
            int lastSlashIndex = mongoUri.lastIndexOf("/");
            if (lastSlashIndex == -1 || lastSlashIndex == mongoUri.length() - 1) {
                return "ticketing_logs"; // 기본값
            }

            int start = lastSlashIndex + 1;

            // '?' 파라미터가 있는 경우 (예: /dbname?authSource=admin)
            int queryIndex = mongoUri.indexOf("?", start);
            int end = (queryIndex != -1) ? queryIndex : mongoUri.length();

            String dbName = mongoUri.substring(start, end);

            // 빈 문자열이면 기본값 반환
            return dbName.isEmpty() ? "ticketing_logs" : dbName;

        } catch (Exception e) {
            // 파싱 실패 시 기본값 반환
            return "ticketing_logs";
        }
    }
}