package com.posturemonitor.model;

import jakarta.persistence.*;
import com.fasterxml.jackson.annotation.JsonIgnore;

@Entity
@Table(name = "posture_events")
public class PostureEvent {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    private String measurement;
    private String eventType;
    private double peakDeviation;
    private long durationSeconds;
    private Double baselineValue;
    private String occurredAt;
    @JsonIgnore
    @ManyToOne(fetch = FetchType.LAZY) @JoinColumn(name = "session_id") private PostureSession session;
    public Long getId(){return id;} public String getMeasurement(){return measurement;} public void setMeasurement(String v){measurement=v;}
    public String getEventType(){return eventType;} public void setEventType(String v){eventType=v;}
    public double getPeakDeviation(){return peakDeviation;} public void setPeakDeviation(double v){peakDeviation=v;}
    public long getDurationSeconds(){return durationSeconds;} public void setDurationSeconds(long v){durationSeconds=v;}
    public Double getBaselineValue(){return baselineValue;} public void setBaselineValue(Double v){baselineValue=v;}
    public String getOccurredAt(){return occurredAt;} public void setOccurredAt(String v){occurredAt=v;}
    public PostureSession getSession(){return session;} public void setSession(PostureSession v){session=v;}
}
