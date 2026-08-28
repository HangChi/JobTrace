import { ApplicationForm } from "@/modules/applications/ui/application-form";
import { requirePageUser } from "@/modules/identity-access";
export default async function NewApplicationPage() {
  await requirePageUser();
  return (
    <section className="stack">
      <div>
        <h1>新增投递</h1>
        <p className="lead">
          先填写公司、岗位和投递日期，其他信息可以稍后补充。
        </p>
      </div>
      <ApplicationForm />
    </section>
  );
}
