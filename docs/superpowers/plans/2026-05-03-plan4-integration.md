# Plan 4: Integration — 오케스트레이션 + 권한 + 연결

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 백엔드와 프론트엔드를 완전히 연결하고, 에이전트 간 오케스트레이션 (작업 지시, 보고, 리뷰), 권한 검증, 세션 관리, 첫 실행 경험을 구현하여 실제 동작하는 앱을 완성한다.

**Architecture:** orchestrator/ 모듈이 에이전트 간 메시지 라우팅과 생명주기를 관리. security/ 모듈이 권한 검증. 프론트엔드가 Tauri commands로 모든 백엔드 기능을 호출.

**Depends on:** Plan 1 (DB), Plan 2 (Runtime), Plan 3 (Frontend)

---

## Tasks

### Task 1: Session commands + 프론트엔드 연결
### Task 2: Permission engine (권한 검증)
### Task 3: Orchestrator — 에이전트 간 메시지 라우팅
### Task 4: 첫 실행 경험 (워크스페이스 자동 생성 + 온보딩)
### Task 5: 전체 통합 테스트 + 앱 실행 확인
