package com.posturemonitor;

import com.posturemonitor.model.PostureEvent;
import com.posturemonitor.model.PostureSession;
import com.posturemonitor.service.InsightService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpMethod;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.ExpectedCount;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.Map;

import static org.hamcrest.Matchers.containsString;
import static org.junit.jupiter.api.Assertions.*;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.*;
import static org.springframework.test.web.client.response.MockRestResponseCreators.*;

public class InsightServiceTest {

    private final InsightService insightService = new InsightService();

    private PostureSession createSampleSession(int alerts, int events, double sustainedSec) {
        PostureSession session = new PostureSession();
        session.setId(101L);
        session.setStartedAt(Instant.now().minusSeconds(600));
        session.setEndedAt(Instant.now());
        session.setDurationSeconds(600);
        session.setTotalAlerts(alerts);
        session.setTotalEvents(events);
        session.setLongestSustainedSeconds(sustainedSec);

        PostureEvent event = new PostureEvent();
        event.setMeasurement("Head / Neck Angle");
        event.setEventType("Sustained Deviation");
        event.setPeakDeviation(14.5);
        event.setDurationSeconds((long) sustainedSec);
        session.addEvent(event);

        return session;
    }

    private static final String VALID_GEMINI_JSON = """
            {
              "candidates": [
                {
                  "content": {
                    "parts": [
                      {
                        "text": "Observed pattern: Minor forward head tilt recorded during session. Practical suggestions: Take 20-second neck stretch breaks every 30 minutes. Data limitation: Non-clinical reflection based on webcam metrics."
                      }
                    ],
                    "role": "model"
                  },
                  "finishReason": "STOP",
                  "index": 0
                }
              ]
            }
            """;

    @Test
    @DisplayName("summarize returns rule-based summary when no API key configured")
    void testRuleBasedSummaryWhenNoKey() {
        PostureSession session = new PostureSession();
        session.setStartedAt(Instant.now());
        session.setEndedAt(Instant.now());
        session.setDurationSeconds(120);
        session.setTotalAlerts(0);
        session.setTotalEvents(0);
        session.setLongestSustainedSeconds(0);

        Map<String, Object> result = insightService.summarize(session);

        assertNotNull(result);
        assertEquals("rule-based", result.get("provider"));
        assertEquals(false, result.get("aiConfigured"));
        assertEquals("Low", result.get("riskLevel"));
        assertTrue(result.get("summary").toString().contains("No sustained posture-deviation"));
    }

    @Test
    @DisplayName("summarize calculates High risk for 8+ events or 60s+ sustained duration")
    void testHighRiskCalculation() {
        PostureSession session = new PostureSession();
        session.setStartedAt(Instant.now());
        session.setEndedAt(Instant.now());
        session.setDurationSeconds(1800);
        session.setTotalAlerts(5);
        session.setTotalEvents(9);
        session.setLongestSustainedSeconds(65.0);

        PostureEvent event = new PostureEvent();
        event.setMeasurement("Head / Neck Angle");
        event.setEventType("Sustained Deviation");
        event.setPeakDeviation(18.5);
        event.setDurationSeconds(65);
        session.addEvent(event);

        Map<String, Object> result = insightService.summarize(session);

        assertNotNull(result);
        assertEquals("High", result.get("riskLevel"));
        assertTrue(result.get("summary").toString().contains("9 sustained deviation event(s)"));
        assertTrue(result.get("recommendation").toString().contains("movement break"));
    }

    @Test
    @DisplayName("normalizeModelName strips leading models/ prefix and handles null/blank")
    void testNormalizeModelName() {
        assertEquals("gemini-1.5-flash", insightService.normalizeModelName("gemini-1.5-flash"));
        assertEquals("gemini-1.5-flash", insightService.normalizeModelName("models/gemini-1.5-flash"));
        assertEquals("gemini-2.0-flash", insightService.normalizeModelName("models/gemini-2.0-flash"));
        assertEquals("gemini-1.5-flash", insightService.normalizeModelName(null));
        assertEquals("gemini-1.5-flash", insightService.normalizeModelName("   "));
    }

    @Test
    @DisplayName("buildEndpointUrl correctly builds versioned endpoint")
    void testBuildEndpointUrl() {
        insightService.setApiUrl("https://generativelanguage.googleapis.com");
        insightService.setApiVersion("v1beta");
        String url = insightService.buildEndpointUrl("gemini-1.5-flash");
        assertEquals("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent", url);
    }

    @Test
    @DisplayName("parseGeminiResponse extracts candidate text correctly")
    void testParseGeminiResponseSuccess() {
        byte[] bytes = VALID_GEMINI_JSON.getBytes(StandardCharsets.UTF_8);
        String text = insightService.parseGeminiResponse(bytes, 200);
        assertNotNull(text);
        assertTrue(text.contains("Observed pattern: Minor forward head tilt"));
        assertTrue(text.contains("Data limitation"));
    }

