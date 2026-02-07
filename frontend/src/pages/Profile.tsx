import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
    User, Mail, Shield, Phone, Camera,
    Building2, Briefcase, Save, X, Pencil,
    AlertCircle, Lock, Fingerprint, Globe, MapPin,
    Network, LayoutGrid, Layers, Key, Eye, EyeOff, Loader2
} from "lucide-react";
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
import { toast } from "sonner";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";

const OrgField = ({ label, value, icon, className = "" }: { label: string, value: string, icon: any, className?: string }) => (
    <div className={`space-y-0.5 ${className}`}>
        <Label className="text-primary text-xs font-medium ml-1">{label}</Label>
        <div className="relative group">
            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700">
                {icon}
            </div>
            <div className="bg-slate-50 border border-slate-300 h-9 rounded-lg pl-9 flex items-center">
                <span className="font-medium text-slate-900 text-sm truncate pr-2">{value || "-"}</span>
            </div>
        </div>
    </div>
);

const Profile = () => {
    const { refreshUser } = useAuth();
    const [loading, setLoading] = useState(true);
    const [isEditing, setIsEditing] = useState(false);
    const [user, setUser] = useState<any>(null);
    const [editData, setEditData] = useState<any>(null);
    const [preview, setPreview] = useState<string | null>(null);
    const [profileFile, setProfileFile] = useState<File | null>(null);

    // Password change state
    const [pwData, setPwData] = useState({ old: "", new: "", confirm: "" });
    const [showOld, setShowOld] = useState(false);
    const [showNew, setShowNew] = useState(false);
    const [showConfirm, setShowConfirm] = useState(false);
    const [pwUpdating, setPwUpdating] = useState(false);
    const [imgUploading, setImgUploading] = useState(false);
    const [workingOffices, setWorkingOffices] = useState<any[]>([]);
    const [officeSearch, setOfficeSearch] = useState("");
    const [officePopoverOpen, setOfficePopoverOpen] = useState(false);
    const [positions, setPositions] = useState<any[]>([]);
    const [positionSearch, setPositionSearch] = useState("");
    const [positionPopoverOpen, setPositionPopoverOpen] = useState(false);

    const BACKEND = import.meta.env.VITE_BACKEND_HOST || "";

    const getImageUrl = (path: string | null | undefined) => {
        if (!path) return null;
        if (path.startsWith("http")) return path;

        const host = import.meta.env.VITE_BACKEND_HOST || "http://127.0.0.1:8000";
        const cleanPath = path.startsWith("/") ? path : `/${path}`;
        return `${host}${cleanPath}`;
    };

    const fetchProfileData = async () => {
        setLoading(true);
        try {
            const token = localStorage.getItem("access");
            if (!token) return;

            const decoded = JSON.parse(atob(token.split('.')[1]));
            const userId = decoded.user_id || decoded.sub || decoded.id;

            if (!userId) return;

            const res = await api.get(`/users/${userId}/`);
            setUser(res.data);
            setEditData(res.data);
        } catch (err) {
            console.error("Fetch error:", err);
            toast.error("Could not load user data.");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchProfileData(); }, []);

    useEffect(() => {
        if (isEditing) {
            fetchWorkingOffices();
            fetchPositions();
        }
    }, [isEditing]);

    const fetchPositions = async () => {
        try {
            const { data } = await api.get("/positions/");
            setPositions(data);
        } catch (err) {
            console.error("Failed to fetch positions", err);
            toast.error("Failed to load positions.");
        }
    };

    const fetchWorkingOffices = async () => {
        try {
            const { data } = await api.get("/otp/signup/offices/");
            setWorkingOffices(data);
        } catch (err) {
            console.error("Failed to fetch working offices", err);
            toast.error("Failed to load offices.");
        }
    };

    const filteredOffices = workingOffices.filter((office) =>
        office.name.toLowerCase().includes(officeSearch.toLowerCase())
    );

    const filteredPositions = positions.filter((pos) =>
        pos.name.toLowerCase().includes(positionSearch.toLowerCase())
    );

    const handleImageUpload = async (file: File) => {
        if (!user?.id) return;

        try {
            setImgUploading(true);
            setPreview(URL.createObjectURL(file)); // Show local preview immediately

            const formData = new FormData();
            formData.append("image", file);

            await api.patch(`/users/${user.id}/`, formData);

            toast.success("Profile picture updated!");
            await refreshUser();
            await fetchProfileData();
        } catch (err: any) {
            console.error("Upload error:", err);
            const status = err.response?.status;
            const detail = err.response?.data?.detail || err.response?.data?.message || err.message;
            toast.error(`Upload failed (${status || 'Network Error'}): ${detail}`);
            setPreview(null); // Reset preview on error
        } finally {
            setImgUploading(false);
        }
    };

    const handleUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            const formData = new FormData();
            formData.append("full_name", editData.full_name);
            if (editData.phone_number) {
                formData.append("phone_number", editData.phone_number);
            }
            if (editData.email) {
                formData.append("email", editData.email);
            }
            if (editData.office) {
                formData.append("office", editData.office);
            }
            if (editData.position) {
                formData.append("position", editData.position);
            }

            await api.patch(`/users/${user.id}/`, formData);

            toast.success("Profile updated successfully!");
            await refreshUser();
            setIsEditing(false);
            fetchProfileData();
        } catch (err) {
            toast.error("Update failed. Please try again.");
        }
    };

    const handlePasswordChange = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!pwData.old || !pwData.new || !pwData.confirm) {
            toast.error("Please fill in all password fields.");
            return;
        }

        if (pwData.new !== pwData.confirm) {
            toast.error("New passwords do not match.");
            return;
        }

        if (pwData.new.length < 8) {
            toast.error("New password must be at least 8 characters long.");
            return;
        }

        try {
            setPwUpdating(true);
            await api.post("/otp/password/change/", {
                old_password: pwData.old,
                new_password: pwData.new
            });
            toast.success("Password updated successfully!");
            setPwData({ old: "", new: "", confirm: "" });
        } catch (err: any) {
            const msg = err.response?.data?.message || "Failed to update password. Please check your current password.";
            toast.error(msg);
        } finally {
            setPwUpdating(false);
        }
    };

    if (loading) return (
        <div className="flex items-center justify-center min-h-[400px]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
    );

    if (!user) return (
        <div className="max-w-md mx-auto mt-20 p-6 bg-card shadow-sm rounded-lg text-center border">
            <AlertCircle className="mx-auto text-destructive mb-4" size={48} />
            <h2 className="text-xl font-semibold text-foreground">Session Missing</h2>
            <p className="text-muted-foreground text-sm mt-2">Please login again to view your profile.</p>
        </div>
    );

    const getRoleLabel = (role: string) => {
        switch (role) {
            case 'SUPERADMIN': return 'Super Admin';
            case 'OFFICE_ADMIN': return 'Office Admin';
            default: return 'User';
        }
    };

    return (
        <div className="p-4 bg-slate-50/50 min-h-screen">
            <div className="w-full space-y-3">
                {/* Simplified Header */}
                <div className="pb-1">
                    <h1 className="text-2xl font-bold text-primary">Profile Settings</h1>
                    <p className="text-muted-foreground">Manage your personal information and security</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                    {/* Left Sidebar */}
                    <div className="lg:col-span-3 space-y-4 lg:sticky lg:top-6 h-fit">
                        <Card className="overflow-hidden border shadow-sm rounded-xl bg-white">
                            <CardContent className="p-5 flex flex-col items-center">
                                <div className="relative group p-1 border-2 border-dashed border-slate-300 rounded-2xl">
                                    <div className="h-40 w-40 rounded-2xl bg-slate-50 overflow-hidden flex items-center justify-center relative">
                                        {imgUploading && (
                                            <div className="absolute inset-0 z-10 bg-white/60 backdrop-blur-sm flex items-center justify-center">
                                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                                            </div>
                                        )}
                                        {(preview || user?.image) ? (
                                            <img
                                                src={preview || getImageUrl(user?.image)}
                                                className="h-full w-full object-cover transition-transform group-hover:scale-105"
                                                alt="Profile"
                                                onError={(e) => {
                                                    (e.target as any).src = "https://www.gravatar.com/avatar/00000000000000000000000000000000?d=mp&f=y";
                                                }}
                                            />
                                        ) : (
                                            <User size={60} className="text-slate-400" />
                                        )}
                                    </div>
                                    <Label className="absolute inset-0 flex flex-col items-center justify-center bg-black/40 text-white rounded-2xl opacity-0 group-hover:opacity-100 transition-all cursor-pointer backdrop-blur-[1px]">
                                        <Camera size={24} />
                                        <input
                                            type="file"
                                            hidden
                                            accept="image/*"
                                            disabled={imgUploading}
                                            onChange={(e) => {
                                                const file = e.target.files?.[0];
                                                if (file) {
                                                    handleImageUpload(file);
                                                }
                                            }}
                                        />
                                    </Label>
                                </div>
                                <div className="mt-3 text-center">
                                    <h2 className="font-medium text-primary text-sm">{user.full_name}</h2>

                                </div>
                            </CardContent>
                        </Card>

                        <div className="space-y-2">
                            <div className="bg-white border p-3 rounded-xl shadow-sm">
                                <p className="text-xs font-medium text-primary mb-1.5">System Role</p>
                                <div className="flex items-center gap-2">
                                    <Shield size={16} className="text-primary" />
                                    <span className="text-xs font-medium text-slate-900">{getRoleLabel(user.role)}</span>
                                </div>
                            </div>

                            <div className="bg-white border p-3 rounded-xl shadow-sm">
                                <p className="text-xs font-medium text-primary mb-1.5">Employee Id</p>
                                <div className="flex items-center gap-2">
                                    <User size={16} className="text-primary" />
                                    <span className="text-xs font-medium text-slate-900">{user.employee_id}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Main Content Area */}
                    <div className="lg:col-span-9">
                        <Tabs defaultValue="information" className="space-y-3">
                            <TabsList className="bg-slate-100 p-1 rounded-lg border w-full justify-start md:w-auto h-11">
                                <TabsTrigger value="information" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 text-sm font-medium text-primary">
                                    <User size={14} className="mr-2" /> Profile Information
                                </TabsTrigger>
                                <TabsTrigger value="password" className="rounded-md data-[state=active]:bg-white data-[state=active]:shadow-sm px-6 text-sm font-medium text-primary">
                                    <Key size={14} className="mr-2" /> Change Password
                                </TabsTrigger>
                            </TabsList>

                            <TabsContent value="information" className="mt-0">
                                <Card className="border shadow-sm rounded-xl overflow-hidden bg-white">
                                    <CardContent className="p-6 space-y-5">
                                        <section className="space-y-3">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 text-primary font-medium text-sm">
                                                    <User size={16} className="text-primary" />
                                                    Personal Information
                                                </div>
                                                {isEditing && (
                                                    <Button variant="outline" onClick={() => setIsEditing(false)} className="h-8 border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-slate-900 text-xs font-medium">
                                                        <X size={14} className="mr-1" /> Cancel
                                                    </Button>
                                                )}
                                            </div>

                                            <div className="grid md:grid-cols-2 gap-x-6 gap-y-3">
                                                <div className="space-y-0.5">
                                                    <Label className="text-primary text-xs font-medium ml-1">Username (Employee ID)</Label>
                                                    <div className="relative">
                                                        <User size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                                                        <div className="px-2 py-1 pl-9 bg-slate-50 border rounded-lg h-9 flex items-center">
                                                            <p className="text-blue-700 font-medium text-sm">{user.employee_id}</p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="space-y-0.5">
                                                    <Label className="text-primary text-xs font-medium ml-1">Full Name</Label>
                                                    <Input
                                                        className="h-9 rounded-lg text-sm font-medium border-slate-300 text-slate-900 focus:border-blue-500 placeholder:text-slate-300"
                                                        value={editData?.full_name || ""}
                                                        onChange={(e) => setEditData({ ...editData, full_name: e.target.value })}
                                                        disabled={!isEditing}
                                                        placeholder="Full Name"
                                                    />
                                                </div>

                                                <div className="space-y-0.5">
                                                    <Label className="text-primary text-xs font-medium ml-1">Designation</Label>
                                                    {isEditing ? (
                                                        <Popover open={positionPopoverOpen} onOpenChange={setPositionPopoverOpen}>
                                                            <PopoverTrigger asChild>
                                                                <Button
                                                                    variant="outline"
                                                                    role="combobox"
                                                                    aria-expanded={positionPopoverOpen}
                                                                    className="h-9 w-full justify-between font-normal text-sm border-slate-300"
                                                                >
                                                                    {editData?.position
                                                                        ? positions.find((pos) => String(pos.id) === String(editData.position))?.name || user.position_name
                                                                        : user.position_name || "Select Position"}
                                                                    <svg
                                                                        xmlns="http://www.w3.org/2000/svg"
                                                                        width="16"
                                                                        height="16"
                                                                        viewBox="0 0 24 24"
                                                                        fill="none"
                                                                        stroke="currentColor"
                                                                        strokeWidth="2"
                                                                        strokeLinecap="round"
                                                                        strokeLinejoin="round"
                                                                        className="ml-2 h-4 w-4 shrink-0 opacity-50"
                                                                    >
                                                                        <path d="m6 9 6 6 6-6" />
                                                                    </svg>
                                                                </Button>
                                                            </PopoverTrigger>
                                                            <PopoverContent className="w-full p-0" align="start">
                                                                <Command shouldFilter={false}>
                                                                    <CommandInput
                                                                        placeholder="Search position..."
                                                                        value={positionSearch}
                                                                        onValueChange={setPositionSearch}
                                                                    />
                                                                    <CommandList>
                                                                        <CommandEmpty>No position found.</CommandEmpty>
                                                                        <CommandGroup>
                                                                            {filteredPositions.map((pos) => (
                                                                                <CommandItem
                                                                                    key={pos.id}
                                                                                    value={pos.name}
                                                                                    onSelect={() => {
                                                                                        setEditData({ ...editData, position: String(pos.id) });
                                                                                        setPositionPopoverOpen(false);
                                                                                        setPositionSearch("");
                                                                                    }}
                                                                                >
                                                                                    {pos.name}
                                                                                </CommandItem>
                                                                            ))}
                                                                        </CommandGroup>
                                                                    </CommandList>
                                                                </Command>
                                                            </PopoverContent>
                                                        </Popover>
                                                    ) : (
                                                        <div className="relative">
                                                            <Briefcase size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                                                            <div className="px-2 py-1 pl-9 bg-slate-50 border rounded-lg h-9 flex items-center">
                                                                <p className="text-slate-900 font-medium text-sm truncate">{user.position_name || "-"}</p>
                                                            </div>
                                                        </div>
                                                    )}
                                                </div>

                                                <div className="space-y-0.5">
                                                    <Label className="text-primary text-xs font-medium ml-1">Email Address</Label>
                                                    <div className="relative">
                                                        <Input
                                                            className="h-9 rounded-lg text-sm font-medium pr-10 border-slate-300 bg-slate-50 text-slate-900"
                                                            value={editData?.email || ""}
                                                            onChange={(e) => setEditData({ ...editData, email: e.target.value })}
                                                            disabled={!isEditing}
                                                        />
                                                        <Mail size={12} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                                    </div>
                                                </div>

                                                <div className="space-y-0.5">
                                                    <Label className="text-primary text-xs font-medium ml-1">Mobile Number</Label>
                                                    <div className="relative">
                                                        <Phone size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-600" />
                                                        <Input
                                                            className="h-9 rounded-lg text-sm font-medium pl-9 border-slate-300 text-slate-900 placeholder:text-slate-300"
                                                            value={editData?.phone_number || ""}
                                                            onChange={(e) => setEditData({ ...editData, phone_number: e.target.value })}
                                                            disabled={!isEditing}
                                                            placeholder="Mobile Number"
                                                        />
                                                    </div>
                                                </div>
                                            </div>
                                        </section>

                                        <div className="h-px bg-slate-100" />

                                        <section className="space-y-3">
                                            <div className="flex items-center gap-2 text-primary font-medium text-sm">
                                                <Building2 size={16} className="text-primary" />
                                                Working Office
                                            </div>

                                            <div className="space-y-0.5">
                                                <Label className="text-primary text-xs font-medium ml-1">Working Office</Label>
                                                {isEditing ? (
                                                    <Popover open={officePopoverOpen} onOpenChange={setOfficePopoverOpen}>
                                                        <PopoverTrigger asChild>
                                                            <Button
                                                                variant="outline"
                                                                role="combobox"
                                                                aria-expanded={officePopoverOpen}
                                                                className="h-9 w-full justify-between font-normal text-sm border-slate-300"
                                                            >
                                                                {editData?.office
                                                                    ? workingOffices.find((office) => String(office.id) === String(editData.office))?.name || user.office_name
                                                                    : user.office_name || "Select Working Office"}
                                                                <svg
                                                                    xmlns="http://www.w3.org/2000/svg"
                                                                    width="16"
                                                                    height="16"
                                                                    viewBox="0 0 24 24"
                                                                    fill="none"
                                                                    stroke="currentColor"
                                                                    strokeWidth="2"
                                                                    strokeLinecap="round"
                                                                    strokeLinejoin="round"
                                                                    className="ml-2 h-4 w-4 shrink-0 opacity-50"
                                                                >
                                                                    <path d="m6 9 6 6 6-6" />
                                                                </svg>
                                                            </Button>
                                                        </PopoverTrigger>
                                                        <PopoverContent className="w-full p-0" align="start">
                                                            <Command shouldFilter={false}>
                                                                <CommandInput
                                                                    placeholder="Search office..."
                                                                    value={officeSearch}
                                                                    onValueChange={setOfficeSearch}
                                                                />
                                                                <CommandList>
                                                                    <CommandEmpty>No office found.</CommandEmpty>
                                                                    <CommandGroup>
                                                                        {filteredOffices.map((office) => (
                                                                            <CommandItem
                                                                                key={office.id}
                                                                                value={office.name}
                                                                                onSelect={() => {
                                                                                    setEditData({ ...editData, office: String(office.id) });
                                                                                    setOfficePopoverOpen(false);
                                                                                    setOfficeSearch("");
                                                                                }}
                                                                            >
                                                                                {office.name}
                                                                            </CommandItem>
                                                                        ))}
                                                                    </CommandGroup>
                                                                </CommandList>
                                                            </Command>
                                                        </PopoverContent>
                                                    </Popover>
                                                ) : (
                                                    <div className="relative group">
                                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-700">
                                                            <Building2 size={12} />
                                                        </div>
                                                        <div className="bg-slate-50 border border-slate-300 h-9 rounded-lg pl-9 flex items-center">
                                                            <span className="font-medium text-slate-900 text-sm truncate pr-2">
                                                                {user.office_name || "-"}
                                                            </span>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </section>

                                        <div className="flex justify-end pt-2 border-t mt-4">
                                            {!isEditing ? (
                                                <Button onClick={() => setIsEditing(true)} className="bg-primary hover:bg-primary/90 text-white px-6 h-9 rounded-lg font-medium text-xs transition-all flex gap-2">
                                                    <Pencil size={14} /> Edit Profile
                                                </Button>
                                            ) : (
                                                <Button onClick={handleUpdate} className="bg-primary hover:bg-primary/90 text-white px-8 h-9 rounded-lg font-medium text-xs transition-all flex gap-2">
                                                    <Save size={14} /> Update Info
                                                </Button>
                                            )}
                                        </div>
                                    </CardContent>
                                </Card>
                            </TabsContent>

                            <TabsContent value="password">
                                <Card className="border shadow-sm rounded-xl overflow-hidden bg-white">
                                    <div className="p-5 border-b bg-slate-50">
                                        <h3 className="text-sm font-medium text-primary">Change Password</h3>
                                        <p className="text-xs text-slate-800 mt-0.5 font-medium">Verify your current password to set a new one</p>
                                    </div>
                                    <CardContent className="p-6">
                                        <form onSubmit={handlePasswordChange} className="max-w-sm space-y-3">
                                            <div className="space-y-0.5">
                                                <Label className="text-primary text-xs font-medium ml-1">Current Password</Label>
                                                <div className="relative">
                                                    <Input
                                                        type={showOld ? "text" : "password"}
                                                        className="h-9 rounded-lg text-sm font-medium border-slate-300 text-slate-900 placeholder:text-slate-300 placeholder:text-[10px] pr-10"
                                                        placeholder="Enter Old Password"
                                                        value={pwData.old}
                                                        onChange={(e) => setPwData({ ...pwData, old: e.target.value })}
                                                    />
                                                    <button type="button" tabIndex={-1} onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {showOld ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <Label className="text-primary text-xs font-medium ml-1">New Password</Label>
                                                <div className="relative">
                                                    <Input
                                                        type={showNew ? "text" : "password"}
                                                        className="h-9 rounded-lg text-sm font-medium border-slate-300 text-slate-900 placeholder:text-slate-300 placeholder:text-[10px] pr-10"
                                                        placeholder="Minimum 8 Characters"
                                                        value={pwData.new}
                                                        onChange={(e) => setPwData({ ...pwData, new: e.target.value })}
                                                    />
                                                    <button type="button" tabIndex={-1} onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {showNew ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <div className="space-y-0.5">
                                                <Label className="text-primary text-xs font-medium ml-1">Confirm New Password</Label>
                                                <div className="relative">
                                                    <Input
                                                        type={showConfirm ? "text" : "password"}
                                                        className="h-9 rounded-lg text-sm font-medium border-slate-300 text-slate-900 placeholder:text-slate-300 placeholder:text-[10px] pr-10"
                                                        placeholder="Repeat New Password"
                                                        value={pwData.confirm}
                                                        onChange={(e) => setPwData({ ...pwData, confirm: e.target.value })}
                                                    />
                                                    <button type="button" tabIndex={-1} onClick={() => setShowConfirm(!showConfirm)} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                                        {showConfirm ? <EyeOff size={14} /> : <Eye size={14} />}
                                                    </button>
                                                </div>
                                            </div>
                                            <Button type="submit" disabled={pwUpdating} className="w-full bg-primary hover:bg-primary/90 text-white h-10 rounded-lg mt-2 font-medium text-xs transition-all flex items-center justify-center gap-2">
                                                {pwUpdating ? (
                                                    <>
                                                        <Loader2 className="h-4 w-4 animate-spin" />
                                                        Updating...
                                                    </>
                                                ) : (
                                                    "Update Password"
                                                )}
                                            </Button>
                                        </form>
                                    </CardContent>
                                </Card>
                            </TabsContent>
                        </Tabs>
                    </div>
                </div>
            </div >
        </div >
    );
};

export default Profile;
