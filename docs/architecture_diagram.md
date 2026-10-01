# ResidentGPT v0.3 — Architecture Diagram

> **LEGACY — không phải kiến trúc active.** Tài liệu này mô tả ResidentGPT (FAQ/RAG) trước MaintenanceOps MVP v0.3. Kiến trúc active nằm ở `docs/03_lean_prd.md`, `docs/data-contract-v1.md` và `src/maintenance/`. CSKH chỉ thuộc Deferred/Future Scope.

## System Overview

```mermaid
flowchart TB
    RES[Resident] --> WEB[Cloud Web App / Live URL]
    BQL[BQL / CSKH] --> WEB
    WEB --> AUTH[Authentication + RBAC]
    AUTH -->|resident| CHAT[Resident Chat View]
    AUTH -->|management| INBOX[BQL Escalation Inbox]

    CHAT --> API[Backend API]
    INBOX --> API
    API --> MEM[(Conversation Memory)]
    API --> GRAPH[ResidentGPT Agent Graph]
    GRAPH --> REWRITE[Query Rewriter]
    REWRITE --> RISK[High-risk / Required-context Gate]
    RISK --> RETRIEVE[RAG Retrieval]
    RETRIEVE --> VECTOR[(Vector Index: Knowledge Pack 1.18)]
    RETRIEVE --> CONF[Similarity + Grader Node]
    CONF -->|High confidence| ANSWER[Grounded Answer + Citations]
    CONF -->|Low confidence / High risk| ESC[Escalation Service]
    ESC --> TICKETS[(Escalation Tickets)]
    TICKETS --> INBOX
    ANSWER --> CHAT
```

## Decision Flow

```mermaid
flowchart LR
    Q[Resident query + scoped memory] --> RW[Rewrite standalone query]
    RW --> HR{High risk?}
    HR -- Yes --> E[Escalation Card + BQL ticket]
    HR -- No --> RC{Required context complete?}
    RC -- No --> C[Clarification Card]
    C --> Q
    RC -- Yes --> R[RAG over 21 canonical docs]
    R --> G{Eligible evidence and confidence high?}
    G -- Yes --> A[Answered + document_id + section_id]
    G -- No --> E
```

## Component Responsibilities

- **Cloud Web App:** dual-role UI, error boundary, responsive rendering and Live URL.
- **Authentication + RBAC:** server-side role enforcement for `resident` and `management`.
- **Conversation Memory:** isolated multi-turn history by user/conversation.
- **Query Rewriter:** converts follow-up turns into standalone retrieval queries without inventing facts.
- **RAG Retrieval:** searches only the 21 canonical documents in Knowledge Pack `1.18` and returns document/section identifiers.
- **Risk & Confidence Gate:** combines high-risk policy, source eligibility, similarity score and Grader Node.
- **Escalation Service:** shows the Resident handoff card and atomically creates the BQL Inbox ticket.
- **Persistence/Audit:** stores conversations, citations, decisions, terminal state, reason code and management response.

## Deployment Boundary

The web/API stack must be containerizable and expose a health endpoint. A release is not considered BTC-ready until the deployment artifact records the public Live URL, build/commit, deployment timestamp and smoke-test result. Booking, payment and upsell are not architecture components in MVP v0.3.
