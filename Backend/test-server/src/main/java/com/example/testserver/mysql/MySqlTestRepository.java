package com.example.testserver.mysql;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface MySqlTestRepository extends JpaRepository<MySqlTestEntity, Long> {
}