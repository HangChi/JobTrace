# JobTrace 架构

JobTrace 是 Next.js App Router + TypeScript + PostgreSQL 的模块化单体。SQL 迁移保存在 `supabase/migrations`（沿用规格目录），运行时通过仅服务端 PostgreSQL 驱动访问。

- `src/app`：页面、Server Components 与 HTTP Route Handlers。
- `src/modules/applications`：投递聚合、查询、仓储与界面。
- `src/modules/analytics`：只读统计与跟进提醒。
- `src/modules/data-transfer`：CSV/XLSX 预检和导出。
- `src/shared`：日期、游标、错误、日志、数据库客户端和 UI 原语。

依赖方向为 `app → application → domain`。模块间只允许通过各模块的 `index.ts` 公开接口协作。写操作通过 PostgreSQL 函数原子写入投递与历史事件；浏览器不接触服务角色密钥。

业务日期以 `Asia/Shanghai` 自然日解释。投递状态和阶段在数据库中保存稳定英文代码，中文只作为展示标签。

投递状态固定为 `submitted`（已投递）、`offer`（Offer）和 `refused`（拒绝）；Offer 与拒绝为终态。只有已投递记录会在投递内容或招聘时间线连续 15 个完整日未更新时进入跟进提醒。
