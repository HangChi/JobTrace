import Link from "next/link";
import { PageHeader } from "@/shared/ui/page-header";
import type { AnalyticsReport as AnalyticsReportData } from "../application/contracts";
import { STAGE_LABELS } from "@/modules/applications/domain/catalog";
import {
  REVIEW_STATUS_LABELS,
  ROUND_RESULT_LABELS,
} from "@/modules/interviews/domain/catalog";
import { AnalyticsReportFilters } from "./analytics-report-filters";
import { ReportMetricCards } from "./report-metric-cards";
import { ApplicationTrendChart } from "./application-trend-chart";
import { DimensionComparison } from "./dimension-comparison";

function MilestonePanel({ report }: { report: AnalyticsReportData }) {
  const max = Math.max(report.milestones[0]?.count ?? 0, 1);
  return (
    <section
      className="panel analytics-report-panel"
      aria-labelledby="milestone-title"
    >
      <div className="analytics-report-panel-heading">
        <div>
          <h2 id="milestone-title">里程碑转化</h2>
        </div>
        {report.biggestDrop?.count ? (
          <span>最大流失 {report.biggestDrop.count} 个机会</span>
        ) : null}
      </div>
      <ol className="milestone-list">
        {report.milestones.map((item) => (
          <li key={item.key}>
            <div className="milestone-meta">
              <strong>{item.label}</strong>
              <span>
                <b>{item.count}</b> 个机会
                {item.conversionFromPrevious === null
                  ? ""
                  : ` · 上一步转化 ${item.conversionFromPrevious}%`}
              </span>
            </div>
            <span className="milestone-track" aria-hidden="true">
              <span
                style={{
                  width: `${Math.max((item.count / max) * 100, item.count ? 4 : 0)}%`,
                }}
              />
            </span>
          </li>
        ))}
      </ol>
      <p className="analytics-panel-caption">
        漏斗只计算具有完整前序阶段记录的机会，总体 Offer 率见顶部指标。
      </p>
    </section>
  );
}

