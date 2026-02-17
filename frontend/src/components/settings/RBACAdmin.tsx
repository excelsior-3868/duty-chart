import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Search, Shield, Users, Save, RefreshCw, Check } from 'lucide-react';
import { toast } from "sonner";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";

interface Role {
  id: number;
  slug: string;
  name: string;
}

interface Permission {
  id: number;
  slug: string;
  name: string;
  description: string;
}

interface User {
  id: number;
  full_name: string;
  email: string;
  role: string;
  position_name?: string;
}

export function RBACAdmin() {
  const [activeTab, setActiveTab] = useState("matrix");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold tracking-tight">RBAC Administration</h2>
          <p className="text-muted-foreground">Manage roles, permissions, and user assignments.</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="matrix" className="flex items-center gap-2">
            <Shield className="h-4 w-4" />
            Role Permissions
          </TabsTrigger>
          <TabsTrigger value="users" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            User Assignments
          </TabsTrigger>
        </TabsList>

        <TabsContent value="matrix" className="space-y-4">
          <RolePermissionMatrix />
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <UserRoleAssignment />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function RolePermissionMatrix() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [rolePermissions, setRolePermissions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const { user, refreshUser } = useAuth();

  useEffect(() => {
    fetchRolesAndPermissions();
  }, []);

  useEffect(() => {
    if (selectedRole) {
      fetchRolePermissions(selectedRole.id);
    }
  }, [selectedRole]);

  async function fetchRolesAndPermissions() {
    setLoading(true);
    try {
      const [rolesRes, permsRes] = await Promise.all([
        api.get("/roles/"),
        api.get("/permissions/")
      ]);
      setRoles(rolesRes.data.results || rolesRes.data);
      setPermissions(permsRes.data.results || permsRes.data);
      if (rolesRes.data.length > 0 && !selectedRole) {
        setSelectedRole(rolesRes.data[0]);
      }
    } catch (error) {
      console.error("Failed to fetch RBAC data", error);
      toast.error("Failed to load roles and permissions");
    } finally {
      setLoading(false);
    }
  }

  async function fetchRolePermissions(roleId: number) {
    try {
      const res = await api.get(`/roles/${roleId}/permissions/`);
      setRolePermissions(res.data.permissions || []);
    } catch (error) {
      console.error("Failed to fetch role permissions", error);
      toast.error("Failed to load role permissions");
    }
  }

  async function handleSave() {
    if (!selectedRole) return;
    setSaving(true);
    try {
      await api.put(`/roles/${selectedRole.id}/permissions/`, {
        permissions: rolePermissions
      });
      toast.success("Permissions updated successfully");

      // If updating own role, refresh session to apply changes immediately
      if (user?.role === selectedRole.slug) {
        await refreshUser();
      }
    } catch (error) {
      console.error("Failed to update permissions", error);
      toast.error("Failed to update permissions");
    } finally {
      setSaving(false);
    }
  }

  const togglePermission = (slug: string) => {
    setRolePermissions(prev =>
      prev.includes(slug)
        ? prev.filter(p => p !== slug)
        : [...prev, slug]
    );
  };

  // Group permissions by prefix (e.g., 'duties.', 'users.')
  const groupedPermissions = useMemo(() => {
    const groups: Record<string, Permission[]> = {};
    permissions.forEach(p => {
      const prefix = p.slug.includes('.') ? p.slug.split('.')[0] : 'other';
      if (!groups[prefix]) groups[prefix] = [];
      groups[prefix].push(p);
    });
    return groups;
  }, [permissions]);

  const filteredGroups = useMemo(() => {
    if (!searchQuery) return groupedPermissions;
    const lowerQ = searchQuery.toLowerCase();
    const result: Record<string, Permission[]> = {};

    Object.entries(groupedPermissions).forEach(([prefix, perms]) => {
      const filtered = perms.filter(p =>
        p.slug.toLowerCase().includes(lowerQ) ||
        p.name.toLowerCase().includes(lowerQ)
      );
      if (filtered.length > 0) {
        result[prefix] = filtered;
      }
    });
    return result;
  }, [groupedPermissions, searchQuery]);

  return (
    <div className="grid gap-6 md:grid-cols-[300px_1fr]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Roles</CardTitle>
          <CardDescription>Select a role to configure</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2">
          {roles.map(role => (
            <div
              key={role.id}
              onClick={() => setSelectedRole(role)}
              className={`p-3 rounded-lg cursor-pointer transition-colors flex items-center justify-between ${selectedRole?.id === role.id
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-muted"
                }`}
            >
              <span className="font-medium">{role.name}</span>
              {selectedRole?.id === role.id && <Check className="h-4 w-4" />}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card className="flex flex-col h-[600px]">
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <div className="space-y-1">
            <CardTitle>Permissions: {selectedRole?.name}</CardTitle>
            <CardDescription>
              {rolePermissions.length} permissions selected
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => fetchRolePermissions(selectedRole!.id)}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Reset
            </Button>
            <Button size="sm" onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="flex-1 overflow-hidden flex flex-col gap-4">
          <div className="relative">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search permissions..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>

          <ScrollArea className="flex-1 pr-4">
            <div className="space-y-6">
              {Object.entries(filteredGroups).map(([group, perms]) => (
                <div key={group} className="space-y-3">
                  <h4 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                    {group}
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {perms.map(perm => (
                      <div
                        key={perm.id}
                        onClick={() => togglePermission(perm.slug)}
                        className={`flex items-start gap-3 p-3 rounded border cursor-pointer transition-all ${rolePermissions.includes(perm.slug)
                            ? "border-primary bg-primary/5"
                            : "hover:bg-muted/50"
                          }`}
                      >
                        <div className={`mt-0.5 h-4 w-4 rounded border flex items-center justify-center ${rolePermissions.includes(perm.slug)
                            ? "bg-primary border-primary text-primary-foreground"
                            : "border-muted-foreground"
                          }`}>
                          {rolePermissions.includes(perm.slug) && <Check className="h-3 w-3" />}
                        </div>
                        <div className="space-y-1">
                          <p className="text-sm font-medium leading-none">{perm.name}</p>
                          <p className="text-xs text-muted-foreground break-all">{perm.slug}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              {Object.keys(filteredGroups).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No permissions found matching "{searchQuery}"
                </div>
              )}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}

function UserRoleAssignment() {
  const [users, setUsers] = useState<User[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    setLoading(true);
    try {
      const [usersRes, rolesRes] = await Promise.all([
        api.get("/users/?page_size=1000"),
        api.get("/roles/")
      ]);
      setUsers(usersRes.data.results || usersRes.data);
      setRoles(rolesRes.data.results || rolesRes.data);
    } catch (error) {
      console.error("Failed to fetch data", error);
      toast.error("Failed to load users and roles");
    } finally {
      setLoading(false);
    }
  }

  async function handleRoleChange(userId: number, newRoleSlug: string) {
    const originalUsers = [...users];

    // Optimistic update
    setUsers(users.map(u =>
      u.id === userId ? { ...u, role: newRoleSlug } : u
    ));

    try {
      await api.patch(`/users/${userId}/`, { role: newRoleSlug });
      toast.success("User role updated");
    } catch (error) {
      console.error("Failed to update role", error);
      toast.error("Failed to update user role");
      setUsers(originalUsers); // Revert
    }
  }

  const filteredUsers = users.filter(user =>
    user.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    user.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>User Role Assignments</CardTitle>
        <CardDescription>Assign roles to system users.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search users..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-8"
            />
          </div>
          <Button variant="outline" onClick={fetchData} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>

        <div className="border rounded-md">
          <div className="grid grid-cols-[2fr_2fr_1.5fr] gap-4 p-4 font-medium bg-muted/50 border-b">
            <div>User</div>
            <div>Email</div>
            <div>Role</div>
          </div>
          <ScrollArea className="h-[500px]">
            <div className="divide-y">
              {filteredUsers.map(user => (
                <div key={user.id} className="grid grid-cols-[2fr_2fr_1.5fr] gap-4 p-4 items-center hover:bg-muted/5">
                  <div>
                    <div className="font-medium">{user.full_name}</div>
                    <div className="text-xs text-muted-foreground">{user.position_name || "No Position"}</div>
                  </div>
                  <div className="text-sm truncate" title={user.email}>{user.email}</div>
                  <div>
                    <Select
                      value={user.role}
                      onValueChange={(val) => handleRoleChange(user.id, val)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {roles.map(role => (
                          <SelectItem key={role.slug} value={role.slug}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-muted-foreground">
                  No users found.
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      </CardContent>
    </Card>
  );
}
