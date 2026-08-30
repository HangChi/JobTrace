# Phase 0 Research: 自动招聘岗位市场

## 1. 模块与部署边界

**Decision**: 在现有 Next.js 单体中新增独立 `job-market` 领域模块，公共岗位与现有 `applications` 私人投递通过显式关联表连接，不创建新服务。

**Rationale**: 当前仓库已经按 application/domain/infrastructure/ui 分层，沿用边界可以复用鉴权、错误响应、数据库和日志设施。同步量在首期规模内可由同一部署的受保护 Route Handler 完成，同时数据库租约解决多实例竞争。

**Alternatives considered**: 独立采集微服务和消息队列具备更强吞吐，但引入部署、鉴权、可观测性与失败恢复成本，首期 100 个来源没有必要；把逻辑直接写进页面/Route Handler 会破坏可测试性和单一职责。

## 2. 合规来源范围

**Decision**: 首期支持 Greenhouse、Lever、Ashby、SmartRecruiters 的公开岗位接口，以及管理员显式批准域名上的 Schema.org `JobPosting`。只同步公开或已有授权的数据。

**Rationale**: 这些 ATS 提供稳定、结构化的公开职位数据和原始申请 URL，能在不绕过访问控制的前提下覆盖多家公司。Schema.org 是企业官网常见的标准化后备入口，但必须逐域批准，不能演变为任意站点爬虫。

**Alternatives considered**: Moka 等租户接口通常需要企业授权凭据；第三方招聘聚合站的登录接口或数据库不构成可复用授权；搜索引擎抓取和浏览器自动化容易违反站点规则且结构不稳定，均不纳入默认来源。

**Primary references**:

