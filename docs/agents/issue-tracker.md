# Issue tracker: speckit（specs/ 目录）

本仓库的需求与任务通过 speckit 工作流管理，落在 `specs/` 目录。不使用 GitHub Issues 等外部追踪器。

## Conventions

- 一个功能一个目录：`specs/<NNN>-<slug>/`，编号三位递增（现有 001–005，下一个是 006）
- 需求规格：`spec.md`（用户故事、功能需求、边界）；技术方案：`plan.md`；研究记录：`research.md`；数据模型：`data-model.md`；任务清单：`tasks.md`（按用户故事分组、依赖排序、含仓库路径）
- 全局工程原则（宪法）：`.specify/memory/constitution.md`，由 `/speckit-constitution` 维护
- 新功能：`/speckit-specify <描述>` 创建 spec 目录，再经 `/speckit-plan`、`/speckit-tasks` 产出方案与任务，`/speckit-implement` 执行

## When a skill says "publish to the issue tracker"

按 speckit 流程落盘：新功能用 `/speckit-specify` 创建 `specs/<NNN>-<slug>/`；向现有功能追加工作则编辑对应的 `tasks.md`，保持任务编号与依赖顺序。

## When a skill says "fetch the relevant ticket"

读取对应功能的 `specs/<NNN>-<slug>/spec.md`（需求来源）与 `tasks.md`（任务与验收状态）。用户给出功能名或路径时按目录名匹配；上下文引用了功能编号时按编号匹配。
