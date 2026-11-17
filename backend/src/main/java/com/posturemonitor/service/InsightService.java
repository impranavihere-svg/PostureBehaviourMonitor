package com.posturemonitor.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.posturemonitor.model.PostureEvent;
import com.posturemonitor.model.PostureSession;
import java.nio.charset.StandardCharsets;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class InsightService {
        private static final Logger log = LoggerFactory.getLogger(InsightService.class);

        private RestClient restClient;
        private final ObjectMapper mapper = new ObjectMapper();

        @Value("${gemini.api-key:${GEMINI_API_KEY:}}")
        private String apiKey;

        @Value("${gemini.model:${GEMINI_MODEL:gemini-1.5-flash}}")
        private String model = "gemini-1.5-flash";

        @Value("${gemini.api-url:${GEMINI_API_URL:https://generativelanguage.googleapis.com}}")
        private String apiUrl = "https://generativelanguage.googleapis.com";

        @Value("${gemini.api-version:${GEMINI_API_VERSION:v1beta}}")
        private String apiVersion = "v1beta";

        private int maxRetries = 2; // total attempts = 1 + 2 = 3
        private long initialBackoffMs = 500;

        public InsightService() {
                SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
                factory.setConnectTimeout(Duration.ofSeconds(5));
                factory.setReadTimeout(Duration.ofSeconds(15));
                this.restClient = RestClient.builder().requestFactory(factory).build();
        }

        public InsightService(RestClient.Builder builder) {
                this.restClient = builder.build();
        }

        public InsightService(RestClient restClient) {
                this.restClient = restClient;
        }

        // Setters for testability and programmatic configuration
        public void setRestClient(RestClient restClient) {
                this.restClient = restClient;
        }

        public void setApiKey(String apiKey) {
                this.apiKey = apiKey;
        }

        public void setModel(String model) {
                this.model = model;
        }

        public void setApiUrl(String apiUrl) {
                this.apiUrl = apiUrl;
        }

        public void setApiVersion(String apiVersion) {
                this.apiVersion = apiVersion;
        }

        public void setMaxRetries(int maxRetries) {
                this.maxRetries = maxRetries;
        }

        public void setInitialBackoffMs(long initialBackoffMs) {
                this.initialBackoffMs = initialBackoffMs;
        }

        public String getApiKey() {
                return apiKey;
        }

        public String getModel() {
                return model;
        }

        public Map<String, Object> summarize(PostureSession session) {
                Map<String, Object> out = baseSummary(session);
                if (apiKey == null || apiKey.isBlank()) {
                        out.put("provider", "rule-based");
                        out.put("aiConfigured", false);
                        out.put("note",
                                        "Add GEMINI_API_KEY to the backend environment to enable Generative AI. Rule-based insights are shown for now.");
                        return out;
                }

                String cleanModel = normalizeModelName(model);

                try {
                        log.info("Requesting Gemini insights for session {} using model {}", session.getId(),
                                        cleanModel);
                        String text = callGeminiWithRetry(session, cleanModel);

                        out.put("summary", text);
                        out.put("provider", "Google Gemini (" + cleanModel + ")");
                        out.put("aiConfigured", true);
                        out.put("note",
                                        "AI-generated reflection based only on this session's recorded metrics; not a medical assessment.");
                        log.info("Successfully generated Gemini insights for session {}", session.getId());
                } catch (GeminiAuthException ex) {
                        log.warn("Gemini authentication failed for session {}: {}. Falling back to rule-based summary.",
                                        session.getId(), maskApiKey(ex.getMessage()));
                        out.put("provider", "rule-based fallback");
                        out.put("aiConfigured", true);
                        out.put("note", "Gemini authentication failed. Please verify your GEMINI_API_KEY. A rule-based summary is shown instead.");
                } catch (GeminiNotFoundException ex) {
                        log.warn("Gemini model not found for session {}: {}. Falling back to rule-based summary.",
                                        session.getId(), maskApiKey(ex.getMessage()));
                        out.put("provider", "rule-based fallback");
                        out.put("aiConfigured", true);
                        out.put("note", "Configured Gemini model '" + cleanModel
                                        + "' was not found. A rule-based summary is shown instead.");
                } catch (GeminiRateLimitException ex) {
                        log.warn("Gemini rate limit exceeded for session {}: {}. Falling back to rule-based summary.",
                                        session.getId(), maskApiKey(ex.getMessage()));
                        out.put("provider", "rule-based fallback");
                        out.put("aiConfigured", true);
                        out.put("note", "Gemini service rate limit reached (HTTP 429). A rule-based summary is shown instead.");
                } catch (GeminiServiceUnavailableException ex) {
                        log.warn("Gemini service unavailable for session {}: {}. Falling back to rule-based summary.",
                                        session.getId(), maskApiKey(ex.getMessage()));
                        out.put("provider", "rule-based fallback");
                        out.put("aiConfigured", true);
                        out.put("note", "Gemini service is temporarily experiencing high demand (HTTP "
                                        + ex.getStatusCode() + "). A rule-based summary is shown instead.");
                } catch (GeminiBadRequestException ex) {
                        log.warn("Gemini request was rejected for session {}: {}. Falling back to rule-based summary.",
                                        session.getId(), maskApiKey(ex.getMessage()));
                        out.put("provider", "rule-based fallback");
                        out.put("aiConfigured", true);
                        out.put("note", "Gemini request was rejected (HTTP 400). A rule-based summary is shown instead.");
                } catch (Exception ex) {
                        String safeMessage = maskApiKey(ex.getMessage());
                        log.warn("Gemini request failed for session {}: {}. Falling back to rule-based summary.",
                                        session.getId(), safeMessage);
                        out.put("provider", "rule-based fallback");
                        out.put("aiConfigured", true);
                        out.put("note", "Gemini could not generate insights right now (" + ex.getClass().getSimpleName()
                                        + "). A rule-based summary is shown instead.");
                }
                return out;
        }

        private String callGeminiWithRetry(PostureSession session, String cleanModel) {
                String prompt = buildPrompt(session);
                Map<String, Object> request = Map.of(
                                "contents", new Object[] { Map.of("parts", new Object[] { Map.of("text", prompt) }) },
                                "generationConfig", Map.of("temperature", 0.3, "maxOutputTokens", 500));

                String url = buildEndpointUrl(cleanModel);

                int attempts = 0;
                int maxAttempts = 1 + Math.max(0, maxRetries);
                long currentBackoff = initialBackoffMs;

                while (true) {
                        attempts++;
                        try {
                                GeminiRawResponse rawResponse = executeHttpRequest(url, request);
                                int statusCode = rawResponse.statusCode();
                                byte[] bodyBytes = rawResponse.bodyBytes();
                                HttpHeaders headers = rawResponse.headers();

                                if (statusCode >= 200 && statusCode < 300) {
                                        return parseGeminiResponse(bodyBytes, statusCode);
                                }

                                // Parse provider error message safely from body if present
                                String providerError = extractProviderErrorMessage(bodyBytes, statusCode);

                                if (statusCode == 401 || statusCode == 403) {
                                        throw new GeminiAuthException(statusCode, providerError);
                                }
                                if (statusCode == 404) {
                                        throw new GeminiNotFoundException(statusCode, providerError);
                                }
                                if (statusCode == 400) {
                                        throw new GeminiBadRequestException(statusCode, providerError);
                                }

                                // Retriable statuses: 429, 500, 502, 503, 504
                                boolean isRetriable = statusCode == 429 || statusCode == 500 || statusCode == 502
                                                || statusCode == 503 || statusCode == 504;

                                if (isRetriable && attempts < maxAttempts) {
                                        long delayMs = calculateDelay(headers, currentBackoff);
                                        log.warn("Gemini returned HTTP {} ({}). Retrying attempt {}/{} in {} ms...",
                                                        statusCode, providerError, attempts, maxAttempts, delayMs);
                                        sleep(delayMs);
                                        currentBackoff = Math.min(currentBackoff * 2, 3000);
                                        continue;
                                }

                                if (statusCode == 429) {
                                        throw new GeminiRateLimitException(statusCode, providerError);
                                }
                                if (statusCode == 503 || statusCode == 500 || statusCode == 502 || statusCode == 504) {
                                        throw new GeminiServiceUnavailableException(statusCode, providerError);
                                }

                                throw new GeminiApiException(statusCode,
                                                "Gemini API error (HTTP " + statusCode + "): " + providerError);
                        } catch (GeminiAuthException | GeminiNotFoundException | GeminiBadRequestException
                                        | GeminiRateLimitException | GeminiServiceUnavailableException ex) {
                                throw ex;
                        } catch (Exception ex) {
                                // Network or connection errors
                                if (attempts < maxAttempts) {
                                        log.warn("Gemini connection error: {}. Retrying attempt {}/{} in {} ms...",
                                                        maskApiKey(ex.getMessage()), attempts, maxAttempts,
                                                        currentBackoff);
                                        sleep(currentBackoff);
                                        currentBackoff = Math.min(currentBackoff * 2, 3000);
                                        continue;
                                }
                                throw (ex instanceof GeminiApiException gae) ? gae
                                                : new GeminiApiException(500, ex.getMessage(), ex);
                        }
                }
        }

        private GeminiRawResponse executeHttpRequest(String url, Map<String, Object> requestBody) {
                return restClient.post()
                                .uri(url)
                                .header("x-goog-api-key", apiKey != null ? apiKey.trim() : "")
                                .contentType(MediaType.APPLICATION_JSON)
                                .accept(MediaType.APPLICATION_JSON, MediaType.APPLICATION_OCTET_STREAM, MediaType.ALL)
                                .body(requestBody)
                                .exchange((clientRequest, clientResponse) -> {
                                        int status = clientResponse.getStatusCode().value();
                                        HttpHeaders headers = clientResponse.getHeaders();
                                        byte[] bytes = clientResponse.getBody().readAllBytes();
                                        return new GeminiRawResponse(status, headers, bytes);
                                });
        }

        public String parseGeminiResponse(byte[] responseBytes, int statusCode) {
                if (responseBytes == null || responseBytes.length == 0) {
                        throw new GeminiApiException(statusCode, "The AI provider returned an empty response body.");
                }

                String jsonStr = new String(responseBytes, StandardCharsets.UTF_8).trim();
                if (jsonStr.isEmpty()) {
                        throw new GeminiApiException(statusCode, "The AI provider returned an empty response.");
                }

                JsonNode root;
                try {
                        root = mapper.readTree(jsonStr);
                } catch (JsonProcessingException e) {
                        throw new GeminiApiException(statusCode,
                                        "Malformed JSON received from AI provider: " + e.getMessage(), e);
                }

                if (root.has("error")) {
                        JsonNode errorNode = root.path("error");
                        String msg = errorNode.path("message").asText("Unknown provider error");
                        int code = errorNode.path("code").asInt(statusCode);
                        throw new GeminiApiException(code, msg);
                }

                JsonNode promptFeedback = root.path("promptFeedback");
                if (promptFeedback.has("blockReason") && !promptFeedback.path("blockReason").asText().isBlank()) {
                        String reason = promptFeedback.path("blockReason").asText();
                        throw new GeminiApiException(statusCode,
                                        "AI request was blocked by safety filters (blockReason: " + reason + ")");
                }

                JsonNode candidates = root.path("candidates");
                if (!candidates.isArray() || candidates.isEmpty()) {
                        throw new GeminiApiException(statusCode, "The AI provider returned no candidates in response.");
                }

                JsonNode firstCandidate = candidates.get(0);
                String finishReason = firstCandidate.path("finishReason").asText("");
                JsonNode parts = firstCandidate.path("content").path("parts");

                StringBuilder textBuilder = new StringBuilder();
                if (parts.isArray()) {
                        for (JsonNode part : parts) {
                                String partText = part.path("text").asText("");
                                if (!partText.isBlank()) {
                                        textBuilder.append(partText);
                                }
                        }
                }

                String text = textBuilder.toString().trim();
                if (text.isEmpty()) {
                        if (!finishReason.isBlank() && !"STOP".equalsIgnoreCase(finishReason)) {
                                throw new GeminiApiException(statusCode,
                                                "The AI provider returned empty text (finishReason: " + finishReason
                                                                + ").");
                        }
                        throw new GeminiApiException(statusCode, "The AI provider returned an empty response.");
                }

                return text;
        }

        private String extractProviderErrorMessage(byte[] bodyBytes, int statusCode) {
                if (bodyBytes == null || bodyBytes.length == 0) {
                        return "HTTP " + statusCode;
                }
                try {
                        String json = new String(bodyBytes, StandardCharsets.UTF_8).trim();
                        JsonNode root = mapper.readTree(json);
                        if (root.has("error") && root.path("error").has("message")) {
                                return root.path("error").path("message").asText();
                        }
                        return json.length() > 200 ? json.substring(0, 200) + "..." : json;
                } catch (Exception ignored) {
                        return "HTTP " + statusCode;
                }
        }

        public String normalizeModelName(String rawModel) {
                if (rawModel == null || rawModel.isBlank()) {
                        return "gemini-1.5-flash";
                }
                String trimmed = rawModel.trim();
                if (trimmed.startsWith("models/")) {
                        return trimmed.substring("models/".length()).trim();
                }
                return trimmed;
        }

        public String buildEndpointUrl(String cleanModel) {
                String base = apiUrl != null && !apiUrl.isBlank() ? apiUrl.trim()
                                : "https://generativelanguage.googleapis.com";
                if (base.endsWith("/"))
                        base = base.substring(0, base.length() - 1);
                String ver = apiVersion != null && !apiVersion.isBlank() ? apiVersion.trim() : "v1beta";
                ver = ver.replaceFirst("^/+", "").replaceFirst("/+$", "");
                return base + "/" + ver + "/models/" + cleanModel + ":generateContent";
        }

        private long calculateDelay(HttpHeaders headers, long defaultBackoff) {
                if (headers != null && headers.containsKey("Retry-After")) {
                        String retryAfter = headers.getFirst("Retry-After");
                        if (retryAfter != null && !retryAfter.isBlank()) {
                                try {
                                        long seconds = Long.parseLong(retryAfter.trim());
                                        // Clamp to maximum 3000ms so we do not delay UI excessively
                                        return Math.min(Math.max(seconds * 1000L, 500L), 3000L);
                                } catch (NumberFormatException ignored) {
                                }
                        }
                }
                return defaultBackoff;
        }

        private void sleep(long ms) {
                try {
                        Thread.sleep(ms);
                } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                }
        }

        private String maskApiKey(String text) {
                if (text == null)
                        return "Unknown error";
                if (apiKey != null && !apiKey.isBlank()) {
                        return text.replace(apiKey.trim(), "[REDACTED]");
                }
                return text;
        }

        public Map<String, Object> baseSummary(PostureSession s) {
                Map<String, Object> out = new LinkedHashMap<>();
                String risk = s.getTotalEvents() >= 8 || s.getLongestSustainedSeconds() >= 60 ? "High"
                                : s.getTotalEvents() >= 3 || s.getTotalAlerts() >= 2 ? "Moderate" : "Low";
                out.put("sessionId", s.getId());
                out.put("riskLevel", risk);
                out.put("durationMinutes", Math.round(s.getDurationSeconds() / 6.0) / 10.0);
                out.put("totalAlerts", s.getTotalAlerts());
                out.put("deviationEvents", s.getTotalEvents());
                out.put("longestSustainedSeconds", s.getLongestSustainedSeconds());
                out.put("summary", s.getTotalEvents() == 0
                                ? "No sustained posture-deviation events were recorded in this session."
                                : s.getTotalEvents()
                                                + " sustained deviation event(s) were recorded. Review the event history to identify repeated patterns.");
                out.put("recommendation", risk.equals("High")
                                ? "Consider a short movement break and adjust your workstation; review repeated events."
                                : risk.equals("Moderate")
                                                ? "Check your sitting position and take regular movement breaks."
                                                : "Continue monitoring and keep your workstation comfortable.");
                out.put("method", "Session-pattern summary; not a medical assessment.");
                return out;
        }

        public String buildPrompt(PostureSession s) {
                StringBuilder events = new StringBuilder();
                if (s.getEvents() != null) {
                        for (PostureEvent e : s.getEvents()) {
                                events.append("- measurement=").append(e.getMeasurement())
                                                .append(", type=").append(e.getEventType())
                                                .append(", peakDeviationDegrees=").append(e.getPeakDeviation())
                                                .append(", durationSeconds=").append(e.getDurationSeconds())
                                                .append("\n");
                        }
                }
                if (events.length() == 0)
                        events.append("No sustained deviation events recorded.\n");
                return "You are generating a short, cautious posture-session reflection for an educational posture-monitoring app. "
                                + "Use only the session data below. Do not diagnose or claim medical certainty. Do not invent data. "
                                + "Write 3 short sections: Observed pattern, Practical suggestions, Data limitation. Keep it under 160 words. "
                                + "Session duration seconds: " + s.getDurationSeconds() + "; alerts: "
                                + s.getTotalAlerts()
                                + "; deviation events: " + s.getTotalEvents()
                                + "; longest sustained deviation seconds: "
                                + s.getLongestSustainedSeconds() + "; events:\n" + events;
        }

        // Helper records and exception types
        public record GeminiRawResponse(int statusCode, HttpHeaders headers, byte[] bodyBytes) {
        }

        public static class GeminiApiException extends RuntimeException {
                private final int statusCode;

                public GeminiApiException(int statusCode, String message) {
                        super(message);
                        this.statusCode = statusCode;
                }

                public GeminiApiException(int statusCode, String message, Throwable cause) {
                        super(message, cause);
                        this.statusCode = statusCode;
                }

                public int getStatusCode() {
                        return statusCode;
                }
        }

        public static class GeminiAuthException extends GeminiApiException {
                public GeminiAuthException(int statusCode, String message) {
                        super(statusCode, message);
                }
        }

        public static class GeminiNotFoundException extends GeminiApiException {
                public GeminiNotFoundException(int statusCode, String message) {
                        super(statusCode, message);
                }
        }

        public static class GeminiBadRequestException extends GeminiApiException {
                public GeminiBadRequestException(int statusCode, String message) {
                        super(statusCode, message);
                }
        }

        public static class GeminiRateLimitException extends GeminiApiException {
                public GeminiRateLimitException(int statusCode, String message) {
                        super(statusCode, message);
                }
        }

        public static class GeminiServiceUnavailableException extends GeminiApiException {
                public GeminiServiceUnavailableException(int statusCode, String message) {
                        super(statusCode, message);
                }
        }
}
