package com.posturemonitor.service;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.posturemonitor.model.PostureEvent;
import com.posturemonitor.model.PostureSession;
import java.time.Duration;
import java.util.LinkedHashMap;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.MediaType;
import org.springframework.http.client.SimpleClientHttpRequestFactory;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class InsightService {
    private static final Logger log = LoggerFactory.getLogger(InsightService.class);

    private final RestClient restClient;
    private final ObjectMapper mapper = new ObjectMapper();

    @Value("${gemini.api-key:${GEMINI_API_KEY:}}")
    private String apiKey;

    @Value("${gemini.model:${GEMINI_MODEL:gemini-1.5-flash}}")
    private String model;

    public InsightService() {
        SimpleClientHttpRequestFactory factory = new SimpleClientHttpRequestFactory();
        factory.setConnectTimeout(Duration.ofSeconds(5));
        factory.setReadTimeout(Duration.ofSeconds(15));
        this.restClient = RestClient.builder().requestFactory(factory).build();
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

        try {
            log.info("Requesting Gemini insights for session {} using model {}", session.getId(), model);
            String prompt = buildPrompt(session);
            Map<String, Object> request = Map.of(
                    "contents", new Object[] { Map.of("parts", new Object[] { Map.of("text", prompt) }) },
                    "generationConfig", Map.of("temperature", 0.3, "maxOutputTokens", 500));
            String url = "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent";
            String response = restClient.post()
                    .uri(url)
                    .header("x-goog-api-key", apiKey)
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(request)
                    .retrieve()
                    .body(String.class);

            JsonNode root = mapper.readTree(response);
            String text = root.path("candidates").path(0).path("content").path("parts").path(0).path("text").asText("")
                    .trim();
            if (text.isBlank())
                throw new IllegalStateException("The AI provider returned an empty response.");

            out.put("summary", text);
            out.put("provider", "Google Gemini (" + model + ")");
            out.put("aiConfigured", true);
            out.put("note",
                    "AI-generated reflection based only on this session's recorded metrics; not a medical assessment.");
            log.info("Successfully generated Gemini insights for session {}", session.getId());
        } catch (Exception ex) {
            log.warn("Gemini request failed for session {}: {}. Falling back to rule-based summary.", session.getId(),
                    ex.getMessage());
            out.put("provider", "rule-based fallback");
            out.put("aiConfigured", true);
            out.put("note", "Gemini could not generate insights right now (" + ex.getClass().getSimpleName()
                    + "). A rule-based summary is shown instead.");
        }
        return out;
    }

    private Map<String, Object> baseSummary(PostureSession s) {
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
                : risk.equals("Moderate") ? "Check your sitting position and take regular movement breaks."
                        : "Continue monitoring and keep your workstation comfortable.");
        out.put("method", "Session-pattern summary; not a medical assessment.");
        return out;
    }

    private String buildPrompt(PostureSession s) {
        StringBuilder events = new StringBuilder();
        for (PostureEvent e : s.getEvents()) {
            events.append("- measurement=").append(e.getMeasurement())
                    .append(", type=").append(e.getEventType())
                    .append(", peakDeviationDegrees=").append(e.getPeakDeviation())
                    .append(", durationSeconds=").append(e.getDurationSeconds()).append("\n");
        }
        if (events.length() == 0)
            events.append("No sustained deviation events recorded.\n");
        return "You are generating a short, cautious posture-session reflection for an educational posture-monitoring app. "
                +
                "Use only the session data below. Do not diagnose or claim medical certainty. Do not invent data. " +
                "Write 3 short sections: Observed pattern, Practical suggestions, Data limitation. Keep it under 160 words. "
                +
                "Session duration seconds: " + s.getDurationSeconds() + "; alerts: " + s.getTotalAlerts() +
                "; deviation events: " + s.getTotalEvents() + "; longest sustained deviation seconds: " +
                s.getLongestSustainedSeconds() + "; events:\n" + events;
    }
}
