import React, { useState, useEffect } from "react";
import { 
  ShieldCheck, 
  Briefcase, 
  Plus, 
  Pencil, 
  Trash2, 
  Search,
  ChevronRight,
  UserCheck,
  LayoutGrid
} from "lucide-react";
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle, 
  CardDescription 
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@/components/ui/tabs";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import api from "@/services/api";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { PageHeader } from "@/components/PageHeader";

// --- Types ---
interface Position {
  id: number;
  name: string;
  alias: string | null;
  level: number;
}

interface Responsibility {
  id: number;
  name: string;
}

// --- Schemas ---
const positionSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
  alias: z.string().optional().nullable(),
  level: z.coerce.number().min(1, "Level must be between 1 and 12").max(12),
});

const responsibilitySchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters"),
});

const PositionsResponsibilitiesPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState("positions");
  const [positions, setPositions] = useState<Position[]>([]);
  const [responsibilities, setResponsibilities] = useState<Responsibility[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Pagination states
  const [posPage, setPosPage] = useState(1);
  const [posTotal, setPosTotal] = useState(0);
  const [respPage, setRespPage] = useState(1);
  const [respTotal, setRespTotal] = useState(0);
  const PAGE_SIZE = 15;

  // Dialog states
  const [posDialogOpen, setPosDialogOpen] = useState(false);
  const [respDialogOpen, setRespDialogOpen] = useState(false);
  const [editingPos, setEditingPos] = useState<Position | null>(null);
  const [editingResp, setEditingResp] = useState<Responsibility | null>(null);

  // Forms
  const posForm = useForm<z.infer<typeof positionSchema>>({
    resolver: zodResolver(positionSchema),
    defaultValues: { name: "", alias: "", level: 1 },
  });

  const respForm = useForm<z.infer<typeof responsibilitySchema>>({
    resolver: zodResolver(responsibilitySchema),
    defaultValues: { name: "" },
  });

  // --- Fetching ---
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
    }, 500);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const fetchPositions = async (page = posPage, search = debouncedSearch) => {
    try {
      const res = await api.get("/positions/", {
        params: { page, search, page_size: PAGE_SIZE }
      });
      setPositions(res.data.results);
      setPosTotal(res.data.count);
    } catch (err) {
      toast.error("Failed to fetch positions");
    }
  };

  const fetchResponsibilities = async (page = respPage, search = debouncedSearch) => {
    try {
      const res = await api.get("/user-responsibilities/", {
        params: { page, search, page_size: PAGE_SIZE }
      });
      setResponsibilities(res.data.results);
      setRespTotal(res.data.count);
    } catch (err) {
      toast.error("Failed to fetch responsibilities");
    }
  };

  useEffect(() => {
    setLoading(true);
    if (activeTab === "positions") {
      fetchPositions(posPage, debouncedSearch).finally(() => setLoading(false));
    } else {
      fetchResponsibilities(respPage, debouncedSearch).finally(() => setLoading(false));
    }
  }, [activeTab, posPage, respPage, debouncedSearch]);

  // --- Handlers: Position ---
  const onPosSubmit = async (values: z.infer<typeof positionSchema>) => {
    try {
      if (editingPos) {
        await api.put(`/positions/${editingPos.id}/`, values);
        toast.success("Position updated successfully");
      } else {
        await api.post("/positions/", values);
        toast.success("Position created successfully");
      }
      setPosDialogOpen(false);
      fetchPositions();
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  const deletePos = async (id: number) => {
    if (!confirm("Are you sure you want to delete this position?")) return;
    try {
      await api.delete(`/positions/${id}/`);
      toast.success("Position deleted");
      fetchPositions();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  // --- Handlers: Responsibility ---
  const onRespSubmit = async (values: z.infer<typeof responsibilitySchema>) => {
    try {
      if (editingResp) {
        await api.put(`/user-responsibilities/${editingResp.id}/`, values);
        toast.success("Responsibility updated successfully");
      } else {
        await api.post("/user-responsibilities/", values);
        toast.success("Responsibility created successfully");
      }
      setRespDialogOpen(false);
      fetchResponsibilities();
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  const deleteResp = async (id: number) => {
    if (!confirm("Are you sure you want to delete this responsibility?")) return;
    try {
      await api.delete(`/user-responsibilities/${id}/`);
      toast.success("Responsibility deleted");
      fetchResponsibilities();
    } catch (err) {
      toast.error("Delete failed");
    }
  };

  // Filtered data is now handled by server-side search
  const filteredPositions = positions;
  const filteredResponsibilities = responsibilities;

  // Pagination Helper Component
  const PaginationControls = ({ 
    currentPage, 
    totalCount, 
    onPageChange 
  }: { 
    currentPage: number, 
    totalCount: number, 
    onPageChange: (p: number) => void 
  }) => {
    const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
    
    return (
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-[11px] text-slate-500 font-medium">
          Showing {totalCount > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
        </p>
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[10px] font-bold border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1 || loading}
          >
            &laquo; Prev
          </Button>
          
          {(() => {
            const pages = [];
            const maxVisible = 3;
            let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
            let end = Math.min(totalPages, start + maxVisible - 1);
            if (end - start + 1 < maxVisible) start = Math.max(1, end - maxVisible + 1);

            for (let i = start; i <= end; i++) {
              pages.push(
                <Button
                  key={i}
                  variant={currentPage === i ? "default" : "outline"}
                  size="sm"
                  className={`h-7 w-7 p-0 text-[10px] font-bold border-slate-200 ${currentPage === i
                    ? "bg-primary text-white hover:bg-primary/90 border-primary"
                    : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                    }`}
                  onClick={() => onPageChange(i)}
                  disabled={loading}
                >
                  {i}
                </Button>
              );
            }
            return pages;
          })()}

          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2 text-[10px] font-bold border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages || loading}
          >
            Next &raquo;
          </Button>
        </div>
      </div>
    );
  };

  return (
    <div className="p-6 space-y-6 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <PageHeader 
          title="Position and Responsibility" 
          subtitle="Manage organizational positions and user responsibilities." 
          icon={LayoutGrid} 
          iconColor="text-primary"
        />

        <div className="flex items-center gap-3">
          <div className="relative w-64">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input 
              placeholder="Search..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 bg-white shadow-sm border-slate-200"
            />
          </div>
          {activeTab === "positions" ? (
            <Button onClick={() => {
              setEditingPos(null);
              posForm.reset({ name: "", alias: "", level: 1 });
              setPosDialogOpen(true);
            }} className="shadow-md">
              <Plus className="h-4 w-4 mr-2" /> Add Position
            </Button>
          ) : (
            <Button onClick={() => {
              setEditingResp(null);
              respForm.reset({ name: "" });
              setRespDialogOpen(true);
            }} className="shadow-md">
              <Plus className="h-4 w-4 mr-2" /> Add Responsibility
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue="positions" className="w-full" onValueChange={setActiveTab}>
        <TabsList className="bg-slate-100/50 p-1 border border-slate-200">
          <TabsTrigger value="positions" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <Briefcase className="h-4 w-4 mr-2 opacity-70" />
            Positions (पद)
          </TabsTrigger>
          <TabsTrigger value="responsibilities" className="data-[state=active]:bg-white data-[state=active]:shadow-sm">
            <ShieldCheck className="h-4 w-4 mr-2 opacity-70" />
            Responsibilities (जिम्मेवारी)
          </TabsTrigger>
        </TabsList>

        <TabsContent value="positions" className="mt-4 space-y-4">
          <PaginationControls 
            currentPage={posPage} 
            totalCount={posTotal} 
            onPageChange={setPosPage} 
          />
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-primary hover:bg-primary">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[80px] py-3 text-white font-bold text-sm">SN</TableHead>
                  <TableHead className="py-3 text-white font-bold text-sm">Designation (पद)</TableHead>
                  <TableHead className="py-3 text-white font-bold text-sm">Alias (Nepali/Short)</TableHead>
                  <TableHead className="py-3 text-white font-bold text-sm">Level (तह)</TableHead>
                  <TableHead className="py-3 text-white font-bold text-sm text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredPositions.map((p, idx) => (
                  <TableRow key={p.id} className="hover:bg-slate-50/80 transition-colors border-slate-100">
                    <TableCell className="font-medium text-slate-400">{(posPage - 1) * PAGE_SIZE + idx + 1}</TableCell>
                    <TableCell className="font-semibold text-slate-700">{p.name}</TableCell>
                    <TableCell>
                      {p.alias ? (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-100 font-medium text-[10px] px-2 py-0.5">
                          {p.alias}
                        </Badge>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="bg-slate-100 text-slate-600 font-bold text-[10px] px-2 py-0.5">
                        Level {p.level}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingPos(p);
                            posForm.reset({ name: p.name, alias: p.alias || "", level: p.level });
                            setPosDialogOpen(true);
                          }}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deletePos(p.id)}
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredPositions.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="h-32 text-center text-muted-foreground italic font-medium">
                      No positions found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationControls 
              currentPage={posPage} 
              totalCount={posTotal} 
              onPageChange={setPosPage} 
            />
          </div>
        </TabsContent>

        <TabsContent value="responsibilities" className="mt-4 space-y-4">
          <PaginationControls 
            currentPage={respPage} 
            totalCount={respTotal} 
            onPageChange={setRespPage} 
          />
          <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
            <Table>
              <TableHeader className="bg-primary hover:bg-primary">
                <TableRow className="hover:bg-transparent border-none">
                  <TableHead className="w-[80px] py-3 text-white font-bold text-sm">SN</TableHead>
                  <TableHead className="py-3 text-white font-bold text-sm">Responsibility Name</TableHead>
                  <TableHead className="py-3 text-white font-bold text-sm text-right pr-6">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {loading ? (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center">
                      <div className="flex justify-center">
                        <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : filteredResponsibilities.map((r, idx) => (
                  <TableRow key={r.id} className="hover:bg-slate-50/80 transition-colors border-slate-100">
                    <TableCell className="font-medium text-slate-400">{(respPage - 1) * PAGE_SIZE + idx + 1}</TableCell>
                    <TableCell className="font-semibold text-slate-700 flex items-center gap-2 text-sm py-4">
                      <UserCheck className="h-4 w-4 text-primary/60" />
                      {r.name}
                    </TableCell>
                    <TableCell className="text-right pr-4">
                      <div className="flex justify-end gap-1">
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            setEditingResp(r);
                            respForm.reset({ name: r.name });
                            setRespDialogOpen(true);
                          }}
                          className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button 
                          variant="ghost" 
                          size="icon"
                          onClick={() => deleteResp(r.id)}
                          className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
                {!loading && filteredResponsibilities.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={3} className="h-32 text-center text-muted-foreground italic font-medium">
                      No responsibilities found.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            <PaginationControls 
              currentPage={respPage} 
              totalCount={respTotal} 
              onPageChange={setRespPage} 
            />
          </div>
        </TabsContent>
      </Tabs>

      {/* --- Position Dialog --- */}
      <Dialog open={posDialogOpen} onOpenChange={setPosDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <Briefcase className="h-5 w-5" />
              {editingPos ? "Edit Position" : "Create New Position"}
            </DialogTitle>
            <DialogDescription>
              Set the name, optional alias, and grade level for this designation.
            </DialogDescription>
          </DialogHeader>
          <Form {...posForm}>
            <form onSubmit={posForm.handleSubmit(onPosSubmit)} className="space-y-4 py-4">
              <FormField
                control={posForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Designation Name (English)</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Assistant Manager" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={posForm.control}
                name="alias"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Alias / Nepali Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. सहायक प्रबन्धक" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={posForm.control}
                name="level"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Level (1-12)</FormLabel>
                    <FormControl>
                      <Input type="number" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full sm:w-auto shadow-md">
                  {editingPos ? "Update Position" : "Create Position"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* --- Responsibility Dialog --- */}
      <Dialog open={respDialogOpen} onOpenChange={setRespDialogOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <ShieldCheck className="h-5 w-5" />
              {editingResp ? "Edit Responsibility" : "Create New Responsibility"}
            </DialogTitle>
            <DialogDescription>
              Define a new area of responsibility for system users.
            </DialogDescription>
          </DialogHeader>
          <Form {...respForm}>
            <form onSubmit={respForm.handleSubmit(onRespSubmit)} className="space-y-4 py-4">
              <FormField
                control={respForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Responsibility Title</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Shift In-charge" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <DialogFooter className="pt-4">
                <Button type="submit" className="w-full sm:w-auto shadow-md">
                  {editingResp ? "Update Responsibility" : "Create Responsibility"}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PositionsResponsibilitiesPage;
