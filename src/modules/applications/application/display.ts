export function formatCompanyWithCity(
  companyName: string,
  city: string | null | undefined,
) {
  const normalizedCity = city?.trim();
  return normalizedCity ? `${companyName}（${normalizedCity}）` : companyName;
}
