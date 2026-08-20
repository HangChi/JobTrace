# JobTrace 架构

JobTrace 是 Next.js App Router + TypeScript + PostgreSQL 的模块化单体。SQL 迁移保存在 `supabase/migrations`（沿用规格目录），运行时通过仅服务端 PostgreSQL 驱动访问。

多用户隔离由服务端 actor 与每条查询/原子写函数中的 `owner_id` 谓词共同保证；PostgreSQL 连接不依赖 Supabase JWT/RLS。`applications.owner_id` 与 `import_batches.owner_id` 均为必填外键，跨 owner UUID 统一表现为未找到。

- `src/app`：页面、Server Components 与 HTTP Route Handlers。
- `src/modules/applications`：投递聚合、查询、仓储与界面。
- `src/modules/analytics`：只读统计与跟进提醒。
- `src/modules/data-transfer`：CSV/XLSX 预检和导出。
- `src/modules/identity-access`：Better Auth 会话、角色授权、账号管理与个人资料。
- `src/modules/interviews`：Markdown 面经、阶段关联、自动保存和搜索筛选。
- `src/shared`：日期、游标、错误、日志、数据库客户端和 UI 原语。

依赖方向为 `app/UI → application → domain`。跨模块业务调用通过各模块的 `index.ts` 公开接口协作；页面组合组件可以引用模块公开 UI。写操作通过 PostgreSQL 函数原子写入投递与历史事件；浏览器不接触数据库凭据。

首页由 Server Component 提供首屏列表和统计，再交给客户端 `ApplicationDashboard` 维护局部快照。新增和编辑使用同源 Route Handler 返回的权威记录直接更新列表；状态切换使用专用 `PATCH /api/applications/{id}/status`，只提交 `status` 与乐观锁 `version`，服务器负责生成业务日期。界面确认成功后立即结束保存状态，再以无全局 loading 的后台请求并行对账列表和统计。

分析摘要的总量、阶段分布、进展提醒和待跟进查询并行发送到 PostgreSQL。写入函数仍负责快照、版本和历史事件的原子一致性；局部 UI 更新不是数据库一致性的替代品，409 冲突会回滚乐观状态并提示用户。

业务日期以 `Asia/Shanghai` 自然日解释。投递状态和阶段在数据库中保存稳定英文代码，中文只作为展示标签。

面经通过 `application_stage_occurrences.id` 关联一次具体招聘阶段；同一阶段类型可在不同日期重复发生，但每个 occurrence 最多关联一篇面经。修改阶段保留 occurrence ID 并记录 `stage_changed` 事件；删除阶段通过 `ON DELETE SET NULL` 解除关联，面经保留阶段和日期快照；删除投递则级联删除面经、问题与行动项。

面经编辑器向用户提供一个 Markdown 文档编辑框和预览视图，并以约 800ms 防抖向同源 Route Handler 提交完整聚合。为兼容旧数据，历史问题、反思和行动项会在读取时组合成 Markdown，只有用户编辑后才收敛为单一文档记录。数据库函数在事务内替换内容并递增 `version`；旧版本写入返回 409，浏览器停止自动保存，避免覆盖其他标签页的更新。页面隐藏或离开时使用 keepalive 请求尽力 flush 最近编辑。

面经内容默认私密。列表、详情、搜索、创建、更新与删除均在应用服务取得 actor，并在仓储查询或数据库函数中带 `owner_id`；跨 owner UUID 统一表现为未找到。日志只允许记录 request ID、错误代码、操作和耗时，不得记录问题、回答、反思、行动项、Session、Cookie 或认证 token。

投递状态固定为 `submitted`（已投递）、`offer`（Offer）和 `refused`（拒绝）；Offer 与拒绝为终态。只有已投递记录会在投递内容或招聘时间线连续 15 个完整日未更新时进入跟进提醒。
