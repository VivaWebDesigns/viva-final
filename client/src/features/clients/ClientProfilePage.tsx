import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useParams, useLocation } from "wouter";
import { 
  ArrowLeft, Building2, Mail, Phone, MapPin, Globe, 
  User, Calendar, Plus, MessageSquare, History, 
  Users, Layout, Star, Pin, Trash2, Edit2, CheckCircle2,
  Clock, AlertCircle, CheckCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { 
  Form, FormControl, FormField, FormItem, FormLabel, FormMessage 
} from "@/components/ui/form";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { 
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter 
} from "@/components/ui/dialog";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest, queryClient, STALE } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import type { 
  CrmCompany, CrmContact, CrmLead, CrmLeadStatus, 
  PipelineOpportunity, PipelineStage, OnboardingRecord,
  ClientNote, User as DbUser
} from "@shared/schema";

// Types based on expected backend response from T002
interface ClientProfile extends CrmCompany {
  contacts: (CrmContact & { isPrimary: boolean })[];
  leads: (CrmLead & { status: CrmLeadStatus | null })[];
  opportunities: (PipelineOpportunity & { stage: PipelineStage | null })[];
  onboardings: OnboardingRecord[];
  accountOwner: Pick<DbUser, "id" | "name" | "email"> | null;
  recentNotes: (ClientNote & { user?: Pick<DbUser, "id" | "name"> })[];
}

const updateAccountSchema = z.object({
  clientStatus: z.string().nullable(),
  accountOwnerId: z.string().nullable(),
  nextFollowUpDate: z.string().nullable().or(z.date()),
  preferredContactMethod: z.string().nullable(),
  preferredLanguage: z.string().nullable(),
  name: z.string().min(1, "Name is required"),
  dba: z.string().nullable(),
  phone: z.string().nullable(),
  email: z.string().nullable(),
  website: z.string().nullable(),
  industry: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  zip: z.string().nullable(),
  notes: z.string().nullable(),
});

const createNoteSchema = z.object({
  type: z.enum(["general", "call", "meeting", "internal"]),
  content: z.string().min(1, "Content is required"),
  isPinned: z.boolean().default(false),
});

const contactSchema = z.object({
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().nullable(),
  email: z.string().email("Invalid email").nullable().or(z.literal("")),
  phone: z.string().nullable(),
  title: z.string().nullable(),
  preferredLanguage: z.string().default("es"),
  isPrimary: z.boolean().default(false),
});

