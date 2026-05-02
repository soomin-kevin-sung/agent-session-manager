# Plan 3: Frontend — Discord 스타일 메신저 UI

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Discord 스타일의 메신저 UI를 React + TypeScript로 구현. 워크스페이스/채널/메시지 목록, 에이전트 상태 표시, CLI 로그 접이식 표시, 터미널 패널을 갖춘 데스크톱 앱 프론트엔드.

**Architecture:** Zustand 스토어가 상태를 관리하고, Tauri IPC로 백엔드와 통신. shadcn/ui 컴포넌트 기반. 4-패널 레이아웃 (워크스페이스 사이드바 / 채널 사이드바 / 채팅 영역 / 멤버 패널).

**Tech Stack:** React 19, TypeScript, Tailwind CSS 4, shadcn/ui, Zustand, react-i18next

**Depends on:** Plan 1 (DB + IPC commands), Plan 2 (runtime events)

---

## Tasks

### Task 1: shadcn/ui 추가 컴포넌트 설치 + i18n 설정
### Task 2: Zustand 스토어 (workspace, channel, message, agent, ui)
### Task 3: AppLayout — 4-패널 레이아웃 셸
### Task 4: WorkspaceSidebar — 워크스페이스 아이콘 목록
### Task 5: ChannelSidebar — 채널/DM 목록 + 에이전트 상태
### Task 6: ChatArea — MessageList + MessageInput + ChannelHeader
### Task 7: MemberPanel — 에이전트 정보 + 멤버 목록
### Task 8: AgentCreationModal — 에이전트 생성 폼
### Task 9: Tauri 이벤트 연결 + 실시간 메시지 업데이트
