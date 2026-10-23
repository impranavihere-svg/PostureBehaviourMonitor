package com.posturemonitor.repository;
import com.posturemonitor.model.PostureSession;
import org.springframework.data.jpa.repository.JpaRepository;
public interface PostureSessionRepository extends JpaRepository<PostureSession, Long> {}
