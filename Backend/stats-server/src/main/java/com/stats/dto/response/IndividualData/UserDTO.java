package com.stats.dto.response.IndividualData;

import com.stats.entity.User;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;

import java.time.format.DateTimeFormatter;

@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class UserDTO {
    private Long id;
    private String birthday;
    private String email;

    static DateTimeFormatter formatter = DateTimeFormatter.ofPattern("yyyy.MM.dd");

    public static UserDTO dtobuild(User user){
        return UserDTO.builder()
                .id(user.getId())
                .birthday(user.getBirthDate().format(formatter))
                .email(user.getEmail())
                .build();
    }
}
