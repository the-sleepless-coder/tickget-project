package com.ticketing.captcha.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.ticketing.KafkaTopic;
import com.ticketing.captcha.DTO.CaptchaDTO;
import com.ticketing.captcha.DTO.HttpResultDTO;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.kafka.support.SendResult;
import org.springframework.stereotype.Service;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.MalformedURLException;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

@Slf4j
@Service
public class CaptchaService {
    // 환경변수
    // application.yaml
    private final String address;
    private final int timeout;
    private final KafkaTemplate<String, Object> kafkaTemplate;
    private final ObjectMapper mapper;

    private static final String ID = "id";
    private static final String IMAGE = "image";

    public CaptchaService(ObjectMapper mapper,
                          @Value("${captcha.address}") String address,
                          @Value("${captcha.timeout}") int timeout,
                          KafkaTemplate<String,Object> kafkaTemplate){
        this.address = address;
        this.mapper = mapper;
        this.timeout = timeout;
        this.kafkaTemplate = kafkaTemplate;
    }

    public HttpResultDTO validateCaptcha(CaptchaDTO userInput, Long userId) throws IOException {
         // POST 요청에서 받은 동일한 captcha id로,
         // Captcha가 맞는지 확인한다.
         String id = userInput.getCaptchaId();
         // POST메서드를 통한 답안 검증.
         URL postUrl = new URL(address);
         HttpURLConnection postCon = (HttpURLConnection) postUrl.openConnection();
         postCon.setRequestMethod("POST");
         postCon.setRequestProperty("Content-Type", "application/json");
         postCon.setDoOutput(true);

         // POST BODY 생성
         // id, userInput을 넣어서, 보안문자 검증
         String jsonInput = String.format("{\"id\":\"%s\",\"answer\":\"%s\"}", id, userInput.getInput());
         // status에 대한 응답을 받는다.
         try(OutputStream os = postCon.getOutputStream()){
         byte[] input = jsonInput.getBytes(StandardCharsets.UTF_8);
         os.write(input, 0, input.length);
         }

        // postStatus 확인
        // 200 제외한 나머지 응답을 에러로 처리하지 않게 한다.
         int postStatus = postCon.getResponseCode();
         InputStream is = (postStatus>=200 && postStatus<300)
                 ? postCon.getInputStream()
                 : postCon.getErrorStream();

         // body값을 받는다.
         String body = "";
         BufferedReader postReader = new BufferedReader(new InputStreamReader(is, StandardCharsets.UTF_8));
         StringBuilder sb = new StringBuilder();
         String inputLine = "";
         while((inputLine = postReader.readLine()) != null){
             sb.append(inputLine);
             body = sb.toString();
         }

         Map<String, List<String>> headers = postCon.getHeaderFields();
         HttpResultDTO response = new HttpResultDTO(postStatus, body, headers);

         postReader.close();
         postCon.disconnect();

         // Kafka로 MongoDB에 비동기적으로 적재
        /**
        try{
            SendResult<String, Object> recordData = kafkaTemplate.send().get();
            log.info("Kafka: 캡차 Log 적재 이벤트 발행");

        }catch(Exception e){
            e.printStackTrace();
        }
         **/

         return response;
    }


    public Map<String, String> getCaptcha() throws IOException {
        // 문자열에 대한 GET 요청을 통해, Captcha id/Encoded Image값을 조회한다.

        // 봇이면 요청 자체를 안 보내게 한다.
        // tokenClaims.isBot()
        Map<String, String> resultMap = new HashMap<>();

        // 사용자면 문자열 id에 대한 응답을 받는다.
        URL url = new URL(address);
        HttpURLConnection con = (HttpURLConnection) url.openConnection();
        con.setRequestMethod("GET");

        con.setConnectTimeout(timeout);

        // Captcha id값을 응답 받는다.
        int getStatus = con.getResponseCode();
        if(getStatus != HttpStatus.OK.value()){
            throw new IOException("Captcha Server GET Error");
        }

        BufferedReader in = new BufferedReader(new InputStreamReader(con.getInputStream()));

        String inputLine;
        StringBuffer content = new StringBuffer();
        while((inputLine = in.readLine()) != null){
            content.append(inputLine);
        }

        JsonNode node  = mapper.readTree(content.toString());
        String id = node.get("id").asText();
        String image = node.get("img").asText();

        resultMap.put(ID, id);
        resultMap.put(IMAGE, image);

        in.close();
        con.disconnect();

        return resultMap;
    }

}
