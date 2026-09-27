# Research: Scheduled reminders

## Decision 1: External scheduler with database claims

**Decision**: 复用岗位同步已验证的模式，由外部调度器每分钟调用受保护的内部 Route Handler；PostgreSQL 负责原子认领、租约、幂等和结果持久化。

**Rationale**: Next.js 进程会重启和扩缩容，进程内计时器无法保证唯一执行或补偿。外部触发不要求引入新队列，而数据库唯一键与 claim token 可以覆盖重复调用、并行实例和执行器超时。

**Alternatives considered**: `setTimeout`/进程内 cron 会在重启后丢失；请求后的短任务不适合持久定时调度；立即引入消息队列会增加部署和运维成本，当前每分钟批量规模不需要。

## Decision 2: Persist event time and next notification time separately

**Decision**: 提醒同时保存 `event_at` 和 `notify_at`，均为绝对时刻；界面按 Asia/Shanghai 输入和展示。

**Rationale**: 事项发生时间和用户希望被通知的时间是两个不同概念。显式保存两者使“提前 1 小时”和“稍后 30 分钟”都可解释、可审计，且避免重新计算时受到设置变化影响。

**Alternatives considered**: 只保存事项时间和 offset 会让 snooze 难以表达；只保存发送时间无法向用户说明原事项；只保存无时区字符串会在服务端和浏览器之间产生歧义。

## Decision 3: One next notification per reminder in v1

**Decision**: 单条提醒只包含一个下一次通知时间；多次提醒通过多条记录表达。

**Rationale**: 满足准时、提前 30 分钟/1 小时/1 天和自定义的核心需求，同时保持状态机、编辑器和幂等键简单。多通知点会把一条待办扩展成独立通知规则集合，显著增加取消、完成和 snooze 语义。

**Alternatives considered**: 一条提醒保存 offset 数组更接近日历产品，但第一版的 UI、状态和重试复杂度过高；周期规则不属于当前需求。

## Decision 4: In-app state is authoritative; email is a delivery attempt

**Decision**: 到期后提醒先进入站内 `due`；邮件作为独立尝试记录成功或失败，失败不回滚或隐藏站内提醒。

**Rationale**: SMTP/外部邮箱不可控。将邮件结果与待办状态分开，用户不会因为外部故障丢失任务，也不会把“邮件失败”误判为“待办未到期”。

**Alternatives considered**: 邮件成功后才标记到期会延迟站内提醒；失败即取消会违反可靠回退要求；无限自动重试可能造成邮件风暴。

## Decision 5: Extend the existing mail webhook

**Decision**: 在现有 `deliverEmail` 联合类型和 Python SMTP 适配器中增加 `scheduled_reminder` 模板，传入公司、岗位、待办、事项时间和安全返回 URL。

**Rationale**: 已有 Webhook 具备 Bearer 鉴权、大小限制、SMTP TLS 和受控错误映射。复用边界避免在 Next.js 中新增 SMTP 凭据或第二套发送代码。

**Alternatives considered**: 直接引入邮件 SDK 会增加依赖并绕过现有运维入口；发送任意 HTML 会扩大注入风险；把完整备注传给邮件服务违反最小披露。

## Decision 6: Use optimistic versioning for user mutations

**Decision**: 每条提醒保存递增 `version`；编辑、完成、稍后、取消和重新打开均提交期望版本并原子校验。

**Rationale**: 用户可能在多个页面或设备操作同一提醒，调度器也可能同时推进到期状态。版本冲突可以返回最新状态，而不是覆盖更近的操作。

**Alternatives considered**: 最后写入覆盖会重新激活已取消提醒或覆盖 snooze；长事务锁无法跨用户思考时间；只按状态判断不足以发现两次不同编辑。

## Decision 7: Preserve legacy dismissal semantics

**Decision**: 现有 `progress_reminder_completions` 记录回填为 `dismissed`；新记录可为 `completed`、`dismissed` 或 `scheduled`。

**Rationale**: 历史按钮明确写着“不再提醒”，无法证明事项已经完成。按 dismissed 迁移最忠实，也不会重新向用户展示已经关闭的建议。

**Alternatives considered**: 全部视为 completed 会伪造完成历史；清空旧记录会重新弹出用户明确关闭的建议；保留无类型表会继续混淆三个动作。

## Decision 8: No dedicated top-level page in the first increment

**Decision**: 提醒汇总嵌入现有投递首页的求职概览，详情页提供创建入口；历史通过面板筛选访问。

**Rationale**: 用户处理提醒时需要公司、岗位和阶段上下文，现有首页已经是行动入口。新增一级页面和导航会扩大信息架构范围，但不会提升第一版核心价值。

**Alternatives considered**: `/reminders` 独立页面适合未来提醒数量和筛选维度增加后再引入；只在详情页展示则无法集中处理到期项目。
