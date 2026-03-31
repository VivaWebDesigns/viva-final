import { useMutation } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

export interface QUOSMSPayload {
  phone: string;
  content: string;
  repId?: string | null;
  contactId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}

export function useQUOSMS() {
  const { toast } = useToast();

  const mutation = useMutation({
    mutationFn: async (payload: QUOSMSPayload) => {
      return apiRequest("POST", "/api/quo/sms", {
        to: payload.phone,
        content: payload.content,
        leadId: payload.leadId ?? undefined,
        contactId: payload.contactId ?? undefined,
      });
    },
    onSuccess: (_data, variables) => {
      toast({
        title: "SMS enviado",
        description: `Mensaje enviado a ${variables.phone} a través de Quo.`,
      });
      if (variables.leadId) {
        queryClient.invalidateQueries({ queryKey: ["/api/profiles", "lead", variables.leadId] });
      }
    },
    onError: (err: any) => {
      toast({
        title: "Error al enviar SMS",
        description: err?.message ?? "No se pudo enviar el mensaje. Intenta de nuevo.",
        variant: "destructive",
      });
    },
  });

  function sendSMS(payload: QUOSMSPayload) {
    mutation.mutate(payload);
  }

  return { sendSMS, isPending: mutation.isPending };
}
