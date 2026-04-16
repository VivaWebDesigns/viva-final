import { useState } from "react";
import { MessageSquare, Send } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@features/auth/useAuth";
import { useQUOSMS } from "@/hooks/useQUOSMS";
import { STALE } from "@/lib/queryClient";

interface Rep {
  id: string;
  name: string;
}

interface SMSButtonProps {
  phone: string | null | undefined;
  contactId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}

export default function SMSButton({ phone, contactId, leadId, clientId }: SMSButtonProps) {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const { sendSMS, isPending } = useQUOSMS();
  const [selectedRepId, setSelectedRepId] = useState<string>("");
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState("");

  const { data: reps = [] } = useQuery<Rep[]>({
    queryKey: ["/api/admin/users", "sales_rep"],
    queryFn: async () => {
      const res = await fetch("/api/admin/users?role=sales_rep");
      if (!res.ok) throw new Error("Failed to fetch reps");
      return res.json();
    },
    staleTime: STALE.SLOW,
    enabled: isAdmin,
  });

  if (!phone) return null;
  return null;

  function handleSend() {
    if (!message.trim()) return;
    const repId = isAdmin ? (selectedRepId || null) : (user?.id ?? null);
    sendSMS({ phone: phone!, content: message.trim(), repId, contactId, leadId, clientId });
    setOpen(false);
    setMessage("");
  }

  function handleOpen() {
    setMessage("");
    setOpen(true);
  }

  return (
    <>
      <span className="inline-flex items-center gap-1" data-testid="sms-button-wrapper">
        {isAdmin && reps.length > 0 && (
          <Select value={selectedRepId} onValueChange={setSelectedRepId}>
            <SelectTrigger
              className="h-6 text-xs px-2 py-0 w-32 border-gray-200"
              data-testid="select-sms-rep"
            >
              <SelectValue placeholder="Pick rep" />
            </SelectTrigger>
            <SelectContent>
              {reps.map((rep) => (
                <SelectItem key={rep.id} value={rep.id} data-testid={`option-sms-rep-${rep.id}`}>
                  {rep.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
        <Button
          size="sm"
          variant="outline"
          className="h-6 px-2 py-0 text-xs gap-1 text-violet-600 border-violet-400/40 hover:bg-violet-50 hover:text-violet-700"
          onClick={handleOpen}
          data-testid="button-manda-sms"
        >
          <MessageSquare className="w-3 h-3" />
          Manda SMS
        </Button>
      </span>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md" data-testid="dialog-sms-compose">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-violet-600" />
              Enviar SMS
            </DialogTitle>
            <DialogDescription>
              Compose and send a text message via Quo to {phone}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-1">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Para</Label>
              <p className="text-sm font-medium" data-testid="text-sms-recipient">{phone}</p>
            </div>

            <div>
              <Label htmlFor="sms-message" className="text-xs text-muted-foreground mb-1 block">
                Mensaje
              </Label>
              <Textarea
                id="sms-message"
                placeholder="Escribe tu mensaje aquí…"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                rows={4}
                maxLength={1600}
                className="resize-none text-sm"
                data-testid="textarea-sms-message"
              />
              <p className="text-xs text-muted-foreground text-right mt-1">
                {message.length}/1600
              </p>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setOpen(false)}
              data-testid="button-sms-cancel"
            >
              Cancelar
            </Button>
            <Button
              onClick={handleSend}
              disabled={!message.trim() || isPending}
              className="gap-1 bg-violet-600 hover:bg-violet-700 text-white"
              data-testid="button-sms-send"
            >
              <Send className="w-3.5 h-3.5" />
              {isPending ? "Enviando…" : "Enviar SMS"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
