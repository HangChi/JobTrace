import { ImportUploader } from "@/modules/data-transfer/ui/import-uploader";
import { requirePageUser } from "@/modules/identity-access";

export default async function ImportPage() {
  await requirePageUser();
  return (
    <section className="stack">
      <header className="transfer-page-header">
        <h1>导入投递记录</h1>
        <p className="lead">选择 CSV 或 XLSX 文件，预检无误后再确认导入。</p>
      </header>
      <ol className="transfer-steps" aria-label="导入步骤">
        <li>
          <span>1</span>
          <strong>选择文件</strong>
        </li>
        <li>
          <span>2</span>
          <strong>检查数据</strong>
        </li>
        <li>
          <span>3</span>
          <strong>确认导入</strong>
        </li>
      </ol>
      <ImportUploader />
    </section>
  );
}
