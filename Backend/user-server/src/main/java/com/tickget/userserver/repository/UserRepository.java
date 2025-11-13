package com.tickget.userserver.repository;


import com.tickget.userserver.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.stereotype.Repository;

@Repository
public interface UserRepository extends JpaRepository<User, Long> {
    // 닉네임 중복 확인
    boolean existsByNickname(String nickname);
}