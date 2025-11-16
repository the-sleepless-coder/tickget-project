package com.stats.repository;

import com.stats.entity.User;
import com.stats.entity.UserStats;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    // 특정 사용자에 대한 User 정보 조회
    Optional<User> findById(Long id);

}
