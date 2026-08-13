import { ApplicationForm } from "@/modules/applications/ui/application-form";
export default function NewApplicationPage() {
  return (
    <section className="stack">
      <div>
        <p className="badge">新增记录</p>
        <h1>记录一次新投递</h1>
        <p className="lead">
          先填写公司、岗位和投递日期，其他信息可以稍后补充。
        </p>
      </div>
      <ApplicationForm />
    </section>
  );
}
