### 1. Project Idea: **Messenger MIN**
* **End-user:** All convenient messengers are blocked and work only with VPN. Moreover, you data may not be safe on the server you don't own.
* **Problem solved:** This messenger is a lightweight open-source alternative which you can deploy on your own server to keep your data safe and private.
* **One-sentence pitch:** A lightweight, open-source messenger with an AI agent that summarizes unread chats and highlights urgent tasks.
* **Core Feature:** **AI-Agent Summarization.**

### 2. Implementation Plan

- [ ] **Step 1:** Write multi-staged Dockerfiles, setup docker network and services: PostgreSQL, Redis, NGinx, TablePlus.
- [ ] **Step 2:** Implement Authorization by JWT.
- [ ] **Step 3:** Implement main HTTP endpoints.
- [ ] **Step 4:** Implement user interface.
- [ ] **Step 5:** Implement WebSockets for real-time communication.
- [ ] **Step 6:** Integrate LLM Agent for "Context Summary" and "translation" features.
- [ ] **Step 4:** Deploy to University VM.