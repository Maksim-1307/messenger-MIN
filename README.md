
# Messenger MIN — open-source Messenger with AI-features

### Overview
**MIN** is a lightweight messenger with AI features which you can deploy on your own server to keep your data safe and private. It's a great alternative for users who value privacy and freedom. This messenger is especially relevant in conditions of lockdowns and massive data leaks.

### Architecture
* **Backend:** Node.js (Express) with Socket.io for real-time communication.
* **Database:** PostgreSQL (Messages & Users) + Redis (Online status & Caching).
* **Client:** React SPA (Next.js) — A web interface for the messenger. (If I will have time, I will add a mobile app on React Native for iOS/Android.)
* **AI Engine:** Some free and stable API like OpenRouter.
* **Infrastructure:** Fully containerized with Docker, deployed on a private VM.

### Stack
* **Language:** TypeScript (Full-stack)
* **Frontend:** React (Next.js), scss modules, TailwindCSS, react-router-dom.
* **Backend:** Node.js (Express), Socket.io, PostgreSQL, Redis, NGinx.
* **API Documentation:** Swagger UI (`/api/docs`)
* **DB Management:** TablePlus 

### Roadmap
- [x] **Step 1:** Write multi-staged Dockerfiles, setup docker network and services: PostgreSQL, Redis, NGinx, TablePlus.
- [x] **Step 2:** Implement Authorization by JWT.
- [ ] **Step 3:** Implement main HTTP endpoints.
- [x] **Step 4:** Implement user interface.
- [ ] **Step 5:** Implement WebSockets for real-time communication.
- [ ] **Step 6:** Integrate LLM Agent for "Context Summary" and "translation" features.
- [ ] **Step 4:** Deploy to University VM.
