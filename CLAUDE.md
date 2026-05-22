# Eureka 3.0 — Claude 工作规范

## 核心开发偏好

### ① Spec 优先原则
**在实现任何功能之前，必须先更新对应的 spec / docs，再开始写代码。**

- 功能设计变动 → 先更新 `docs/` 下对应文档
- 数据模型变动 → 先更新 `docs/pipeline-architecture.md` §二
- UI/交互变动 → 先更新 `docs/SPEC.md` 或 `docs/app-design.md`
- 确认文档与实现一致后，再 commit

---

## 项目结构说明

```
docs/
  pipeline-architecture.md   ← 后端 Pipeline、数据模型、Agent 设计权威文档
  SPEC.md                    ← 前端功能 spec
  app-design.md              ← UI/交互设计规范

Eureka-BrandNew/
  backend/                   ← FastAPI + Google ADK
  frontend-next/             ← Next.js App
```
