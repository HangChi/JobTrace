import { APPLICATION_TYPES } from "@/modules/applications/domain/catalog";
import {
  businessToday,
  calendarDaysBetween,
} from "@/shared/date/business-date";
import { z } from "zod";
import {
  ANALYTICS_PERIODS,
  type AnalyticsPeriod,
  type AnalyticsReportQuery,
  type AnalyticsResolvedRange,
} from "./contracts";

function shiftDays(value: string, days: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function shiftYear(value: string, years: number) {
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCFullYear(date.getUTCFullYear() + years);
  return date.toISOString().slice(0, 10);
}

function validDate(value: string | null) {
  return value && z.iso.date().safeParse(value).success ? value : undefined;
}

export function parseAnalyticsReportQuery(
  params: URLSearchParams,
): AnalyticsReportQuery {
  const rawPeriod = params.get("period");
  const period = ANALYTICS_PERIODS.includes(rawPeriod as AnalyticsPeriod)
    ? (rawPeriod as AnalyticsPeriod)
    : "90d";
  const rawType = params.get("type");
  const type = APPLICATION_TYPES.includes(rawType as never)
    ? (rawType as AnalyticsReportQuery["type"])
    : undefined;
  const rawCity = params.get("city");
  const hasCityFilter = params.has("city") && rawCity !== "__all__";
  return {
    period,
    from: params.get("from")?.slice(0, 10) || undefined,
    to: params.get("to")?.slice(0, 10) || undefined,
    type,
    city: hasCityFilter ? (rawCity ?? "").slice(0, 100) : undefined,
    hasCityFilter,
  };
}

export function resolveAnalyticsRange(
  query: AnalyticsReportQuery,
  today = businessToday(),
): AnalyticsResolvedRange {
  let from: string | undefined;
  let to: string | undefined = today;
  let error: string | undefined;

  if (query.period === "all") to = undefined;
  else if (query.period === "ytd") from = `${today.slice(0, 4)}-01-01`;
  else if (query.period === "custom") {
    from = validDate(query.from ?? null);
    to = validDate(query.to ?? null);
    if (!from || !to) error = "请选择完整且有效的开始与结束日期。";
    else if (from > to) error = "开始日期不能晚于结束日期。";
    else if (to > today) error = "结束日期不能晚于今天。";
  } else {
    const days = Number.parseInt(query.period, 10);
    from = shiftDays(today, -(days - 1));
  }

  let comparisonFrom: string | undefined;
  let comparisonTo: string | undefined;
  if (!error && from && to) {
    if (query.period === "ytd") {
      comparisonFrom = `${Number(today.slice(0, 4)) - 1}-01-01`;
      comparisonTo = shiftYear(to, -1);
    } else {
      const length = calendarDaysBetween(from, to) + 1;
      comparisonTo = shiftDays(from, -1);
      comparisonFrom = shiftDays(comparisonTo, -(length - 1));
    }
  }

  const span = from && to ? calendarDaysBetween(from, to) + 1 : Infinity;
  return {
    ...query,
    from,
    to,
    comparisonFrom,
    comparisonTo,
    granularity: span <= 180 ? "week" : "month",
    error,
  };
}
