package com.example.testserver.mongo;

import lombok.Data;
import lombok.NoArgsConstructor;
import org.springframework.data.annotation.Id;
import org.springframework.data.mongodb.core.mapping.Document;

@Data
@Document(collection = "test_docs")
@NoArgsConstructor
public class MongoTestDocument {
    @Id
    private String id; // MongoDB는 ID가 String
    private String description;

    public MongoTestDocument(String description) {
        this.description = description;
    }
}