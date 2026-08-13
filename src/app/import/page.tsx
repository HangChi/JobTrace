import { ImportUploader } from "@/modules/data-transfer/ui/import-uploader";

export default function ImportPage() {
  return (
    <section className="stack">
      <div>
        <p className="badge">批量迁移</p>
        <h1>导入投递记录</h1>
        <p className="lead">
          上传后先逐行预检，不会直接写入数据库。请使用“公司、岗位、投递日期”等列名。
        </p>
      </div>
      <ImportUploader />
    </section>
  );
}
