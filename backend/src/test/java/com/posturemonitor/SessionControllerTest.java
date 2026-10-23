package com.posturemonitor;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.posturemonitor.dto.SessionRequest;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.util.List;

import static org.hamcrest.Matchers.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@SpringBootTest
@AutoConfigureMockMvc
public class SessionControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Test
    @DisplayName("GET /api/health returns status ok")
    void testHealthEndpoint() throws Exception {
        mockMvc.perform(get("/api/health"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.status").value("ok"))
                .andExpect(jsonPath("$.service").value("Posture Behaviour Monitor API"));
    }

    @Test
    @DisplayName("POST /api/sessions persists session and events, GET /api/sessions retrieves them")
    void testCreateAndRetrieveSession() throws Exception {
        SessionRequest.EventRequest event = new SessionRequest.EventRequest(
                "Head / Neck Angle",
                "Sustained Deviation",
                14.2,
                12,
                5.0,
                "10:02:13 PM"
        );

        SessionRequest request = new SessionRequest(
                "2026-10-23T18:00:00Z",
                "2026-10-23T18:10:00Z",
                600,
                2,
                1,
                12.5,
                List.of(event)
        );

        String json = objectMapper.writeValueAsString(request);

        String response = mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(json))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.id").isNumber())
                .andExpect(jsonPath("$.durationSeconds").value(600))
                .andExpect(jsonPath("$.totalAlerts").value(2))
                .andExpect(jsonPath("$.totalEvents").value(1))
                .andExpect(jsonPath("$.events", hasSize(1)))
                .andExpect(jsonPath("$.events[0].measurement").value("Head / Neck Angle"))
                .andReturn().getResponse().getContentAsString();

        Number id = com.jayway.jsonpath.JsonPath.read(response, "$.id");

        // Verify retrieval by ID
        mockMvc.perform(get("/api/sessions/" + id))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value(id))
                .andExpect(jsonPath("$.events", hasSize(1)));

        // Verify insights endpoint works for this session
        mockMvc.perform(get("/api/sessions/" + id + "/insights"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.sessionId").value(id))
                .andExpect(jsonPath("$.riskLevel").isNotEmpty())
                .andExpect(jsonPath("$.summary").isNotEmpty())
                .andExpect(jsonPath("$.provider").isNotEmpty());
    }

    @Test
    @DisplayName("POST /api/sessions with invalid timestamp returns 400 Bad Request")
    void testInvalidTimestampReturns400() throws Exception {
        String invalidJson = """
            {
                "startedAt": "not-a-date",
                "endedAt": "also-not-a-date",
                "durationSeconds": 100,
                "totalAlerts": 0,
                "totalEvents": 0,
                "longestSustainedSeconds": 0
            }
        """;

        mockMvc.perform(post("/api/sessions")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(invalidJson))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("GET /api/sessions/999999 returns 404 Not Found")
    void testNonExistentSessionReturns404() throws Exception {
        mockMvc.perform(get("/api/sessions/999999"))
                .andExpect(status().isNotFound());
    }
}
