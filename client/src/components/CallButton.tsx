import { useState } from "react";
import { Phone } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useAuth } from "@features/auth/useAuth";
import { useQUOCall } from "@/hooks/useQUOCall";
import { STALE } from "@/lib/queryClient";

interface Rep {
  id: string;
  name: string;
}

interface CallButtonProps {
  phone: string | null | undefined;
  contactId?: string | null;
  leadId?: string | null;
  clientId?: string | null;
}

export default function CallButton({ phone, contactId, leadId, clientId }: CallButtonProps) {
  const { role, user } = useAuth();
  const isAdmin = role === "admin";
  const { initiateCall } = useQUOCall();
  const [selectedRepId, setSelectedRepId] = useState<string>("");

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

  function handleCall() {
    const repId = isAdmin ? (selectedRepId || null) : (user?.id ?? null);
    initiateCall({ phone: phone!, repId, contactId, leadId, clientId });
  }

  return (
    <span className="inline-flex items-center gap-1" data-testid="call-button-wrapper">
      {isAdmin && reps.length > 0 && (
        <Select value={selectedRepId} onValueChange={setSelectedRepId}>
          <SelectTrigger
            className="h-6 text-xs px-2 py-0 w-32 border-gray-200"
            data-testid="select-call-rep"
          >
            <SelectValue placeholder="Pick rep" />
          </SelectTrigger>
          <SelectContent>
            {reps.map((rep) => (
              <SelectItem key={rep.id} value={rep.id} data-testid={`option-rep-${rep.id}`}>
                {rep.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button
        size="sm"
        variant="outline"
        className="h-6 px-2 py-0 text-xs gap-1 text-[#0D9488] border-[#0D9488]/40 hover:bg-[#0D9488]/10 hover:text-[#0D9488]"
        onClick={handleCall}
        data-testid="button-llamar"
      >
        <Phone className="w-3 h-3" />
        Llamar
      </Button>
    </span>
  );
}
