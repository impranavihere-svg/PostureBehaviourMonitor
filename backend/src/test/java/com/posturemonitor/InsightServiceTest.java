package com.posturemonitor;

import com.posturemonitor.model.PostureEvent;
import com.posturemonitor.model.PostureSession;
import com.posturemonitor.service.InsightService;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.time.Instant;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

public class InsightServiceTest {

    private final InsightService insightService = new InsightService();

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
}
