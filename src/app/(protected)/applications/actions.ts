"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createApplication, updateApplication } from "@/modules/applications";
import { asProblem } from "@/shared/errors/problem";

export type ApplicationActionState = {
  message?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
};

function valuesFrom(formData: FormData) {
  return Object.fromEntries(
    [...formData.entries()].filter(([, value]) => typeof value === "string"),
  ) as Record<string, string>;
}

function failure(
  error: unknown,
  values: Record<string, string>,
): ApplicationActionState {
  const problem = asProblem(error);
  return {
    message: problem.message,
    values,
    fieldErrors: Object.fromEntries(
      (problem.fieldErrors ?? []).map((item) => [item.field, item.message]),
    ),
  };
}

export async function createApplicationAction(
  _state: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const values = valuesFrom(formData);
  try {
    const application = await createApplication(values);
    revalidatePath("/");
    redirect(`/applications/${application.id}`);
  } catch (error) {
    if ((error as { digest?: string }).digest?.startsWith("NEXT_REDIRECT"))
      throw error;
    return failure(error, values);
  }
}

export async function updateApplicationAction(
  id: string,
  version: number,
  _state: ApplicationActionState,
  formData: FormData,
): Promise<ApplicationActionState> {
  const values = valuesFrom(formData);
  try {
    await updateApplication(id, {
      ...values,
      stages: [],
      version,
      changeDate: new Date().toLocaleDateString("en-CA", {
        timeZone: "Asia/Shanghai",
      }),
    });
    revalidatePath("/");
    revalidatePath(`/applications/${id}`);
    return { message: "修改已保存。" };
  } catch (error) {
    return failure(error, values);
  }
}
