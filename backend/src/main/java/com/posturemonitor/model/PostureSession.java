package com.posturemonitor.model;

import jakarta.persistence.*;
import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "posture_sessions")
public class PostureSession {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private Instant startedAt;
    private Instant endedAt;
    private long durationSeconds;
    private int totalAlerts;
    private int totalEvents;
    private double longestSustainedSeconds;
    @OneToMany(mappedBy = "session", cascade = CascadeType.ALL, orphanRemoval = true, fetch = FetchType.EAGER)
    private List<PostureEvent> events = new ArrayList<>();

    public Long getId(){return id;} public Instant getStartedAt(){return startedAt;} public void setStartedAt(Instant v){startedAt=v;}
    public Instant getEndedAt(){return endedAt;} public void setEndedAt(Instant v){endedAt=v;}
    public long getDurationSeconds(){return durationSeconds;} public void setDurationSeconds(long v){durationSeconds=v;}
    public int getTotalAlerts(){return totalAlerts;} public void setTotalAlerts(int v){totalAlerts=v;}
    public int getTotalEvents(){return totalEvents;} public void setTotalEvents(int v){totalEvents=v;}
    public double getLongestSustainedSeconds(){return longestSustainedSeconds;} public void setLongestSustainedSeconds(double v){longestSustainedSeconds=v;}
    public List<PostureEvent> getEvents(){return events;} public void addEvent(PostureEvent e){events.add(e);e.setSession(this);}
}