    @Test
    @DisplayName("parseGeminiResponse combines multiple text parts in candidate")
    void testParseGeminiResponseMultipleParts() {
        String multiPartJson = """
            {
              "candidates": [
                {
                  "content": {
                    "parts": [
                      { "text": "Part 1: Good posture maintained. " },
                      { "text": "Part 2: Remember to stretch." }
                    ]
                  },
                  "finishReason": "STOP"
                }
              ]
            }
            """;
        String text = insightService.parseGeminiResponse(multiPartJson.getBytes(StandardCharsets.UTF_8), 200);
        assertEquals("Part 1: Good posture maintained. Part 2: Remember to stretch.", text);
    }

    @Test
    @DisplayName("parseGeminiResponse handles octet-stream byte array cleanly")
    void testOctetStreamResponseHandling() {
        // Raw byte array decoded as UTF-8
        byte[] octetStreamBytes = VALID_GEMINI_JSON.getBytes(StandardCharsets.UTF_8);
        String text = insightService.parseGeminiResponse(octetStreamBytes, 200);
        assertNotNull(text);
        assertTrue(text.contains("Observed pattern: Minor forward head tilt"));
    }

    @Test
    @DisplayName("parseGeminiResponse throws on empty or null body")
    void testParseGeminiResponseEmptyBody() {
        assertThrows(InsightService.GeminiApiException.class, () -> insightService.parseGeminiResponse(new byte[0], 200));
        assertThrows(InsightService.GeminiApiException.class, () -> insightService.parseGeminiResponse(null, 200));
    }

    @Test
    @DisplayName("parseGeminiResponse throws on malformed JSON")
    void testParseGeminiResponseMalformedJson() {
        byte[] brokenJson = "{ invalid json here...".getBytes(StandardCharsets.UTF_8);
        assertThrows(InsightService.GeminiApiException.class, () -> insightService.parseGeminiResponse(brokenJson, 200));
    }

    @Test
    @DisplayName("parseGeminiResponse throws on safety block in promptFeedback")
    void testParseGeminiResponseSafetyBlocked() {
        String blockedJson = """
            {
              "promptFeedback": {
                "blockReason": "SAFETY"
              }
            }
            """;
        InsightService.GeminiApiException ex = assertThrows(InsightService.GeminiApiException.class,
                () -> insightService.parseGeminiResponse(blockedJson.getBytes(StandardCharsets.UTF_8), 200));
        assertTrue(ex.getMessage().contains("safety filters"));
    }

    @Test
    @DisplayName("parseGeminiResponse throws when candidates array is missing or empty")
    void testParseGeminiResponseNoCandidates() {
        String noCandidatesJson = "{ \"candidates\": [] }";
        InsightService.GeminiApiException ex = assertThrows(InsightService.GeminiApiException.class,
                () -> insightService.parseGeminiResponse(noCandidatesJson.getBytes(StandardCharsets.UTF_8), 200));
        assertTrue(ex.getMessage().contains("no candidates"));
    }

    @Test
    @DisplayName("Successful Gemini HTTP response populates AI insights and preserves base metrics")
    void testSuccessfulGeminiCall() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        InsightService service = new InsightService(builder);
        service.setApiKey("test-valid-api-key");
        service.setModel("gemini-1.5-flash");

        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andExpect(header("x-goog-api-key", "test-valid-api-key"))
                .andRespond(withSuccess(VALID_GEMINI_JSON, MediaType.APPLICATION_JSON));

        PostureSession session = createSampleSession(1, 2, 15.0);
        Map<String, Object> result = service.summarize(session);

