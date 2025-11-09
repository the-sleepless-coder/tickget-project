package com.tickget.authserver.filter;

import jakarta.servlet.*;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.core.Ordered;
import org.springframework.core.annotation.Order;
import org.springframework.stereotype.Component;

import java.io.IOException;
import java.util.Enumeration;

/**
 * 모든 HTTP 요청/응답을 로깅하는 디버깅 필터
 * - 요청 경로, 메서드, 헤더, 파라미터 등을 상세히 로그로 출력
 * - Spring Security 필터보다 먼저 실행 (Order.HIGHEST_PRECEDENCE)
 */
@Slf4j
@Component
@Order(Ordered.HIGHEST_PRECEDENCE)
public class RequestLoggingFilter implements Filter {

    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain)
            throws IOException, ServletException {

        HttpServletRequest httpRequest = (HttpServletRequest) request;
        HttpServletResponse httpResponse = (HttpServletResponse) response;

        long startTime = System.currentTimeMillis();

        // ===== 요청 정보 로깅 =====
        log.info("==================================================");
        log.info("🔵 [REQUEST START]");
        log.info("Method: {}", httpRequest.getMethod());
        log.info("URI: {}", httpRequest.getRequestURI());
        log.info("Query String: {}", httpRequest.getQueryString());
        log.info("Remote Addr: {}", httpRequest.getRemoteAddr());
        log.info("Protocol: {}", httpRequest.getProtocol());
        log.info("Scheme: {}", httpRequest.getScheme());
        log.info("Server Name: {}", httpRequest.getServerName());
        log.info("Server Port: {}", httpRequest.getServerPort());
        log.info("Context Path: {}", httpRequest.getContextPath());
        log.info("Servlet Path: {}", httpRequest.getServletPath());
        log.info("Path Info: {}", httpRequest.getPathInfo());

        // 헤더 정보 로깅
        log.info("--- Request Headers ---");
        Enumeration<String> headerNames = httpRequest.getHeaderNames();
        while (headerNames.hasMoreElements()) {
            String headerName = headerNames.nextElement();
            String headerValue = httpRequest.getHeader(headerName);
            log.info("  {}: {}", headerName, headerValue);
        }

        // 파라미터 정보 로깅
        if (httpRequest.getParameterMap().size() > 0) {
            log.info("--- Request Parameters ---");
            httpRequest.getParameterMap().forEach((key, values) -> {
                log.info("  {}: {}", key, String.join(", ", values));
            });
        }

        log.info("==================================================");

        try {
            // 다음 필터로 전달
            chain.doFilter(request, response);
        } finally {
            // ===== 응답 정보 로깅 =====
            long duration = System.currentTimeMillis() - startTime;

            log.info("==================================================");
            log.info("🟢 [RESPONSE END]");
            log.info("Status: {}", httpResponse.getStatus());
            log.info("Duration: {}ms", duration);

            // 응답 헤더 로깅
            log.info("--- Response Headers ---");
            httpResponse.getHeaderNames().forEach(headerName -> {
                log.info("  {}: {}", headerName, httpResponse.getHeader(headerName));
            });

            log.info("==================================================");

            // 302 리다이렉트인 경우 특별히 강조
            if (httpResponse.getStatus() == 302) {
                log.error("🚨🚨🚨 302 REDIRECT DETECTED! 🚨🚨🚨");
                log.error("Location: {}", httpResponse.getHeader("Location"));
                log.error("Original Request URI: {}", httpRequest.getRequestURI());
                log.error("🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨🚨");
            }
        }
    }

    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
        log.info("🔧 RequestLoggingFilter initialized - All requests will be logged");
    }

    @Override
    public void destroy() {
        log.info("🔧 RequestLoggingFilter destroyed");
    }
}
