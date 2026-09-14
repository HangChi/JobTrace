const publicationDate = new Intl.DateTimeFormat("zh-CN", {
  year: "numeric",
  month: "long",
  day: "numeric",
  timeZone: "Asia/Shanghai",
});

export function formatPublicationDate(value: string) {
  return publicationDate.format(new Date(value));
}