export default function ClientProfilePage({ id }: { id: string }) {
  const { toast } = useToast();
  const [, navigate] = useLocation();
  const [activeTab, setActiveTab] = useState("overview");
  const [isContactDialogOpen, setIsContactDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CrmContact | null>(null);

  const { data: client, isLoading, error } = useQuery<ClientProfile>({
    queryKey: ["/api/clients", id],
    staleTime: STALE.FAST,
  });

  const { data: notes = [] } = useQuery<(ClientNote & { user?: { name: string } })[]>({
    queryKey: ["/api/clients", id, "notes"],
    enabled: !!id,
  });

  const { data: users = [] } = useQuery<Pick<DbUser, "id" | "name">[]>({
    queryKey: ["/api/admin/users"],
  });

  const updateClientMutation = useMutation({
    mutationFn: async (values: z.infer<typeof updateAccountSchema>) => {
      await apiRequest("PATCH", `/api/clients/${id}`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      toast({ title: "Success", description: "Account updated successfully" });
    },
    onError: (err: Error) => {
      toast({ variant: "destructive", title: "Update failed", description: err.message });
    }
  });

  const createNoteMutation = useMutation({
    mutationFn: async (values: z.infer<typeof createNoteSchema>) => {
      await apiRequest("POST", `/api/clients/${id}/notes`, values);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] }); // Recent notes in overview
      toast({ title: "Note added" });
    },
  });

  const deleteNoteMutation = useMutation({
    mutationFn: async (noteId: string) => {
      await apiRequest("DELETE", `/api/clients/${id}/notes/${noteId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id, "notes"] });
      toast({ title: "Note deleted" });
    },
  });

  const upsertContactMutation = useMutation({
    mutationFn: async (values: z.infer<typeof contactSchema>) => {
      if (editingContact) {
        await apiRequest("PATCH", `/api/clients/${id}/contacts/${editingContact.id}`, values);
      } else {
        await apiRequest("POST", `/api/clients/${id}/contacts`, values);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/clients", id] });
      setIsContactDialogOpen(false);
      setEditingContact(null);
      toast({ title: editingContact ? "Contact updated" : "Contact added" });
    },
  });

  if (isLoading) return <div className="p-8 animate-pulse space-y-4">
    <div className="h-12 bg-gray-200 rounded w-1/3" />
    <div className="h-64 bg-gray-100 rounded" />
  </div>;

  if (error || !client) return <div className="p-8 text-center">
    <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-4" />
    <h2 className="text-xl font-bold">Client not found</h2>
    <Button variant="outline" className="mt-4" onClick={() => navigate("/admin/clients")}>
      Back to Clients
    </Button>
  </div>;

  const statusColors: Record<string, string> = {
    active: "bg-emerald-100 text-emerald-700 border-emerald-200",
    inactive: "bg-gray-100 text-gray-700 border-gray-200",
    at_risk: "bg-amber-100 text-amber-700 border-amber-200",
    churned: "bg-red-100 text-red-700 border-red-200",
    prospect: "bg-blue-100 text-blue-700 border-blue-200",
  };

  return (
    <div className="h-full flex flex-col space-y-6 p-6 overflow-y-auto" data-testid={`page-client-profile-${id}`}>
      {/* Header */}
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate("/admin/clients")} data-testid="button-back">
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900 truncate" data-testid="text-client-name">
                {client.name}
              </h1>
              {client.clientStatus && (
                <Badge className={statusColors[client.clientStatus] || ""} data-testid={`badge-status-${client.clientStatus}`}>
                  {client.clientStatus.replace("_", " ")}
                </Badge>
              )}
              {client.industry && (
                <Badge variant="outline" data-testid="badge-industry">{client.industry}</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 text-sm text-gray-500 mt-1">
              {client.dba && <span className="font-medium">DBA: {client.dba}</span>}
              {(client.city || client.state) && (
                <span className="flex items-center gap-1">
                  <MapPin className="w-3 h-3" />
                  {[client.city, client.state].filter(Boolean).join(", ")}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Contacts</p>
              <p className="font-bold text-lg" data-testid="stat-contacts-count">{client.contacts.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
              <Layout className="w-5 h-5 text-emerald-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Active Leads</p>
              <p className="font-bold text-lg" data-testid="stat-leads-count">{client.leads.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-purple-50 flex items-center justify-center">
              <Clock className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Deals</p>
              <p className="font-bold text-lg" data-testid="stat-deals-count">{client.opportunities.length}</p>
            </div>
          </Card>
          <Card className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center">
              <Star className="w-5 h-5 text-amber-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Deal Value</p>
              <p className="font-bold text-lg" data-testid="stat-deals-value">
                ${client.opportunities.reduce((sum, op) => sum + Number(op.value || 0), 0).toLocaleString()}
              </p>
            </div>
          </Card>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="bg-gray-100/50 p-1">
          <TabsTrigger value="overview" data-testid="tab-overview">Overview</TabsTrigger>
          <TabsTrigger value="notes" data-testid="tab-notes">Notes</TabsTrigger>
          <TabsTrigger value="contacts" data-testid="tab-contacts">Contacts</TabsTrigger>
          <TabsTrigger value="activity" data-testid="tab-activity">Activity</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6 pt-4">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Contact Info Card */}
            <Card className="lg:col-span-1">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Building2 className="w-5 h-5 text-gray-400" />
                  Company Info
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  {client.email && (
                    <div className="flex items-center gap-3 text-sm">
                      <Mail className="w-4 h-4 text-gray-400" />
                      <span className="truncate">{client.email}</span>
                    </div>
                  )}
                  {client.phone && (
                    <div className="flex items-center gap-3 text-sm">
                      <Phone className="w-4 h-4 text-gray-400" />
                      <span>{client.phone}</span>
                    </div>
                  )}
                  {client.website && (
                    <div className="flex items-center gap-3 text-sm">
                      <Globe className="w-4 h-4 text-gray-400" />
                      <a href={client.website} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline truncate">
                        {client.website.replace(/^https?:\/\//, '')}
                      </a>
                    </div>
                  )}
                  <div className="flex items-start gap-3 text-sm">
                    <MapPin className="w-4 h-4 text-gray-400 mt-0.5" />
                    <span>
                      {[client.address, client.city, client.state, client.zip].filter(Boolean).join(", ") || "No address provided"}
                    </span>
                  </div>
                </div>

                <div className="pt-4 border-t space-y-3">
                  <div>
                    <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">Preferred Language</p>
                    <Badge variant="outline">{client.preferredLanguage === 'es' ? 'Spanish' : 'English'}</Badge>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1 uppercase font-semibold">Contact Method</p>
                    <p className="text-sm capitalize">{client.preferredContactMethod || "Not specified"}</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Account Management Form */}
            <Card className="lg:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-lg">Account Management</CardTitle>
              </CardHeader>
              <CardContent>
                <AccountForm 
                  client={client} 
                  users={users}
                  onSubmit={(data) => updateClientMutation.mutate(data)} 
                  isPending={updateClientMutation.isPending}
                />
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Onboarding Section */}
            {client.onboardings.length > 0 && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg">Onboarding Records</CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {client.onboardings.map(ob => (
                    <div key={ob.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors cursor-pointer" onClick={() => navigate(`/admin/onboarding/${ob.id}`)}>
                      <div className="flex items-center gap-3">
                        <CheckCircle2 className={`w-5 h-5 ${ob.status === 'completed' ? 'text-emerald-500' : 'text-gray-300'}`} />
                        <div>
                          <p className="text-sm font-medium">{ob.clientName}</p>
                          <p className="text-xs text-gray-500">Status: {ob.status.replace("_", " ")}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="text-[10px]">Due {ob.dueDate ? format(new Date(ob.dueDate), "MMM d") : "N/A"}</Badge>
                    </div>
                  ))}
                </CardContent>
              </Card>
            )}

            {/* Recent Leads */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Leads</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {client.leads.slice(0, 5).map(lead => (
                  <div key={lead.id} className="flex items-center justify-between p-3 border rounded-lg" onClick={() => navigate(`/admin/crm/leads/${lead.id}`)}>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{lead.title}</p>
                      <p className="text-xs text-gray-500">{format(new Date(lead.createdAt), "MMM d, yyyy")}</p>
                    </div>
                    {lead.status && (
                      <Badge variant="outline" style={{ borderColor: lead.status.color, color: lead.status.color }}>
                        {lead.status.name}
                      </Badge>
                    )}
                  </div>
                ))}
                {client.leads.length === 0 && <p className="text-center py-4 text-sm text-gray-400">No leads found</p>}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="notes" className="space-y-6 pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Client Notes</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <NoteForm onSubmit={(data) => createNoteMutation.mutate(data)} isPending={createNoteMutation.isPending} />
              
              <div className="space-y-4">
                {notes.map(note => (
                  <div key={note.id} className={`p-4 rounded-xl border ${note.isPinned ? 'bg-amber-50/30 border-amber-100' : 'bg-white'} relative group`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="secondary" className="text-[10px] uppercase">{note.type}</Badge>
                        {note.isPinned && <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />}
                        <span className="text-xs text-gray-500">
                          {note.user?.name || "System"} • {format(new Date(note.createdAt), "MMM d, yyyy h:mm a")}
                        </span>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => deleteNoteMutation.mutate(note.id)}>
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </Button>
                      </div>
                    </div>
                    <p className="text-sm text-gray-700 whitespace-pre-wrap">{note.content}</p>
                  </div>
                ))}
                {notes.length === 0 && <p className="text-center py-8 text-gray-400">No notes added yet.</p>}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="contacts" className="space-y-6 pt-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">Contacts</h2>
            <Dialog open={isContactDialogOpen} onOpenChange={setIsContactDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => setEditingContact(null)} data-testid="button-add-contact">
                  <Plus className="w-4 h-4 mr-2" />
                  Add Contact
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingContact ? "Edit Contact" : "Add New Contact"}</DialogTitle>
                </DialogHeader>
                <ContactForm 
                  initialData={editingContact}
                  onSubmit={(data) => upsertContactMutation.mutate(data)}
                  isPending={upsertContactMutation.isPending}
                />
              </DialogContent>
            </Dialog>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {client.contacts
              .sort((a, b) => (b.isPrimary ? 1 : 0) - (a.isPrimary ? 1 : 0))
              .map(contact => (
                <Card key={contact.id} className="p-4 flex items-start justify-between group hover-elevate">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-blue-50 flex items-center justify-center">
                      <User className="w-5 h-5 text-blue-500" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-bold text-gray-900">
                          {[contact.firstName, contact.lastName].filter(Boolean).join(" ")}
                        </p>
                        {contact.isPrimary && <Badge className="bg-blue-100 text-blue-700 hover:bg-blue-100">Primary</Badge>}
                      </div>
                      <p className="text-xs text-gray-500">{contact.title || "No title"}</p>
                      <div className="mt-2 space-y-1">
                        {contact.email && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Mail className="w-3 h-3" />
                            {contact.email}
                          </div>
                        )}
                        {contact.phone && (
                          <div className="flex items-center gap-2 text-xs text-gray-600">
                            <Phone className="w-3 h-3" />
                            {contact.phone}
                          </div>
                        )}
                        <Badge variant="outline" className="text-[9px] uppercase px-1 h-4">
                          {contact.preferredLanguage === 'es' ? 'Spanish' : 'English'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="icon" 
                    className="opacity-0 group-hover:opacity-100 transition-opacity"
                    onClick={() => {
                      setEditingContact(contact);
                      setIsContactDialogOpen(true);
                    }}
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                </Card>
              ))}
            {client.contacts.length === 0 && (
              <div className="col-span-full py-12 text-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                <Users className="w-12 h-12 text-gray-300 mx-auto mb-2" />
                <p className="text-gray-500">No contacts listed for this client.</p>
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="activity" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Activity History</CardTitle>
            </CardHeader>
            <CardContent>
              <ActivityTimeline clientId={id} clientData={client} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AccountForm({ client, users, onSubmit, isPending }: { 
  client: ClientProfile, 
  users: Pick<DbUser, "id" | "name">[],
  onSubmit: (data: any) => void, 
  isPending: boolean 
}) {
  const form = useForm({
    resolver: zodResolver(updateAccountSchema),
    defaultValues: {
      clientStatus: client.clientStatus || "prospect",
      accountOwnerId: client.accountOwnerId || "",
      nextFollowUpDate: client.nextFollowUpDate ? new Date(client.nextFollowUpDate).toISOString().split('T')[0] : "",
      preferredContactMethod: client.preferredContactMethod || "email",
      preferredLanguage: client.preferredLanguage || "en",
      name: client.name,
      dba: client.dba || "",
      phone: client.phone || "",
      email: client.email || "",
      website: client.website || "",
      industry: client.industry || "",
      address: client.address || "",
      city: client.city || "",
      state: client.state || "",
      zip: client.zip || "",
      notes: client.notes || "",
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="clientStatus"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Client Status</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="prospect">Prospect</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="at_risk">At Risk</SelectItem>
                    <SelectItem value="churned">Churned</SelectItem>
                    <SelectItem value="inactive">Inactive</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="accountOwnerId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Account Owner</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select owner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="nextFollowUpDate"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Next Follow-up</FormLabel>
                <FormControl>
                  <Input type="date" {...field} value={field.value || ""} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="preferredContactMethod"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Preferred Method</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value || ""}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select method" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="email">Email</SelectItem>
                    <SelectItem value="phone">Phone</SelectItem>
                    <SelectItem value="text">Text Message</SelectItem>
                    <SelectItem value="in_person">In Person</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="notes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Internal Account Notes</FormLabel>
              <FormControl>
                <Textarea {...field} placeholder="Internal details about this account relationship..." className="min-h-[100px]" value={field.value || ""} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-end">
          <Button type="submit" disabled={isPending} data-testid="button-save-account">
            {isPending ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </Form>
  );
}

function NoteForm({ onSubmit, isPending }: { onSubmit: (data: any) => void, isPending: boolean }) {
  const form = useForm({
    resolver: zodResolver(createNoteSchema),
    defaultValues: {
      type: "general",
      content: "",
      isPinned: false
    }
  });

  const handleSubmit = (data: any) => {
    onSubmit(data);
    form.reset({ type: "general", content: "", isPinned: false });
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(handleSubmit)} className="space-y-4 bg-gray-50/50 p-4 rounded-xl border">
        <div className="flex gap-4 items-start">
          <div className="w-1/4">
            <FormField
              control={form.control}
              name="type"
              render={({ field }) => (
                <FormItem>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Type" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="general">General</SelectItem>
                      <SelectItem value="call">Call Log</SelectItem>
                      <SelectItem value="meeting">Meeting</SelectItem>
                      <SelectItem value="internal">Internal</SelectItem>
                    </SelectContent>
                  </Select>
                </FormItem>
              )}
            />
          </div>
          <div className="flex-1">
            <FormField
              control={form.control}
              name="content"
              render={({ field }) => (
                <FormItem>
                  <FormControl>
                    <Textarea {...field} placeholder="Type a note..." className="min-h-[80px] bg-white" data-testid="input-note-content" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        </div>
        <div className="flex items-center justify-between">
          <FormField
            control={form.control}
            name="isPinned"
            render={({ field }) => (
              <FormItem className="flex items-center space-x-2 space-y-0">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel className="text-sm font-normal">Pin this note</FormLabel>
              </FormItem>
            )}
          />
          <Button type="submit" disabled={isPending || !form.watch("content")} data-testid="button-submit-note">
            Add Note
          </Button>
        </div>
      </form>
    </Form>
  );
}

function ContactForm({ initialData, onSubmit, isPending }: { 
  initialData: any, 
  onSubmit: (data: any) => void, 
  isPending: boolean 
}) {
  const form = useForm({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      firstName: initialData?.firstName || "",
      lastName: initialData?.lastName || "",
      email: initialData?.email || "",
      phone: initialData?.phone || "",
      title: initialData?.title || "",
      preferredLanguage: initialData?.preferredLanguage || "es",
      isPrimary: initialData?.isPrimary || false,
    }
  });

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="firstName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>First Name</FormLabel>
                <FormControl><Input {...field} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="lastName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Last Name</FormLabel>
                <FormControl><Input {...field} value={field.value || ""} /></FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Email</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="phone"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Phone</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="title"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Title / Position</FormLabel>
              <FormControl><Input {...field} value={field.value || ""} /></FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <div className="flex justify-between items-center gap-4">
          <FormField
            control={form.control}
            name="preferredLanguage"
            render={({ field }) => (
              <FormItem className="flex-1">
                <FormLabel>Language</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Select" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="en">English</SelectItem>
                    <SelectItem value="es">Spanish</SelectItem>
                  </SelectContent>
                </Select>
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="isPrimary"
            render={({ field }) => (
              <FormItem className="flex flex-row items-center space-x-2 space-y-0 pt-6">
                <FormControl>
                  <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                </FormControl>
                <FormLabel>Primary Contact</FormLabel>
              </FormItem>
            )}
          />
        </div>
        <DialogFooter>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Saving..." : (initialData ? "Update Contact" : "Add Contact")}
          </Button>
        </DialogFooter>
      </form>
    </Form>
  );
}

function ActivityTimeline({ clientId, clientData }: { clientId: string, clientData: ClientProfile }) {
  const { data: history = [], isLoading } = useQuery<{
    id: string;
    event: string;
    entityType: string;
    entityId: string;
    userId: string | null;
    metadata: any;
    createdAt: string;
    user?: { name: string };
  }[]>({
    queryKey: ["/api/history/client", clientId],
  });

  if (isLoading) return <div className="space-y-4">
    {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-lg animate-pulse" />)}
  </div>;

  // Combine history with notes for a unified timeline
  const timelineItems: { id: string, date: Date, type: string, event: string, user: string, content: string, icon: JSX.Element, noteType?: string }[] = [
    ...history.map(h => ({
      id: h.id,
      date: new Date(h.createdAt),
      type: 'history',
      event: h.event,
      user: h.user?.name || 'System',
      content: getEventDescription(h),
      icon: getEventIcon(h.event),
    })),
    ...clientData.recentNotes.map(n => ({
      id: n.id,
      date: new Date(n.createdAt),
      type: 'note',
      event: 'note_added',
      user: n.user?.name || 'System',
      content: n.content,
      icon: <MessageSquare className="w-4 h-4 text-blue-500" />,
      noteType: n.type
    }))
  ];

  timelineItems.sort((a, b) => b.date.getTime() - a.date.getTime());

  return (
    <div className="relative space-y-4 before:absolute before:inset-0 before:ml-5 before:h-full before:w-0.5 before:bg-gray-100">
      {timelineItems.map((item, idx) => (
        <div key={item.id} className="relative pl-12">
          <div className="absolute left-0 mt-1 flex h-10 w-10 items-center justify-center rounded-full border bg-white ring-4 ring-white shadow-sm">
            {item.icon}
          </div>
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-gray-900">{item.user}</span>
              <span className="text-[10px] text-gray-500">{format(item.date, "MMM d, yyyy h:mm a")}</span>
            </div>
            <div className="mt-1 text-sm text-gray-600">
              {item.type === 'note' && (
                <div className="bg-gray-50 p-3 rounded-lg border">
                  <Badge variant="outline" className="text-[9px] mb-2">{item.noteType}</Badge>
                  <p className="line-clamp-3">{item.content}</p>
                </div>
              )}
              {item.type === 'history' && (
                <p>{item.content}</p>
              )}
            </div>
          </div>
        </div>
      ))}
      {timelineItems.length === 0 && (
        <p className="text-center py-8 text-gray-400">No activity recorded yet.</p>
      )}
    </div>
  );
}

function getEventIcon(event: string) {
  if (event.includes('status')) return <Clock className="w-4 h-4 text-amber-500" />;
  if (event.includes('contact')) return <Users className="w-4 h-4 text-blue-500" />;
  if (event.includes('onboarding')) return <CheckCircle className="w-4 h-4 text-emerald-500" />;
  return <History className="w-4 h-4 text-gray-400" />;
}

function getEventDescription(h: any) {
  const meta = h.metadata || {};
  if (h.event === 'client_status_updated') return `Status changed to ${meta.newStatus || 'unknown'}`;
  if (h.event === 'client_contact_added') return `New contact added: ${meta.contactName || 'unknown'}`;
  if (h.event === 'onboarding_started') return `Onboarding started: ${meta.recordName || 'unknown'}`;
  return h.event.replace(/_/g, ' ');
}