- [Greenhouse Job Board API](https://docs.greenhouse.io/job-board.html)
- [Lever Postings API](https://github.com/lever/postings-api)
- [Ashby Public Job Posting API](https://developers.ashbyhq.com/docs/public-job-posting-api)
- [SmartRecruiters API endpoints](https://developers.smartrecruiters.com/docs/endpoints)
- [Google JobPosting structured data](https://developers.google.com/search/docs/appearance/structured-data/job-posting)

## 3. 调度与多实例一致性

**Decision**: 使用部署平台的外部 cron 每 5 分钟调用内部同步接口；由 PostgreSQL `FOR UPDATE SKIP LOCKED`、租约时间和 `next_sync_at` 原子认领到期来源。正常来源间隔 6 小时，失败使用带抖动的指数退避。

**Rationale**: Next.js 进程可重启、扩缩容且可能多实例，进程内 cron 不能保证唯一执行。Next.js `after()` 仍受请求最大时长限制，适合响应后的短副作用而非持久后台任务。外部触发加数据库租约不需要新队列即可满足 12 小时新鲜度目标。

**Alternatives considered**: `node-cron` 在每个实例重复执行且重启丢计划；`after()` 不提供持久重试；立即引入队列增加基础设施。若未来单轮规模超过平台时限，可保持同一应用端口并把执行器替换为队列 worker。

## 4. 外部请求与 SSRF 防护

**Decision**: 每个来源保存精确允许主机，使用专用安全 HTTP 客户端：仅 HTTPS、禁止 userinfo、DNS A/AAAA 解析后拒绝私网/回环/链路本地/保留地址、最多 3 次手动重定向且逐跳复验、10–15 秒超时、5MB 响应上限、内容类型白名单、无 Cookie、尊重 429/`Retry-After`。

**Rationale**: 来源 URL 是管理员可配置输入，后台抓取天然具有 SSRF 风险；只检查字符串或首个 URL 无法防御 DNS 和重定向绕过。限制响应大小和任务并发同时保护内存、连接池和上游站点。

**Alternatives considered**: 允许任意 URL 后使用阻止名单容易漏掉地址编码和重绑定；浏览器抓取扩大攻击面；通过公共代理会增加新的敏感边界。

**Primary reference**: [OWASP SSRF Prevention Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

## 5. HTML 解析依赖

**Decision**: 新增 Cheerio 1.x，仅在 `schema_org` 适配器中提取 `script[type="application/ld+json"]` 和生成安全纯文本摘要；不执行脚本，不将来源 HTML 原样渲染。

**Rationale**: Node 服务端没有适用于该需求的原生 DOM API，使用正则处理 HTML/script 边界不可靠。Cheerio 是单一、成熟的解析依赖，其使用范围和输入上限明确。

**Alternatives considered**: 正则解析被拒绝；JSDOM 依赖面和运行开销更大；删除 JSON-LD 后备会显著降低企业官网覆盖率。

## 6. 规范化、去重与主记录

**Decision**: 分三层匹配：先按 `(source_id, external_job_id)`，再按同企业的规范 HTTPS 详情/投递 URL，最后仅对“公司 + 批次 + 规范标题 + 排序后地点”完全一致的指纹建立重复候选。跨企业或模糊相似项不自动合并；官方来源优先成为主记录。

**Rationale**: 稳定来源身份最可靠，URL 可处理来源 ID 变化，保守指纹覆盖无 ID 来源又避免同名岗位误合并。独立保存来源记录能追溯为何合并及在主来源失效时切换。

**Alternatives considered**: 仅按标题会合并不同地点/级别岗位；模糊文本或 AI 自动匹配难以审计；完全不跨来源去重无法满足重复率目标。

## 7. 招聘活动聚合

**Decision**: 首页实体是 `company + campaign_key`。优先采用来源提供的活动/批次；缺失时以来源入口和招聘类型形成稳定后备键。岗位名、地点去重聚合用于展示和搜索，底层岗位及链接保持独立。

**Rationale**: 该边界满足“一家公司同一批次一行”，同时保留校招、社招、实习和不同年份批次。多个链接用同一行内岗位选择器呈现。

**Alternatives considered**: 一公司一行会错误混合独立活动；一岗位一行违背用户要求；依赖纯文本批次名容易因文案改变造成身份漂移。

## 8. 生命周期

**Decision**: 明确关闭或截止日期过期立即关闭；一次成功完整快照缺失变为 `stale`，第二次相隔至少 6 小时的成功完整快照仍缺失才变为 `closed`；失败或部分快照不推进缺失状态；再次出现变为 `open` 并记录 `reopened` 事件。

**Rationale**: 两次确认降低瞬时分页/上游问题导致的误下架，仍可在 12 小时内反映变化。事件表使新增、更新、失效和恢复均可解释。

**Alternatives considered**: 一次缺失立即关闭风险过高；固定保留多天不满足新鲜度；删除记录会破坏收藏、私人投递关联和审计。

## 9. 首页路由与导航

**Decision**: `/` 改为招聘广场，现有私人投递工作区迁到 `/applications`，导航同时展示“招聘广场”和“我的投递”。

**Rationale**: 用户明确要求招聘信息位于首页，独立 URL 使筛选、刷新、性能和权限测试更清晰，也避免与私人投递查询参数混合。

**Alternatives considered**: 首页 Tab 会让两套分页/筛选状态耦合；保留私人投递为 `/` 不满足需求；另建 `/jobs` 但首页跳转增加一步。

## 10. 数据、测试与发布策略

**Decision**: 只保存业务所需规范字段、来源哈希和安全摘要，不保存任意原始 HTML 或个人联系人；所有外部适配器以固定夹具测试。通过功能开关和来源 `paused` 状态分批启用。

**Rationale**: 数据最小化降低隐私、XSS 和存储风险；确定性夹具避免 CI 受真实站点影响；增量启用使来源异常可快速隔离而不影响私人投递。

**Alternatives considered**: 保存完整响应便于调试但包含非必要数据；测试直连真实 API 不可重复；一次性启用 100 个来源难以定位容量和格式问题。
