# Query Contract: 查询性能渐进优化

## Compatibility

- 现有 HTTP 路径、查询参数、响应字段和错误代码保持不变。
- 投递与面经列表的 `items`、`total`、`limit`、`page` 和 `nextCursor` 保持现有含义。
- 岗位市场的公司聚合、关闭数据可见性、收藏与已记录状态保持现有含义。
- 岗位市场列表的 `positions` 是稳定排序的有界摘要（最多 50 项），`positionCount` 始终是完整去重总数；按活动读取详情时仍返回完整岗位集合。
- 分析摘要和报告返回的全部数值、精度、日期标签和数据质量诊断保持不变。

## Performance validation contract

| Read path | Representative scale | p95 budget |
|---|---:|---:|
| Application full list/filter/cursor path | 10,000 applications with stages | 500 ms |
| Interview full list/filter/search path | 10,000 reviews with questions/actions | 500 ms |
| Analytics summary/report path | 10,000 applications with related facts | 500 ms |
| Job-market full browse/filter path | 100 companies / 100,000 posts | 500 ms |

每个基准必须在隔离数据库中执行，使用确定性数据，验证非空结果和核心契约，并在结束后删除临时数据库。