function StageReachPanel({ report }: { report: AnalyticsReportData }) {
  return (
    <section
      className="panel analytics-report-panel"
      aria-labelledby="stage-reach-title"
    >
      <div className="analytics-report-panel-heading">
        <div>
          <h2 id="stage-reach-title">阶段到达率</h2>
        </div>
        <span>按独立投递计数</span>
      </div>
      {report.metrics.applications.value ? (
        <ul className="stage-reach-list">
          {report.stageReach.map((item) => (
            <li key={item.stage}>
              <div>
                <strong>{STAGE_LABELS[item.stage]}</strong>
                <span>
                  {item.count} 条 · {item.rate}%
                </span>
              </div>
              <span
                className={`stage-reach-track stage-${item.stage}`}
                aria-hidden="true"
              >
                <span style={{ width: `${item.rate}%` }} />
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="analytics-panel-empty">尚无阶段数据。</p>
      )}
    </section>
  );
}

function InterviewReviewPanel({ report }: { report: AnalyticsReportData }) {
  const { interviews } = report;
  return (
    <section
      className="panel analytics-report-panel interview-analysis-panel"
      aria-labelledby="interview-analysis-title"
    >
      <div className="analytics-report-panel-heading">
        <div>
          <h2 id="interview-analysis-title">面试复盘</h2>
        </div>
        <Link href="/interviews">查看面经</Link>
      </div>
      {interviews.total ? (
        <>
          <div className="interview-analysis-metrics">
            <div>
              <span>面经数量</span>
              <strong>{interviews.total}</strong>
            </div>
            <div>
              <span>{REVIEW_STATUS_LABELS.completed}率</span>
              <strong>{interviews.completionRate}%</strong>
            </div>
            <div>
              <span>{ROUND_RESULT_LABELS.passed}率</span>
              <strong>
                {interviews.resolved ? `${interviews.passRate}%` : "—"}
              </strong>
              <small>
                {interviews.resolved
                  ? `${interviews.passed}/${interviews.resolved} 场已出结果`
                  : "尚无已出结果面经"}
              </small>
            </div>
          </div>
          <div className="interview-stage-results">
            {interviews.byStage.map((item) => (
              <div key={item.stage}>
                <strong>{STAGE_LABELS[item.stage]}</strong>
                <span>通过 {item.results.passed}</span>
                <span>未通过 {item.results.failed}</span>
                <span>待反馈 {item.results.pending}</span>
              </div>
            ))}
          </div>
        </>
      ) : (
        <div className="analytics-guidance-empty">
          <strong>还没有面经数据</strong>
          <p>记录面试内容和结果后，这里会展示复盘完成率与各轮通过情况。</p>
          <Link className="button secondary" href="/interviews/new">
            记录面经
          </Link>
        </div>
      )}
    </section>
  );
}

function ReviewSummary({ report }: { report: AnalyticsReportData }) {
  return (
    <section
      className="panel analytics-report-panel review-summary-panel"
      aria-labelledby="review-summary-title"
    >
      <div className="analytics-report-panel-heading">
        <div>
          <h2 id="review-summary-title">复盘摘要</h2>
        </div>
        {!report.sampleSufficient && report.metrics.applications.value ? (
          <span className="sample-warning">样本较少</span>
        ) : null}
      </div>
      {report.summary.length ? (
        <ul className="review-summary-list">
          {report.summary.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="analytics-panel-empty">
          积累更多投递后，这里会形成可解释的周期摘要。
        </p>
      )}
      {report.dataQuality.length ? (
        <div className="data-quality-note">
          <strong>数据完整性提示</strong>
          <ul>
            {report.dataQuality.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

export function AnalyticsReport({ report }: { report: AnalyticsReportData }) {
  const total = report.metrics.applications.value ?? 0;
  const periodLabels = {
    "30d": "近 30 天",
    "90d": "近 90 天",
    "180d": "近 180 天",
    ytd: "今年",
    all: "全部历史",
    custom: "自定义范围",
  } as const;
  return (
    <section className="stack page-gap analytics-report-page">
      <PageHeader
        kicker="数据概览"
        title="求职分析"
        description="按时间、类型和城市查看投递趋势与转化。"
        meta={[
          { label: periodLabels[report.query.period], tone: "brand" },
          { label: `${total} 次投递` },
          { label: `${report.interviews.total} 次进入面试` },
        ]}
      />
      <AnalyticsReportFilters
        query={report.query}
        cities={report.availableCities}
      />
      {total ? (
        <>
          <ReportMetricCards report={report} />
          <ApplicationTrendChart points={report.trend} />
          <div className="analytics-report-two-column">
            <MilestonePanel report={report} />
            <StageReachPanel report={report} />
          </div>
          <DimensionComparison
            types={report.typeBreakdown}
            cities={report.cityBreakdown}
          />
          <InterviewReviewPanel report={report} />
          <ReviewSummary report={report} />
        </>
      ) : (
        <section
          className="panel analytics-report-empty"
          aria-labelledby="analytics-empty-title"
        >
          <span className="analytics-empty-mark" aria-hidden="true" />
          <h2 id="analytics-empty-title">当前范围内还没有投递</h2>
          <p>
            创建投递并持续记录招聘阶段后，这里会自动形成趋势、转化和面试复盘。
          </p>
          <Link className="button" href="/applications/new">
            创建首条投递
          </Link>
        </section>
      )}
    </section>
  );
}

export function AnalyticsReportValidation({
  query,
  cities,
}: {
  query: AnalyticsReportData["query"];
  cities: string[];
}) {
  return (
    <section className="stack page-gap analytics-report-page">
      <PageHeader
        kicker="数据概览"
        title="求职分析"
        description="修正分析范围后即可查看结果。"
      />
      <AnalyticsReportFilters query={query} cities={cities} />
    </section>
  );
}
