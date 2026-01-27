import { useEffect, useMemo, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { UserCard, UserData } from "@/components/UserCard";
import { Users, Search, Eye, EyeOff, Copy, KeyRound, Edit3, Trash2 } from 'lucide-react';
import { toast } from "sonner";
import { createUser } from "@/services/users";
import { getPositions, type Position as PositionType } from "@/services/positions";
import { getDirectorates, type Directorate } from "@/services/directorates";
import { getDepartments, type Department } from "@/services/departments";
import { getOffices, type Office } from "@/services/offices";
import api from "@/services/api";
import { Protect } from "@/components/auth/Protect";

const Employees = () => {
  const employees: UserData[] = [
    {
      id: 1,
      name: "Ram Sharma",
      position: "Network Engineer",
      department: "Technical",
      employeeId: "EMP001",
      status: "active",
      phone: "+977-9841234567",
      email: "ram.sharma@ntc.net.np",
      location: "Central Office",
      joinDate: "Jan 2022"
    },
    {
      id: 2,
      name: "Sita Karki",
      position: "Customer Service Representative",
      department: "Customer Service",
      employeeId: "EMP002",
      status: "active",
      phone: "+977-9841234568",
      email: "sita.karki@ntc.net.np",
      location: "Call Center",
      joinDate: "Mar 2021"
    },
    {
      id: 3,
      name: "Hari Thapa",
      position: "Field Technician",
      department: "Maintenance",
      employeeId: "EMP003",
      status: "on_leave",
      phone: "+977-9841234569",
      email: "hari.thapa@ntc.net.np",
      location: "Field Office",
      joinDate: "Jul 2020"
    },
    {
      id: 4,
      name: "Maya Gurung",
      position: "Supervisor",
      department: "Operations",
      employeeId: "EMP004",
      status: "active",
      phone: "+977-9841234570",
      email: "maya.gurung@ntc.net.np",
      location: "Main Office",
      joinDate: "Sep 2019"
    }
  ];

  // ---------------- Add Employee Card State ----------------
  const [fullName, setFullName] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [email, setEmail] = useState("");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [positions, setPositions] = useState<PositionType[]>([]);
  const [selectedPosition, setSelectedPosition] = useState<number | null>(null);
  const [directorates, setDirectorates] = useState<Directorate[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [selectedDirectorate, setSelectedDirectorate] = useState<number | null>(null);
  const [filteredDepartments, setFilteredDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<number | null>(null);
  const [filteredOffices, setFilteredOffices] = useState<Office[]>([]);
  const [selectedOffice, setSelectedOffice] = useState<number | null>(null);
  const [selectedSecondaryOffice, setSelectedSecondaryOffice] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Password generator / reveal-once state
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [revealedOnce, setRevealedOnce] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // -------- Professional Table State --------
  const [employeesList, setEmployeesList] = useState<any[]>([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<any | null>(null);
  const [roles, setRoles] = useState<Array<{ id: number; slug: string; name: string }>>([]);
  const [rolePermsPreview, setRolePermsPreview] = useState<string[]>([]);
  const [nameQuery, setNameQuery] = useState("");
  const filteredEmployees = useMemo(() => {
    const q = nameQuery.trim().toLowerCase();
    if (!q) return employeesList;
    return (employeesList || []).filter((emp) => {
      const name = emp.full_name || emp.username || "";
      return String(name).toLowerCase().includes(q);
    });
  }, [employeesList, nameQuery]);

  // Fetch employees from backend
  async function fetchEmployees() {
    setLoadingEmployees(true);
    try {
      const res = await api.get("/users/?page_size=1000");
      const list = Array.isArray(res.data) ? res.data : (res.data.results || res.data);
      setEmployeesList(list || []);
    } catch (err) {
      console.error("Failed to load employees", err);
      toast.error("Failed to load employees from backend.");
    } finally {
      setLoadingEmployees(false);
    }
  }

  // Helper to get ID from nested object or raw ID
  function getIdFromField(field: any): number | null {
    if (!field) return null;
    if (typeof field === "number") return field;
    if (typeof field === "object" && field.id) return field.id;
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

  // Submit edit
  async function submitEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedEmployee?.id) return;
    try {
      const payload = {
        full_name: selectedEmployee.full_name,
        employee_id: selectedEmployee.employee_id,
        email: selectedEmployee.email,
        phone_number: selectedEmployee.phone_number || undefined,
        directorate: selectedEmployee.directorate || undefined,
        department: selectedEmployee.department || undefined,
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
      setSelectedEmployee(null);
      fetchEmployees();
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
      fetchEmployees();
    } catch (err) {
      console.error("Delete failed", err);
      toast.error("Failed to delete employee.");
    }
  }

  useEffect(() => {
    // Load org hierarchy lists and employees
    document.title = "Employees - INOC Duty Roster";
    async function loadOrg() {
      try {
        const [d1, d2, d3] = await Promise.all([
          getDirectorates(),
          getDepartments(),
          getOffices(),
        ]);
        setDirectorates(d1);
        setDepartments(d2);
        setOffices(d3);
      } catch (err) {
        console.error("Failed to load org lists", err);
        toast.error("Failed to load organization lists.");
      }
    }
    loadOrg();
    fetchEmployees();
  }, []);

  useEffect(() => {
    async function loadPositions() {
      try {
        const list = await getPositions();
        setPositions(list);
      } catch (err) {
        console.error("Failed to load positions", err);
        toast.error("Failed to load positions.");
      }
    }
    loadPositions();
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

  async function handleCreateEmployee(e: React.FormEvent) {
    e.preventDefault();
    if (!fullName || !employeeId || !email) {
      toast.error("Full name, Employee ID and Email are required.");
      return;
    }
    if (!selectedDirectorate || !selectedDepartment || !selectedOffice) {
      toast.error("Select directorate, department and office.");
      return;
    }
    if (!selectedPosition) {
      toast.error("Select designation / position.");
      return;
    }
    if (!generatedPassword) {
      toast.error("Generate a temporary password.");
      return;
    }

    setSubmitting(true);
    try {
      // Backend model labels: full_name, employee_id, phone_number, directorate, department, office, position (optional)
      const payload: any = {
        full_name: fullName,
        employee_id: employeeId,
        email,
        username: employeeId, // keep username populated; login is via email
        phone_number: phoneNumber || undefined,
        directorate: selectedDirectorate,
        department: selectedDepartment,
        office: selectedOffice,
        position: selectedPosition,
        is_active: true,
        password: generatedPassword,
      };

      if (selectedSecondaryOffice) {
        payload.secondary_offices = [selectedSecondaryOffice];
      }

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
      setGeneratedPassword("");
      setShowPassword(false);
      setRevealedOnce(false);
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
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">Employees</h1>
          <p className="text-muted-foreground">Manage employee records and information</p>
        </div>
      </div>

      {/* Add Employee Card */}
      <Protect permission="users.create_employee">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              Add Employee
            </CardTitle>
            <CardDescription>
              Create New User and Generate a One-time Password.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {/* Mini steps / hints */}
            <div className="grid gap-6 md:grid-cols-3">
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
                  <Input id="phone" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} placeholder="+977-98XXXXXXXX" />
                </div>
                <div className="space-y-2">
                  <Label>Designation / Position</Label>
                  <Select value={selectedPosition ? String(selectedPosition) : undefined} onValueChange={(v) => setSelectedPosition(Number(v))} disabled={!selectedOffice}>
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
              <div className="space-y-3">
                <div className="text-sm font-medium">Step 2: Organization</div>
                <div className="space-y-2">
                  <Label>Directorate</Label>
                  <Select value={selectedDirectorate ? String(selectedDirectorate) : undefined} onValueChange={(v) => setSelectedDirectorate(Number(v))}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select directorate" />
                    </SelectTrigger>
                    <SelectContent>
                      {directorates.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Department</Label>
                  <Select value={selectedDepartment ? String(selectedDepartment) : undefined} onValueChange={(v) => setSelectedDepartment(Number(v))} disabled={!selectedDirectorate}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select department" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredDepartments.map((d) => (
                        <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Office</Label>
                  <Select value={selectedOffice ? String(selectedOffice) : undefined} onValueChange={(v) => setSelectedOffice(Number(v))} disabled={!selectedDepartment}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select office" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredOffices.map((o) => (
                        <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Secondary Office (optional)</Label>
                  <Select
                    value={selectedSecondaryOffice ? String(selectedSecondaryOffice) : undefined}
                    onValueChange={(v) => setSelectedSecondaryOffice(Number(v))}
                    disabled={!selectedDepartment || filteredOffices.filter((o) => o.id !== selectedOffice).length === 0}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select secondary office" />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredOffices
                        .filter((o) => o.id !== selectedOffice)
                        .map((o) => (
                          <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>

              </div>

              {/* Step 3: Credentials */}
              <div className="space-y-3">
                <div className="text-sm font-medium">Step 3: Credentials</div>
                <p className="text-xs text-muted-foreground">Generate a temporary password. Reveal once and copy to share securely.</p>
                {/* Responsive controls: Reveal Once below Generate Password */}
                <div className="flex flex-col sm:flex-row sm:items-start sm:gap-3">
                  <div className="flex flex-col gap-2 w-full sm:w-auto">
                    <Button type="button" variant="outline" onClick={generatePassword} disabled={submitting} className="w-full sm:w-auto">
                      <KeyRound className="h-4 w-4 mr-2" /> Generate Password
                    </Button>
                    <Button type="button" onClick={revealOnce} variant="default" disabled={revealedOnce || !generatedPassword || submitting} className="w-full sm:w-auto">
                      {showPassword ? <EyeOff className="h-4 w-4 mr-2" /> : <Eye className="h-4 w-4 mr-2" />} Reveal once
                    </Button>
                  </div>
                  <div className="flex items-start sm:items-center gap-2 mt-2 sm:mt-0">
                    <Button type="button" variant="outline" onClick={copyPassword} disabled={!generatedPassword || submitting} className="w-full sm:w-auto">
                      <Copy className="h-4 w-4 mr-2" /> Copy
                    </Button>
                  </div>
                </div>
                <div className="text-sm mt-2">
                  <span className="font-medium">Temporary Password: </span>
                  <span className={`px-2 py-1 rounded ${showPassword ? "bg-primary/10" : "bg-muted"}`}>
                    {generatedPassword ? (showPassword ? generatedPassword : "••••••••••••") : "Not generated"}
                  </span>
                </div>
              </div>
            </div>
            {/* Bottom-right action */}
            <div className="mt-6 flex justify-end">
              <Button onClick={handleCreateEmployee} disabled={submitting}>
                {submitting ? "Creating..." : "Create Employee"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </Protect>

      {/* Summary Cards - Dynamic */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <Users className="h-8 w-8 text-primary" />
              <div>
                <div className="text-2xl font-bold text-primary">{employeesList.length}</div>
                <p className="text-xs text-muted-foreground">Total Employees</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-success">{employeesList.filter((e) => e.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Active</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-warning">{employeesList.filter((e) => e.status === "on_leave").length}</div>
            <p className="text-xs text-muted-foreground">On Leave</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-2xl font-bold text-muted-foreground">{employeesList.filter((e) => !e.is_active).length}</div>
            <p className="text-xs text-muted-foreground">Inactive</p>
          </CardContent>
        </Card>
      </div>

      {/* Employee List */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <CardTitle>Employee Table</CardTitle>
              <CardDescription>Update the employee status </CardDescription>
            </div>
            <Button size="sm" variant="outline" onClick={() => fetchEmployees()}>
              <Search className="h-4 w-4 mr-2" /> Refresh
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <Input
              placeholder="Search employees by name..."
              value={nameQuery}
              onChange={(e) => setNameQuery(e.target.value)}
            />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-blue-100">
                  <th className="p-2 text-left font-semibold text-blue-600">Employee ID</th>
                  <th className="p-2 text-left font-semibold text-blue-600">Full Name</th>
                  <th className="p-2 text-left font-semibold text-blue-600">Position</th>
                  <th className="p-2 text-left font-semibold text-blue-600">Department</th>
                  <th className="p-2 text-left font-semibold text-blue-600">Email</th>
                  <th className="p-2 text-left font-semibold text-blue-600">Phone</th>
                  <th className="p-2 text-left font-semibold text-blue-600">Status</th>
                  <th className="p-2 text-right font-semibold text-blue-600">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingEmployees ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center">Loading…</td>
                  </tr>
                ) : filteredEmployees.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="p-4 text-center text-muted-foreground">No employees found.</td>
                  </tr>
                ) : (
                  filteredEmployees.map((emp) => (
                    <tr key={emp.id} className="border-b hover:bg-muted/50">
                      <td className="p-2 font-medium text-primary">{emp.employee_id || "-"}</td>
                      <td className="p-2">{emp.full_name || emp.username || "-"}</td>
                      <td className="p-2">{getPositionName(emp.position)}</td>
                      <td className="p-2">{getDepartmentName(emp.department)}</td>
                      <td className="p-2 text-blue-600">{emp.email || "-"}</td>
                      <td className="p-2">{emp.phone_number || "-"}</td>
                      <td className="p-2">
                        <Badge className={emp.is_active ? "bg-green-100 text-green-800" : "bg-muted text-muted-foreground"}>
                          {emp.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-2 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <Protect permission="users.edit_employee">
                            <Button size="sm" variant="ghost" onClick={() => openEditModal(emp)}>
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </Protect>
                          <Protect permission="users.delete_employee">
                            <Button size="sm" variant="ghost" onClick={() => openDeleteConfirm(emp)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </Protect>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Edit Modal */}
      {editModalOpen && selectedEmployee && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <form onSubmit={submitEdit} className="bg-white w-full max-w-2xl p-6 rounded-lg shadow-lg max-h-screen overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Edit Employee</h3>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 ">
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
                <Label>Directorate</Label>
                <Select value={selectedEmployee.directorate ? String(selectedEmployee.directorate) : ""} onValueChange={(v) => {
                  const dirId = Number(v);
                  setSelectedEmployee({ ...selectedEmployee, directorate: dirId, department: null, office: null });
                }}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select directorate" />
                  </SelectTrigger>
                  <SelectContent>
                    {directorates.map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Department</Label>
                <Select
                  value={selectedEmployee.department ? String(selectedEmployee.department) : ""}
                  onValueChange={(v) => setSelectedEmployee({ ...selectedEmployee, department: Number(v), office: null })}
                  disabled={!selectedEmployee.directorate}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={selectedEmployee.directorate ? "Select department" : "Select directorate first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {departments
                      .filter((d) => (d as any).directorate === selectedEmployee.directorate)
                      .map((d) => <SelectItem key={d.id} value={String(d.id)}>{d.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label>Office</Label>
                <Select
                  value={selectedEmployee.office ? String(selectedEmployee.office) : ""}
                  onValueChange={(v) => setSelectedEmployee({ ...selectedEmployee, office: Number(v) })}
                  disabled={!selectedEmployee.department}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={selectedEmployee.department ? "Select office" : "Select department first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {offices
                      .filter((o) => (o as any).department === selectedEmployee.department)
                      .map((o) => <SelectItem key={o.id} value={String(o.id)}>{o.name}</SelectItem>)}
                  </SelectContent>
                </Select>
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

              <div className="flex items-center gap-2">
                <Label>Active</Label>
                <input type="checkbox" checked={!!selectedEmployee.is_active} onChange={(e) => setSelectedEmployee({ ...selectedEmployee, is_active: e.target.checked })} className="w-4 h-4" />
              </div>
            </div>

            <div className="mb-6 space-y-4">
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

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => { setEditModalOpen(false); setSelectedEmployee(null); }}>Cancel</Button>
              <Button type="submit">Save Changes</Button>
            </div>
          </form>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmOpen && selectedEmployee && (
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
      )}
    </div>
  );
};

export default Employees;
