package com.posturemonitor.controller;

import com.posturemonitor.dto.SessionRequest;
import com.posturemonitor.model.PostureEvent;
import com.posturemonitor.model.PostureSession;
import com.posturemonitor.repository.PostureSessionRepository;
import com.posturemonitor.service.InsightService;
import jakarta.validation.Valid;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.server.ResponseStatusException;

@RestController
@RequestMapping("/api")
public class SessionController {
    private static final Logger log = LoggerFactory.getLogger(SessionController.class);

    private final PostureSessionRepository repository;
    private final InsightService insights;
    public SessionController(PostureSessionRepository repository, InsightService insights) { this.repository=repository; this.insights=insights; }

    @GetMapping("/health") public Map<String,String> health(){ return Map.of("status","ok","service","Posture Behaviour Monitor API"); }

    @PostMapping("/sessions") @ResponseStatus(HttpStatus.CREATED)
    public PostureSession create(@Valid @RequestBody SessionRequest request) {
        PostureSession s = new PostureSession();
        try { s.setStartedAt(Instant.parse(request.startedAt())); s.setEndedAt(Instant.parse(request.endedAt())); }
        catch (Exception ex) { throw new ResponseStatusException(HttpStatus.BAD_REQUEST,"startedAt and endedAt must be ISO-8601 timestamps"); }
        s.setDurationSeconds(request.durationSeconds()); s.setTotalAlerts(request.totalAlerts());
        s.setTotalEvents(request.totalEvents()); s.setLongestSustainedSeconds(request.longestSustainedSeconds());
        if (request.events()!=null) for (SessionRequest.EventRequest item : request.events()) {
            PostureEvent e = new PostureEvent(); e.setMeasurement(item.measurement()); e.setEventType(item.type());
            e.setPeakDeviation(item.peakDeviation()); e.setDurationSeconds(item.durationSeconds());
            e.setBaselineValue(item.baselineValue()); e.setOccurredAt(item.time()); s.addEvent(e);
        }
        return repository.save(s);
    }
    @GetMapping("/sessions") public List<PostureSession> history(){ return repository.findAll(org.springframework.data.domain.Sort.by(org.springframework.data.domain.Sort.Direction.DESC,"startedAt")); }
    @GetMapping("/sessions/{id}") public PostureSession get(@PathVariable Long id){ return repository.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Session not found")); }
    @GetMapping("/sessions/{id}/insights") public Map<String,Object> getInsights(@PathVariable Long id){ return insights.summarize(repository.findById(id).orElseThrow(()->new ResponseStatusException(HttpStatus.NOT_FOUND,"Session not found"))); }
}
