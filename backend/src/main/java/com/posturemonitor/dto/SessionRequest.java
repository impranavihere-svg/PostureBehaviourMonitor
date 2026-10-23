package com.posturemonitor.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import java.util.List;

public record SessionRequest(@NotNull String startedAt, @NotNull String endedAt,
    @Min(0) long durationSeconds, @Min(0) int totalAlerts, @Min(0) int totalEvents,
    @Min(0) double longestSustainedSeconds, @Valid List<EventRequest> events) {
  public record EventRequest(String measurement, String type, double peakDeviation,
      long durationSeconds, Double baselineValue, String time) {}
}
