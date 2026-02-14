import { toast } from "sonner";

export function notifySuccess(message: string, desc?: string) {
  toast.success(message, desc ? { description: desc } : undefined);
}

export function notifyError(message: string, desc?: string) {
  toast.error(message, desc ? { description: desc } : undefined);
}

export function notifyInfo(message: string, desc?: string) {
  toast(message, desc ? { description: desc } : undefined);
}

export async function withToast<T>(
  promise: Promise<T>,
  msgs: { loading: string; success: string; error: string }
) {
  const id = toast.loading(msgs.loading);
  try {
    const res = await promise;
    toast.success(msgs.success, { id });
    return res;
  } catch (err: any) {
    toast.error(msgs.error, { id, description: err?.message });
    throw err;
  }
}