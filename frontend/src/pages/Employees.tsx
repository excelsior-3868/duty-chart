import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCard, UserData } from "@/components/UserCard";
import { useAuth } from "@/context/AuthContext";

import { ChevronsUpDown, Check, Users, Search, Eye, EyeOff, Copy, KeyRound, Edit3, Trash2, RotateCw, Loader2, Plus } from 'lucide-react';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { createUser } from "@/services/users";
import { getPositions, type Position as PositionType } from "@/services/positions";
import { getDirectorates, type Directorate } from "@/services/directorates";
import { getDepartments, type Department } from "@/services/departments";
import { getOffices, type Office } from "@/services/offices";
import api from "@/services/api";
import { Protect } from "@/components/auth/Protect";
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
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

const Employees = () => {
  const { user } = useAuth();


  const queryClient = useQueryClient();

  // ---------------- Add Employee Card State ----------------
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  // Metadata is now fetched via React Query
  // const [positions, setPositions] = useState<PositionType[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  // const [directorates, setDirectorates] = useState<Directorate[]>([]);
  // const [departments, setDepartments] = useState<Department[]>([]);
  // const [offices, setOffices] = useState<Office[]>([]);
  const [selectedDirectorate, setSelectedDirectorate] = useState<number | null>(null);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [filteredOffices, setFilteredOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<number | null>(null);
  const [selectedSecondaryOffice, setSelectedSecondaryOffice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openOfficeCombobox, setOpenOfficeCombobox] = useState(false);

  // Password generator / reveal-once state
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [revealedOnce, setRevealedOnce] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // -------- Professional Table State --------
  // const [employeesList, setEmployeesList] = useState<any[]>([]);
  // const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [editOfficeOpen, setEditOfficeOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [roles, setRoles] = useState<Array<{ id: number; slug: string; name: string }>>([]);
  const [rolePermsPreview, setRolePermsPreview] = useState<string[]>([]);

  // Pagination & Search
  const [nameQuery, setNameQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const PAGE_SIZE = 15;

  const [debouncedQuery, setDebouncedQuery] = useState("");

  // Debounce the search query
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(nameQuery);
      if (nameQuery !== debouncedQuery) {
        setCurrentPage(1);
      }
    }, 500);
    return () => clearTimeout(handler);
  }, [nameQuery]);

  // --- React Query: Fetch Employees ---
  const { data: employeesData, isLoading: loadingEmployees } = useQuery({
    queryKey: ['users', currentPage, debouncedQuery],
    queryFn: async () => {
      const queryParams = new URLSearchParams();
      queryParams.append("page", String(currentPage));
      queryParams.append("page_size", String(PAGE_SIZE));
      if (debouncedQuery) queryParams.append("search", debouncedQuery);
      const res = await api.get(`/users/?${queryParams.toString()}`);
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const employeesList = useMemo(() => {
    if (!employeesData) return [];
    if (employeesData.results) return employeesData.results;
    if (Array.isArray(employeesData)) return employeesData;
    return [];
  }, [employeesData]);

  const totalCount = useMemo(() => {
    if (!employeesData) return 0;
    if (employeesData.count) return employeesData.count;
    if (Array.isArray(employeesData)) return employeesData.length;
    return 0;
  }, [employeesData]);

  const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;

  // --- React Query: Meta Data ---
  const { data: directorates = [] } = useQuery({
    queryKey: ['directorates', 'all'],
    queryFn: () => getDirectorates({ all: true }) as Promise<Directorate[]>,
    staleTime: 15 * 60 * 1000,
  });

  const { data: departments = [] } = useQuery({
    queryKey: ['departments', 'all'],
    queryFn: () => getDepartments(),
    staleTime: 15 * 60 * 1000,
  });

  const { data: offices = [] } = useQuery({
    queryKey: ['offices', 'all'],
    queryFn: () => getOffices(),
    staleTime: 15 * 60 * 1000,
  });

  const { data: positions = [] } = useQuery({
    queryKey: ['positions', 'all'],
    queryFn: () => getPositions(),
    staleTime: 15 * 60 * 1000,
  });

  const metaLoading = !directorates.length && !departments.length && !offices.length && !positions.length;



  // Helper to get ID from nested object or raw ID
  function getIdFromField(field: any): number | null {
    if (field === null || field === undefined) return null;
    if (typeof field === "number") return field;
    if (typeof field === "string") {
      const parsed = parseInt(field, 10);
      return isNaN(parsed) ? null : parsed;
    }
    if (typeof field === "object" && field.id) return Number(field.id);
    return null;
  }

  // Helper to get name from nested object or raw value
  function getNameFromField(field: any): string {
    if (!field) return "-";
    if (typeof field === "string") return field;
    if (typeof field === "object" && field.name) return field.name;
    if (typeof field === "number") return String(field);
    return "-";
  }

  // Helper to get department name from ID or object
  function getDepartmentName(deptIdOrObj: any): string {
    if (!deptIdOrObj) return "-";
    const deptId = typeof deptIdOrObj === "object" ? deptIdOrObj.id : deptIdOrObj;
    const dept = departments.find((d) => d.id === deptId);
    return dept ? dept.name : String(deptIdOrObj);
  }

  // Helper to get position name from ID or object
  function getPositionName(posIdOrObj: any): string {
    if (!posIdOrObj) return "-";
    const posId = typeof posIdOrObj === "object" ? posIdOrObj.id : posIdOrObj;
    const pos = positions.find((p) => p.id === posId);
    return pos ? pos.name : String(posIdOrObj);
  }

  // Open edit modal
  function openEditModal(emp: any) {
    setSelectedEmployee({
      id: emp.id,
      full_name: emp.full_name || "",
      employee_id: emp.employee_id || "",
      email: emp.email || "",
      phone_number: emp.phone_number || "",
      directorate: getIdFromField(emp.directorate),
      department: getIdFromField(emp.department),
      office: getIdFromField(emp.office),
      position: getIdFromField(emp.position),
      role: emp.role || "USER",
      is_active: emp.is_active ?? true,
    });
    setEditModalOpen(true);
    // Lazy load roles and preview perms
    (async () => {
      try {
        const rRes = await api.get("/roles/");
        const rList = Array.isArray(rRes.data) ? rRes.data : (rRes.data.results || rRes.data);
        setRoles(rList || []);
        const r = (rList || []).find((x: any) => x.slug === (emp.role || "USER"));
        if (r?.id) {
          const pRes = await api.get(`/roles/${r.id}/permissions/`);
          const slugs: string[] = pRes.data?.permissions || [];
          setRolePermsPreview(slugs);
        } else {
          setRolePermsPreview([]);
        }
      } catch {
        setRolePermsPreview([]);
      }
    })();
  }

  const [editSubmitConfirmOpen, setEditSubmitConfirmOpen] = useState(false);

  // Submit edit
  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee?.id) return;
    setEditSubmitConfirmOpen(true);
  }

  async function confirmEditEmployee() {
    if (!selectedEmployee?.id) return;
    try {
      const payload = {
        full_name: selectedEmployee.full_name,
        employee_id: selectedEmployee.employee_id,
        email: selectedEmployee.email,
        phone_number: selectedEmployee.phone_number || undefined,
        // directorate and department removed as per new requirements
        office: selectedEmployee.office || undefined,
        position: selectedEmployee.position || undefined,
        role: selectedEmployee.role || undefined,
        is_active: selectedEmployee.is_active,
      };
      console.log("Submit payload:", payload);
      const res = await api.put(`/users/${selectedEmployee.id}/`, payload);
      console.log("Update response:", res.data);
      toast.success("Employee updated successfully!");
      setEditModalOpen(false);
      setEditSubmitConfirmOpen(false);
      setSelectedEmployee(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
      // Invalidate if needed: queryClient.invalidateQueries({ queryKey: ['positions'] }); // if new position added inline? unlikely

    } catch (err: any) {
      console.error("Update error:", err);
      console.error("Error response:", err?.response?.data);
      const errorMsg = err?.response?.data?.detail || err?.response?.data?.message || "Failed to update employee.";
      toast.error(String(errorMsg));
    }
  }

  // Open delete confirm
  function openDeleteConfirm(emp: any) {
    setSelectedEmployee(emp);
    setDeleteConfirmOpen(true);
  }

  // Confirm delete
  async function confirmDelete() {
    if (!selectedEmployee?.id) return;
    try {
      await api.delete(`/users/${selectedEmployee.id}/`);
      toast.success("Employee deleted");
      setDeleteConfirmOpen(false);
      setSelectedEmployee(null);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete employee.");
    }
  }

  // Load org hierarchy lists and positions in parallel
  useEffect(() => {
    document.title = "Employees - NT Duty Chart Management";
  }, []);

  useEffect(() => {
    // Filter departments by directorate
    if (selectedDirectorate) {
      const f = departments.filter((d) => (d as any).directorate === selectedDirectorate);
      setFilteredDepartments(f);
      // reset downstream selections
      setSelectedDepartment(null);
      setFilteredOffices([]);
      setSelectedOffice(null);
      setSelectedSecondaryOffice(null);
    } else {
      setFilteredDepartments([]);
      setFilteredOffices([]);
      setSelectedDepartment(null);
      setSelectedOffice(null);
      setSelectedSecondaryOffice(null);
    }
  }, [selectedDirectorate, departments]);

  useEffect(() => {
    // Filter offices by department
    if (selectedDepartment) {
      const f = offices.filter((o) => (o as any).department === selectedDepartment);
      setFilteredOffices(f);
      setSelectedOffice(null);
      setSelectedSecondaryOffice(null);
    } else {
      setFilteredOffices([]);
      setSelectedOffice(null);
      setSelectedSecondaryOffice(null);
    }
  }, [selectedDepartment, offices]);

  // If secondary office equals primary after change, clear it
  useEffect(() => {
    if (selectedSecondaryOffice && selectedOffice === selectedSecondaryOffice) {
      setSelectedSecondaryOffice(null);
    }
  }, [selectedOffice, selectedSecondaryOffice]);

  function generatePassword() {
    const length = 12;
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
    let pwd = "";
    for (let i = 0; i < length; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    setGeneratedPassword(pwd);
    setShowPassword(false);
    setRevealedOnce(false);
  }

  async function copyPassword() {
    if (!generatedPassword) {
      toast.info("Generate a password first.");
      return;
    }
    try {
      const canUseClipboard = typeof navigator !== "undefined" && navigator.clipboard && (window as any).isSecureContext;
      if (canUseClipboard) {
        await navigator.clipboard.writeText(generatedPassword);
      } else {
        const ta = document.createElement("textarea");
        ta.value = generatedPassword;
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.focus();
        ta.select();
        const ok = document.execCommand("copy");
        document.body.removeChild(ta);
        if (!ok) throw new Error("copy_failed");
      }
      toast.success("Password copied to clipboard.");
      // After copying, hide again (optional UX)
      setShowPassword(false);
    } catch (err) {
      toast.error("Failed to copy password.");
    }
  }

  function revealOnce() {
    if (!generatedPassword) {
      toast.info("Generate a password first.");
      return;
    }
    if (revealedOnce) {
      toast.warning("Password can be revealed only once.");
      return;
    }
    setShowPassword(true);
    setRevealedOnce(true);
  }

  const [createConfirmOpen, setCreateConfirmOpen] = useState(false);

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !employeeId || !email) {
      toast.error("Full name, Employee ID and Email are required.");
      return;
    }
    if (!selectedOffice) {
      toast.error("Select office.");
      return;
    }
    if (!selectedPosition) {
      toast.error("Select designation / position.");
      return;
    }
    setCreateConfirmOpen(true);
  }

  async function confirmCreateEmployee() {
    setSubmitting(true);
    try {
      // Generate a random password since UI is removed
      const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%^&*";
      let autoPassword = "";
      for (let i = 0; i < 14; i++) {
        autoPassword += chars[Math.floor(Math.random() * chars.length)];
      }

      // Backend model labels: full_name, employee_id, phone_number, directorate, department, office, position (optional)
      const payload: any = {
        full_name: fullName,
        employee_id: employeeId,
        email,
        username: employeeId, // keep username populated; login is via email
        phone_number: phoneNumber || undefined,
        // directorate and department removed
        office: selectedOffice,
        position: selectedPosition,
        is_active: true,
        password: autoPassword,
      };

      await createUser(payload);
      toast.success("Employee created successfully.");
      // Reset form
      setFullName("");
      setEmployeeId("");
      setEmail("");
      setPhoneNumber("");
      setSelectedPosition(null);
      setSelectedDirectorate(null);
      setSelectedDepartment(null);
      setSelectedOffice(null);
      setSelectedSecondaryOffice(null);
      setSelectedSecondaryOffice(null);
      setGeneratedPassword("");
      setShowPassword(false);
      setRevealedOnce(false);
      setCreateModalOpen(false);
      setCreateConfirmOpen(false);
      queryClient.invalidateQueries({ queryKey: ['users'] });
    } catch (err: any) {
      console.error(err);
      const msg = err?.response?.data?.detail || "Failed to create employee.";
      toast.error(String(msg));
    } finally {
      setSubmitting(false);
    }
  }


  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-primary">Employees</h1>
          <p className="text-muted-foreground">Manage employee records and information across all departments.</p>
        </div>
        <div>
          <Protect permission="users.create_employee">
            <Button onClick={() => setCreateModalOpen(true)} className="gap-2 shadow-sm">
              <Plus className="h-4 w-4" /> Add Employee
            </Button>
          </Protect>
        </div>
      </div>
      {/* Create Employee Modal */}
      <Dialog open={createModalOpen} onOpenChange={setCreateModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Employee</DialogTitle>
            <DialogDescription>
              Create New User and Generate a One-time Password.
            </DialogDescription>
          </DialogHeader>

          {/* Mini steps / hints */}
          <div className="grid gap-6 md:grid-cols-2 mt-4">
            {/* Step 1: Identity */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Step 1: Identity</div>
              <div className="space-y-2">
                <Label htmlFor="full_name">Full Name</Label>
                <Input id="full_name" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="e.g. Ram Sharma" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="employee_id">Employee ID</Label>
                <Input id="employee_id" value={employeeId} onChange={(e) => setEmployeeId(e.target.value)} placeholder="e.g. 7816" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@ntc.net.np" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number</Label>
                <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="98XXXXXXXX" />
              </div>
              <div className="space-y-2">
                <Label>Designation / Position</Label>
                <Select value={selectedPosition ? String(selectedPosition) : undefined} onValueChange={(v) => setSelectedPosition(Number(v))}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positions.length === 0 ? (
                      <SelectItem value="no-positions" disabled>No positions found</SelectItem>
                    ) : (
                      positions.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Step 2: Organization placement */}
            {/* Step 2: Organization placement */}
            <div className="space-y-3">
              <div className="text-sm font-medium">Step 2: Organization</div>
              <div className="space-y-2">
                <Label>Office</Label>
                <Popover open={openOfficeCombobox} onOpenChange={setOpenOfficeCombobox}>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      role="combobox"
                      aria-expanded={openOfficeCombobox}
                      className="w-full justify-between font-normal"
                    >
                      {selectedOffice
                        ? offices.find((o) => o.id === selectedOffice)?.name
                        : "Select office"}
                      <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-[400px] p-0">
                    <Command>
                      <CommandInput placeholder="Search office..." />
                      <CommandList>
                        <CommandEmpty>No office found.</CommandEmpty>
                        <CommandGroup>
                          {offices.map((o) => (
                            <CommandItem
                              key={o.id}
                              value={o.name}
                              onSelect={() => {
                                setSelectedOffice(o.id);
                                setOpenOfficeCombobox(false);
                              }}
                            >
                              <Check
                                className={cn(
                                  "mr-2 h-4 w-4",
                                  selectedOffice === o.id ? "opacity-100" : "opacity-0"
                                )}
                              />
                              {o.name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>

            </div>
          </div>
          {/* Bottom-right action */}
          <div className="mt-6 flex justify-end">
            <Button onClick={handleCreateEmployee} disabled={submitting}>
              {submitting ? "Creating..." : "Create Employee"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Filter Card */}
      <Card className="border-none shadow-sm bg-white">
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-4 justify-between items-center">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by Name, ID, Mobile, Email, Office, or Status..."
                className="pl-9 bg-slate-50/50 border-slate-200 focus-visible:ring-primary h-11"
                value={nameQuery}
                onChange={(e) => setNameQuery(e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Employee List */}
      {/* Employee List */}
      <div className="space-y-1">
        {/* Pagination Controls (Top) */}
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-slate-500 font-medium">
            Showing {employeesList.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loadingEmployees}
            >
              &laquo; Prev
            </Button>

            {/* Page Numbers */}
            {(() => {
              const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
              const pages = [];
              const maxVisible = 5;
              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              let end = Math.min(totalPages, start + maxVisible - 1);

              if (end - start + 1 < maxVisible) {
                start = Math.max(1, end - maxVisible + 1);
              }

              for (let i = start; i <= end; i++) {
                pages.push(
                  <Button
                    key={i}
                    variant={currentPage === i ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 p-0 text-xs font-medium border-slate-200 ${currentPage === i
                      ? "bg-primary text-white hover:bg-primary/90 border-primary"
                      : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    onClick={() => setCurrentPage(i)}
                    disabled={loadingEmployees}
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
              className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCount / PAGE_SIZE) || 1, p + 1))}
              disabled={currentPage === (Math.ceil(totalCount / PAGE_SIZE) || 1) || loadingEmployees}
            >
              Next &raquo;
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
          <Table>
            <TableHeader className="bg-primary hover:bg-primary">
              <TableRow className="hover:bg-transparent border-none">
                <TableHead className="w-[100px] py-3 text-white font-bold text-sm">ID</TableHead>
                <TableHead className="py-3 text-white font-bold text-sm">Full Name</TableHead>
                <TableHead className="py-3 text-white font-bold text-sm">Mobile</TableHead>
                <TableHead className="py-3 text-white font-bold text-sm">Email</TableHead>
                <TableHead className="py-3 text-white font-bold text-sm">Office</TableHead>
                <TableHead className="py-3 text-white font-bold text-sm">Status</TableHead>
                <TableHead className="py-3 text-white font-bold text-sm text-right pr-6">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(loadingEmployees || metaLoading) ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-24 text-center">
                    <div className="flex justify-center items-center">
                      <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    </div>
                  </TableCell>
                </TableRow>
              ) : employeesList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="p-12 text-center text-muted-foreground font-medium italic">
                    No employees found for the search criteria.
                  </TableCell>
                </TableRow>
              ) : (
                employeesList.map((emp) => (
                  <TableRow key={emp.id} className="hover:bg-slate-50/80 transition-colors border-slate-100">
                    <TableCell className="font-mono text-xs font-bold text-primary">
                      {emp.employee_id || "-"}
                    </TableCell>
                    <TableCell className="font-medium text-slate-800 text-sm">
                      {emp.full_name || emp.username || "-"}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {emp.phone_number || "-"}
                    </TableCell>
                    <TableCell className="text-slate-600 text-sm">
                      {emp.email || "-"}
                    </TableCell>
                    <TableCell className="text-slate-700 font-medium text-sm">
                      {emp.office_name || offices.find(o => o.id === getIdFromField(emp.office))?.name || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={emp.is_active ? "default" : "secondary"} className="text-[10px] font-bold px-2 py-0.5 h-5 w-fit">
                        {emp.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => { setSelectedEmployee(emp); setViewModalOpen(true); }} title="View Details">
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Protect permission="users.edit_employee">
                          {(user?.role === 'SUPERADMIN' || (user?.office_id && getIdFromField(emp.office) === user.office_id)) && (
                            <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-primary/10 hover:text-primary transition-colors" onClick={() => openEditModal(emp)} title="Edit Employee">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          )}
                        </Protect>
                        <Protect permission="users.delete_employee">
                          <Button size="icon" variant="ghost" className="h-8 w-8 hover:bg-destructive/10 hover:text-destructive transition-colors" onClick={() => openDeleteConfirm(emp)} title="Delete Employee">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </Protect>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination Controls (Bottom) */}
        <div className="flex items-center justify-between px-2">
          <p className="text-xs text-slate-500 font-medium">
            Showing {employeesList.length > 0 ? (currentPage - 1) * PAGE_SIZE + 1 : 0} to {Math.min(currentPage * PAGE_SIZE, totalCount)} of {totalCount} entries
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage === 1 || loadingEmployees}
            >
              &laquo; Prev
            </Button>

            {/* Page Numbers */}
            {(() => {
              const totalPages = Math.ceil(totalCount / PAGE_SIZE) || 1;
              const pages = [];
              const maxVisible = 5;
              let start = Math.max(1, currentPage - Math.floor(maxVisible / 2));
              let end = Math.min(totalPages, start + maxVisible - 1);

              if (end - start + 1 < maxVisible) {
                start = Math.max(1, end - maxVisible + 1);
              }

              for (let i = start; i <= end; i++) {
                pages.push(
                  <Button
                    key={i}
                    variant={currentPage === i ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 p-0 text-xs font-medium border-slate-200 ${currentPage === i
                      ? "bg-primary text-white hover:bg-primary/90 border-primary"
                      : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    onClick={() => setCurrentPage(i)}
                    disabled={loadingEmployees}
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
              className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setCurrentPage((p) => Math.min(Math.ceil(totalCount / PAGE_SIZE) || 1, p + 1))}
              disabled={currentPage === (Math.ceil(totalCount / PAGE_SIZE) || 1) || loadingEmployees}
            >
              Next &raquo;
            </Button>
          </div>
        </div>
      </div>

      {/* View Details Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Employee Details</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <div className="grid grid-cols-2 gap-4 py-4 text-sm">
              <div>
                <Label className="text-muted-foreground">Full Name</Label>
                <div className="font-medium text-base">{selectedEmployee.full_name || selectedEmployee.username}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Employee ID</Label>
                <div className="font-medium text-base">{selectedEmployee.employee_id}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Email</Label>
                <div className="font-medium">{selectedEmployee.email}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Phone</Label>
                <div className="font-medium">{selectedEmployee.phone_number || "-"}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Position</Label>
                <div className="font-medium">{getPositionName(selectedEmployee.position)}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Office</Label>
                <div className="font-medium">
                  {selectedEmployee.office_name || offices.find(o => o.id === getIdFromField(selectedEmployee.office))?.name || "-"}
                </div>
              </div>

              <div>
                <Label className="text-muted-foreground">Role</Label>
                <div className="font-medium">{selectedEmployee.role}</div>
              </div>
              <div>
                <Label className="text-muted-foreground">Status</Label>
                <Badge className={selectedEmployee.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                  {selectedEmployee.is_active ? "Active" : "Inactive"}
                </Badge>
              </div>
              <div>
                <Label className="text-muted-foreground">Joined</Label>
                <div className="font-medium">{selectedEmployee.date_joined ? new Date(selectedEmployee.date_joined).toLocaleDateString() : "-"}</div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>


      {/* Edit Modal */}
      <Dialog open={editModalOpen} onOpenChange={setEditModalOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Edit Employee</DialogTitle>
          </DialogHeader>
          {selectedEmployee && (
            <form onSubmit={submitEdit} className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label>Full Name</Label>
                  <Input value={selectedEmployee.full_name} onChange={(e) => setSelectedEmployee({ ...selectedEmployee, full_name: e.target.value })} />
                </div>
                <div>
                  <Label>Employee ID</Label>
                  <Input value={selectedEmployee.employee_id} onChange={(e) => setSelectedEmployee({ ...selectedEmployee, employee_id: e.target.value })} />
                </div>
                <div>
                  <Label>Email</Label>
                  <Input type="email" value={selectedEmployee.email} onChange={(e) => setSelectedEmployee({ ...selectedEmployee, email: e.target.value })} />
                </div>
                <div>
                  <Label>Phone</Label>
                  <Input value={selectedEmployee.phone_number} onChange={(e) => setSelectedEmployee({ ...selectedEmployee, phone_number: e.target.value })} />
                </div>

                <div>
                  <Label>Office</Label>
                  <Popover open={editOfficeOpen} onOpenChange={setEditOfficeOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        role="combobox"
                        aria-expanded={editOfficeOpen}
                        className="w-full justify-between font-normal"
                      >
                        {selectedEmployee.office
                          ? (selectedEmployee.office_name || offices.find((o) => o.id === getIdFromField(selectedEmployee.office))?.name)
                          : "Select office"}
                        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[400px] p-0">
                      <Command>
                        <CommandInput placeholder="Search office..." />
                        <CommandList>
                          <CommandEmpty>No office found.</CommandEmpty>
                          <CommandGroup>
                            {offices.map((o) => (
                              <CommandItem
                                key={o.id}
                                value={o.name}
                                onSelect={() => {
                                  setSelectedEmployee({ ...selectedEmployee, office: o.id });
                                  setEditOfficeOpen(false);
                                }}
                              >
                                <Check
                                  className={cn(
                                    "mr-2 h-4 w-4",
                                    selectedEmployee.office === o.id ? "opacity-100" : "opacity-0"
                                  )}
                                />
                                {o.name}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </div>

                <div>
                  <Label>Position</Label>
                  <Select value={selectedEmployee.position ? String(selectedEmployee.position) : ""} onValueChange={(v) => setSelectedEmployee({ ...selectedEmployee, position: Number(v) })}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select position" />
                    </SelectTrigger>
                    <SelectContent>
                      {positions.map((p) => <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>

                {user?.role === 'SUPERADMIN' && (
                  <div className="flex items-center gap-2">
                    <Label>Active</Label>
                    <input type="checkbox" checked={!!selectedEmployee.is_active} onChange={(e) => setSelectedEmployee({ ...selectedEmployee, is_active: e.target.checked })} className="w-4 h-4" />
                  </div>
                )}
              </div>

              {user?.role === 'SUPERADMIN' && (
                <div className="space-y-4">
                  <h4 className="text-md font-semibold">Access Control</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label>Role</Label>
                      <Select value={selectedEmployee.role || ""} onValueChange={async (v) => {
                        setSelectedEmployee({ ...selectedEmployee, role: v });
                        const r = roles.find((x: any) => x.slug === v);
                        if (r?.id) {
                          try {
                            const pRes = await api.get(`/roles/${r.id}/permissions/`);
                            setRolePermsPreview(pRes.data?.permissions || []);
                          } catch {
                            setRolePermsPreview([]);
                          }
                        } else {
                          setRolePermsPreview([]);
                        }
                      }}>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          {(roles.length ? roles : [
                            { slug: "SUPERADMIN", name: "Super Admin" }, { slug: "OFFICE_ADMIN", name: "Office Admin" }, { slug: "USER", name: "User" }
                          ]).map((r: any) => (
                            <SelectItem key={r.slug} value={r.slug}>{r.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Effective Permissions (by role)</Label>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {(rolePermsPreview || []).map((p) => <Badge key={p} variant="secondary">{p}</Badge>)}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-4">
                <Button type="button" variant="outline" onClick={() => { setEditModalOpen(false); setSelectedEmployee(null); }}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      {
        deleteConfirmOpen && selectedEmployee && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
            <div className="bg-white p-6 rounded-lg shadow-lg w-full max-w-md">
              <h3 className="text-lg font-semibold mb-2">Confirm Delete</h3>
              <p className="text-muted-foreground mb-6">
                Are you sure you want to delete this employee <strong>{selectedEmployee.full_name || selectedEmployee.employee_id}</strong>? This action cannot be undone.
              </p>
              <div className="flex justify-end gap-2">
                <Button variant="outline" onClick={() => { setDeleteConfirmOpen(false); setSelectedEmployee(null); }}>Cancel</Button>
                <Button variant="destructive" onClick={confirmDelete}>Delete</Button>
              </div>
            </div>
          </div>
        )
      }

      {/* Create Confirmation Modal */}
      <Dialog open={createConfirmOpen} onOpenChange={setCreateConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Creation</DialogTitle>
            <DialogDescription>
              Are you sure you want to create this new employee?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setCreateConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmCreateEmployee} disabled={submitting}>
              {submitting ? "Creating..." : "Confirm Create"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Confirmation Modal */}
      <Dialog open={editSubmitConfirmOpen} onOpenChange={setEditSubmitConfirmOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Confirm Updates</DialogTitle>
            <DialogDescription>
              Are you sure you want to save changes for <strong>{selectedEmployee?.full_name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setEditSubmitConfirmOpen(false)}>Cancel</Button>
            <Button onClick={confirmEditEmployee}>
              Confirm Save
            </Button>
          </div>
        </DialogContent>
      </Dialog>

    </div >
  );
};

export default Employees;
