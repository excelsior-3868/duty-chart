import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { User, Mail, Shield, Phone, Camera, Building2, Briefcase, Save, X, Pencil, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import api from "@/services/api";

const Profile = () => {
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [user, setUser] = useState<any>(null);
  const [editData, setEditData] = useState<any>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [profileFile, setProfileFile] = useState<File | null>(null);

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

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const allowed: Record<string, any> = {
        full_name: editData?.full_name,
        email: editData?.email,
        phone_number: editData?.phone_number,
      };
      if (profileFile) {
        const form = new FormData();
        Object.entries(allowed).forEach(([k, v]) => {
          if (v !== undefined && v !== null) form.append(k, String(v));
        });
        form.append('image', profileFile);
        await api.patch(`/users/${user.id}/`, form);
      } else {
        await api.patch(`/users/${user.id}/`, allowed);
      }
      toast.success("Profile updated successfully!");
      setIsEditing(false);
      fetchProfileData();
    } catch (err) {
      toast.error("Update failed.");
    }
  };

  if (loading) return <div className="p-6 text-center text-primary">Connecting to NTC Portal...</div>;

  if (!user) return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-card shadow-sm rounded-lg text-center border">
      <AlertCircle className="mx-auto text-destructive mb-4" size={48} />
      <h2 className="text-xl font-semibold text-foreground">Session Missing</h2>
      <p className="text-muted-foreground text-sm mt-2">Please login again to view your profile.</p>
    </div>
  );

  const getRoleClass = (role?: string) =>
    role === 'SUPERADMIN' ? 'text-red-600' : role === 'OFFICE_ADMIN' ? 'text-blue-600' : 'text-muted-foreground';

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-primary">Staff Profile</h1>
          <p className="text-muted-foreground">View and edit your profile information</p>
        </div>
        {!isEditing ? (
          <Button onClick={() => setIsEditing(true)} className="gap-2">
            <Pencil size={18} />
            Edit Details
          </Button>
        ) : (
          <div className="flex gap-3">
            <Button variant="outline" onClick={() => setIsEditing(false)} className="gap-2">
              <X size={18} />
              Cancel
            </Button>
            <Button onClick={handleUpdate} className="gap-2">
              <Save size={18} />
              Save Changes
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <Card className="lg:col-span-4 overflow-hidden group">
          <CardContent className="flex flex-col items-center py-8">
            <div className="relative">
              <div className="h-44 w-44 rounded-full bg-muted overflow-hidden flex items-center justify-center">
                {preview || user?.image || user?.avatar_url || user?.profile_image ? (
                  <img src={preview || user?.image || user?.avatar_url || user?.profile_image} className="h-full w-full object-cover" />
                ) : (
                  <User size={90} className="text-slate-200" />
                )}
              </div>
              <Label className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                <Camera size={32} />
                <span className="text-xs font-medium mt-1">Update Photo</span>
                <input type="file" hidden onChange={(e) => {
                  const file = e.target.files?.[0];
                  if(file) {
                    setProfileFile(file);
                    setPreview(URL.createObjectURL(file));
                  }
                }} />
              </Label>
            </div>
            
            <div className="mt-8 text-center">
              <h2 className="text-xl font-semibold text-foreground">{user?.full_name}</h2>
              <p className="text-primary text-sm mt-1">{user?.position?.name || "Member of Staff"}</p>
              <div className="mt-6 flex flex-col gap-2">
                <span className="text-xs text-muted-foreground">Employee ID</span>
                <code className="bg-muted px-3 py-1 rounded-md text-foreground border">
                  {user?.employee_id}
                </code>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Shield size={20} className="text-primary" />
              Employee Details
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isEditing ? (
              <form onSubmit={handleUpdate} className="grid md:grid-cols-2 gap-x-10 gap-y-8">
                <div className="space-y-3">
                  <Label>Full Name</Label>
                  <Input 
                    value={editData?.full_name || ""} 
                    onChange={(e) => setEditData({...editData, full_name: e.target.value})} 
                  />
                </div>
                <div className="space-y-3">
                  <Label>Official Email</Label>
                  <Input 
                    value={editData?.email || ""} 
                    onChange={(e) => setEditData({...editData, email: e.target.value})} 
                  />
                </div>
                <div className="space-y-3">
                  <Label>Phone Contact</Label>
                  <Input 
                    value={editData?.phone_number || ""} 
                    onChange={(e) => setEditData({...editData, phone_number: e.target.value})} 
                  />
                </div>
                <div className="space-y-3">
                  <Label>Employee ID (Permanent)</Label>
                  <Input value={editData?.employee_id || ""} disabled />
                </div>
              </form>
            ) : (
              <div className="grid md:grid-cols-2 gap-y-8 gap-x-8">
                <ProfileItem icon={<User size={20}/>} label="Full Name" value={user?.full_name} />
                <ProfileItem icon={<Shield size={20}/>} label="Role" value={<span className={getRoleClass(user?.role)}>{user?.role?.replace('_', ' ')}</span>} />
                <ProfileItem icon={<Phone size={20}/>} label="Phone Number" value={user?.phone_number} />
                <ProfileItem icon={<Building2 size={20}/>} label="Directorate" value={user?.directorate?.name || user?.directorate} />
                <ProfileItem icon={<Briefcase size={20}/>} label="Current Department" value={user?.department?.name || user?.department} />
                <ProfileItem icon={<Shield size={20}/>} label="Account Status" value={user?.is_active ? "Verified & Active" : "Inactive"} />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

const ProfileItem = ({ icon, label, value }: { icon: any, label: string, value: any }) => (
  <div className="flex items-start gap-5 group">
    <div className="bg-muted/50 p-3 rounded-md text-primary transition-colors">
      {icon}
    </div>
    <div className="flex-1">
      <p className="text-sm font-medium text-muted-foreground mb-1">{label}</p>
      <p className="text-lg font-semibold text-foreground">{value || "Not Set"}</p>
    </div>
  </div>
);

export default Profile;
