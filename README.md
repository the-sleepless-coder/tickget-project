### 프로젝트 개요
대용량 트래픽을 발생시켜 실제와 유사한 환경에서 티켓팅을 연습할 수 있는 사이트


### 어플리케이션 주요 기능 
    · 봇을 추가해 (최대 1만개) 최대한 실제와 유사한 환경에서 티켓팅 연습
    · 전체 인원에서 나의 등수 및 각 구간별 시간 확인 가능

   1. 정해진 티켓팅 이벤트가 시작될 때까지 대기한다.
<img width="1154" height="569" alt="image" src="https://github.com/user-attachments/assets/cc0839e8-0d77-4838-b8b4-ff26f2fa61ea" />

   2. 입장한 순서대로 대기열에 진입한다.
<img width="530" height="408" alt="image" src="https://github.com/user-attachments/assets/749b7cae-300c-444c-9a9a-6c0292bb1b6e" />

   3. 보안문자를 입력한다.
<img width="554" height="449" alt="image" src="https://github.com/user-attachments/assets/f7cf69b2-ee3c-41ee-a5ff-7164b0148c27" />

  4. 좌석을 선택한다.
 <img width="530" height="409" alt="image" src="https://github.com/user-attachments/assets/6c6d5e3e-8d35-42c9-8701-db3e99be211e" />

  5. 전체 사용자 및 봇 포함 사용자 중에서 내가 몇등한지 확인한다. 각 구간별 기록도 함께 확인한다.
<img width="1145" height="566" alt="image" src="https://github.com/user-attachments/assets/72014c5a-35f5-4da1-8448-f964bad8b35e" />
 
  6.마이페이지에서 나의 기록을 확인할 수 있다. 한편 매주 업데이트 되는 랭킹을 실시간으로 조회 가능하다.
  <img width="951" height="1122" alt="image" src="https://github.com/user-attachments/assets/1f914bb3-006b-4cd3-ad8d-04c56937b38e" />

  <img width="922" height="1121" alt="image" src="https://github.com/user-attachments/assets/86bc5855-e95d-4f83-98d7-c331fa91cc6b" />

 

### 주요 기술 스택
<img width="1937" height="2657" alt="image" src="https://github.com/user-attachments/assets/66344999-75e5-41e5-b73b-720b98747cf4" />

1) Spring Boot 
 웹 백엔드 서버 구축
 
2) Python        
Fragrantica 향수 데이터 웹 스크래핑

3) C               
IoT기기 제어

4) MySQL
ERD 생성 및 DB구축

5) React Native
모바일 앱 제작

6) Docker/Jenkins
Docker를 활용한 백엔드 서버 이미지 컨테이너화 
Jenkins를 활용한 EC2에 배포하는 CI/CD파이프라인 구축

### 본인 구현 사항
-ERD 구축 및 반정규화를 통한 DB 성능 최적화

: 평균 평점 계산에서 읽기 성능 최적화를 위한 DB 반정규화 

-Docker 이미지 컨테이너화 및 Jenkins를 활용한 CI/CD 파이프라인 구축

-Fragrantica에서 7000개에 달하는 대량 향수 데이터 웹 스크래핑

: 향수의 향조(향수가 내는 대표적인 향의 계열), 브랜드, 평점, 댓글 등 세부 정보까지 저장


### 기술적 세부 사항
[BackEnd]
<br>
-ERD 구축 및 반정규화를 통한 DB 성능 최적화

: 평균 평점 계산에서 읽기 성능 최적화를 위한 DB 반정규화 

-평균 계산 최적화 전략

: 전체 평점 데이터를 매번 집계하지 않고, 평점 추가 시 델타(delta) 값만 반영하여 평균을 갱신

: 삽입 시점에 평균을 계산하여, 사용자–향수 관계 테이블에 **평균 평점 컬럼을 반정규화하여 저장**

: 조회 시에는 복잡한 `AVG`, `GROUP BY` 연산 없이 **사전 계산된 평균 값만 읽도록 설계**

[CI/CD]
<br>
-Docker Compose를 활용해 Spring Boot 및 MySQL 컨테이너화를 통한, 서버 실행 환경 구축

-GitLab Webhook을 이용한, Jenkins 기반의 Spring Boot 코드 CI/CD 파이프라인 구성

[AI]
<br>
- 느낌 <-> 향조 <-> 원료 비율 추천

사용자가 고른 느낌에 따라 상관 관계가 높은 향조(향수가 내는 대표적인 향의 계열)를 3개 추출.

그리고 IoT기기에 전송되는 원료를 뽑아내기 위해서 해당 향조와 상관 관계가 높은 원료를 Top,Middle,Base(원료에 따른 향의 지속 시간과 원료의 역할에 따른 분류)의 비율을 계산해서 추천.

각 원료 별로 골라진 향조를 가장 잘 나타내는 것을 상관관계 수치에 따라서 높은 순으로 뽑아낸다.

- 구체적인 원료 비율 추천 방식
  
기본적으로 Top, Middle, Base(20%, 40%, 20%)를 배정한다. 그리고 나머지 20%의 원료는 위에서 계산한 향조-원료 상관관계 수치를 이용해, 해당 비중을 이용한 가중평균 수치를 이용해 남은 비율(20%)을 배정한다. 

사용자는 추천 받은 원료의 양을 자기 자신이 원하는 배합에 따라 조정할 수 있다.

### ERD
<img width="1177" height="800" alt="Pasted image 20260114151612" src="https://github.com/user-attachments/assets/c109c6e2-3905-4262-a5e4-c16a5a56ceb6" />

- 참고 사이트
[1] https://www.fragrantica.com/
