# Research: 个人面经与面经广场

## Decision 1: 同表状态而非公开副本

- **Decision**: 在 `interview_reviews` 上保存分享状态和发布时间，不复制面经正文。
- **Rationale**: 发布、下架、删除和内容更新保持单一事实来源，避免公开副本过期或级联遗漏。
- **Alternatives considered**: 独立 publication 表或复制公开快照；二者增加同步、删除和回滚复杂度，本期没有版本化发布需求。

## Decision 2: 独立公开 DTO 与查询入口

- **Decision**: 新增公开 repository/service/types，SQL 只选择允许公开的列；不复用 owner detail 后删字段。
- **Rationale**: 本地 Next.js 数据安全指南要求 DAL 返回最小安全 DTO，编译期类型边界比运行时删字段更可靠。
- **Alternatives considered**: 复用 `InterviewDetail` 并 omit；字段新增时容易默认泄漏，因此拒绝。

## Decision 3: 公开状态机

- **Decision**: private 为默认；仅 completed 可 public；离开 completed 自动变 private；重新发布刷新 publishedAt，匿名/署名切换不刷新。
- **Rationale**: 防止未完成内容意外公开，并让发布时间表示本轮发布行为而非普通编辑。
- **Alternatives considered**: 允许草稿公开或发布状态完全独立；均增加不完整内容和组合状态风险。

## Decision 4: 路由分层

- **Decision**: `/interviews` 是广场，`/interviews/mine` 是个人列表，`/interviews/[id]` 保持 owner 编辑，`/interviews/shared/[id]` 是公开只读详情。
- **Rationale**: 保持现有编辑深链兼容，并避免同一路由根据查看者身份返回两种数据形状。
- **Alternatives considered**: 通用详情路由；会增加授权分支和误传完整 DTO 的风险。

## Decision 5: 发布交互

- **Decision**: 在长表单编辑器加入独立“分享设置”分区，使用可见标签的单选/选择控件、公开范围说明和 autosave 状态反馈。
- **Rationale**: 复用现有自动保存与版本冲突机制，同时通过渐进披露降低误操作。
- **Alternatives considered**: 列表快捷开关；缺少上下文和公开范围确认，误发布风险更高。

## Decision 6: Next.js 数据读取

- **Decision**: 广场和详情页面使用 async Server Components 直接调用应用服务，API Route Handlers作为显式 HTTP 契约且默认动态执行。
- **Rationale**: 与当前仓库一致，减少客户端 JavaScript；本地 Next.js 16 文档确认数据库和会话读取适合 Server Components，Route Handlers 默认不缓存动态请求。
- **Alternatives considered**: 客户端 `useEffect` 拉取；增加加载瀑布与泄漏面，拒绝。
