export function deterministicApplications(count = 10000) {
  return Array.from({ length: count }, (_, index) => ({
    companyName: `公司 ${index % 500}`,
    positionName: `岗位 ${index % 100}`,
    city: ["上海", "北京", "深圳", "杭州"][index % 4],
    appliedDate: `2026-08-${String((index % 28) + 1).padStart(2, "0")}`,
    status: index % 9 === 0 ? "rejected" : "active",
  }));
}
