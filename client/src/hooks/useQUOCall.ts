import { useToast } from "@/hooks/use-toast";

export interface QUOCallPayload {
  phone: string;
  repId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}

export function useQUOCall() {
  const { toast } = useToast();

  function initiateCall(payload: QUOCallPayload) {
    const { phone } = payload;

    const digits = phone.replace(/\D/g, "");
    const dialable = digits.length >= 7 ? `+1${digits.slice(-10)}` : phone;

    window.location.href = `tel:${dialable}`;

    toast({
      title: "Abriendo llamada…",
      description: `Marcando ${phone} en tu app de Quo. Si no abre automáticamente, llama desde la app manualmente.`,
    });
  }

  return { initiateCall };
}