        mockServer.verify();
        assertNotNull(result);
        assertEquals("Google Gemini (gemini-1.5-flash)", result.get("provider"));
        assertEquals(true, result.get("aiConfigured"));
        assertTrue(result.get("summary").toString().contains("Observed pattern"));
        assertEquals("Low", result.get("riskLevel"));
        assertEquals(1, result.get("totalAlerts"));
        assertEquals(2, result.get("deviationEvents"));
    }

    @Test
    @DisplayName("Gemini HTTP response with application/octet-stream content-type succeeds without converter error")
    void testOctetStreamContentTypeHandling() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        InsightService service = new InsightService(builder);
        service.setApiKey("test-valid-api-key");
        service.setModel("models/gemini-1.5-flash"); // also tests prefix stripping

        mockServer.expect(requestTo("https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent"))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withSuccess(VALID_GEMINI_JSON.getBytes(StandardCharsets.UTF_8), MediaType.APPLICATION_OCTET_STREAM));

        PostureSession session = createSampleSession(1, 1, 10.0);
        Map<String, Object> result = service.summarize(session);

        mockServer.verify();
        assertNotNull(result);
        assertEquals("Google Gemini (gemini-1.5-flash)", result.get("provider"));
        assertEquals(true, result.get("aiConfigured"));
        assertTrue(result.get("summary").toString().contains("Observed pattern"));
    }

    @Test
    @DisplayName("HTTP 401 Unauthorized falls back to rule-based summary without retrying")
    void testHttp401AuthFailureFallback() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        InsightService service = new InsightService(builder);
        service.setApiKey("invalid-secret-key-12345");
        service.setModel("gemini-1.5-flash");

        mockServer.expect(ExpectedCount.once(), requestTo(containsString("gemini-1.5-flash:generateContent")))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.UNAUTHORIZED)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"code\":401,\"message\":\"API key not valid. Please pass a valid API key.\"}}"));

        PostureSession session = createSampleSession(2, 4, 35.0);
        Map<String, Object> result = service.summarize(session);

        mockServer.verify();
        assertNotNull(result);
        assertEquals("rule-based fallback", result.get("provider"));
        assertEquals(true, result.get("aiConfigured"));
        assertTrue(result.get("note").toString().contains("authentication failed"));
        assertFalse(result.get("note").toString().contains("invalid-secret-key-12345"), "API key must never be logged or returned in note");
        assertEquals("Moderate", result.get("riskLevel"));
        assertEquals(4, result.get("deviationEvents"));
    }

    @Test
    @DisplayName("HTTP 404 Model Not Found falls back to rule-based summary without retrying")
    void testHttp404ModelNotFoundFallback() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        InsightService service = new InsightService(builder);
        service.setApiKey("test-key");
        service.setModel("gemini-nonexistent-model");

        mockServer.expect(ExpectedCount.once(), requestTo(containsString("gemini-nonexistent-model:generateContent")))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.NOT_FOUND)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"code\":404,\"message\":\"models/gemini-nonexistent-model is not found for API version v1beta\"}}"));

        PostureSession session = createSampleSession(0, 0, 0.0);
        Map<String, Object> result = service.summarize(session);

        mockServer.verify();
        assertNotNull(result);
        assertEquals("rule-based fallback", result.get("provider"));
        assertTrue(result.get("note").toString().contains("not found"));
        assertTrue(result.get("note").toString().contains("gemini-nonexistent-model"));
    }

    @Test
    @DisplayName("HTTP 503 Service Unavailable retries with backoff and falls back cleanly")
    void testHttp503HighDemandFallbackAndRetry() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        InsightService service = new InsightService(builder);
        service.setApiKey("test-key");
        service.setModel("gemini-1.5-flash");
        service.setMaxRetries(2);
        service.setInitialBackoffMs(50); // Fast retry for unit testing

        // Expect 3 attempts (1 initial + 2 retries)
        mockServer.expect(ExpectedCount.times(3), requestTo(containsString("gemini-1.5-flash:generateContent")))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.SERVICE_UNAVAILABLE)
                        .header("Retry-After", "1")
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"code\":503,\"message\":\"This model is currently experiencing high demand.\"}}"));

        PostureSession session = createSampleSession(3, 8, 62.0);
        Map<String, Object> result = service.summarize(session);

        mockServer.verify();
        assertNotNull(result);
        assertEquals("rule-based fallback", result.get("provider"));
        assertEquals(true, result.get("aiConfigured"));
        assertTrue(result.get("note").toString().contains("high demand") || result.get("note").toString().contains("503"));
        assertEquals("High", result.get("riskLevel"));
        assertEquals(8, result.get("deviationEvents"));
        assertEquals(62.0, result.get("longestSustainedSeconds"));
    }

    @Test
    @DisplayName("HTTP 429 Rate Limit retries and falls back with rate limit note")
    void testHttp429RateLimitFallback() {
        RestClient.Builder builder = RestClient.builder();
        MockRestServiceServer mockServer = MockRestServiceServer.bindTo(builder).build();

        InsightService service = new InsightService(builder);
        service.setApiKey("test-key");
        service.setModel("gemini-1.5-flash");
        service.setMaxRetries(1);
        service.setInitialBackoffMs(50);

        mockServer.expect(ExpectedCount.times(2), requestTo(containsString("gemini-1.5-flash:generateContent")))
                .andExpect(method(HttpMethod.POST))
                .andRespond(withStatus(HttpStatus.TOO_MANY_REQUESTS)
                        .contentType(MediaType.APPLICATION_JSON)
                        .body("{\"error\":{\"code\":429,\"message\":\"Resource exhausted: quota exceeded\"}}"));

        PostureSession session = createSampleSession(1, 1, 10.0);
        Map<String, Object> result = service.summarize(session);

        mockServer.verify();
        assertNotNull(result);
        assertEquals("rule-based fallback", result.get("provider"));
        assertTrue(result.get("note").toString().contains("rate limit") || result.get("note").toString().contains("429"));
    }
}
