package com.example.testserver.mongo;

import org.springframework.data.mongodb.repository.MongoRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MongoTestRepository extends MongoRepository<MongoTestDocument, String> {
}