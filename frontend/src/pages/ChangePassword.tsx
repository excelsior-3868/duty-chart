import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { ROUTES } from "@/utils/constants";

const ChangePassword = () => {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // Basic Validation
    if (formData.newPassword !== formData.confirmPassword) {
      return toast.error("New passwords do not match!");
    }

    try {
      // NOTE: for api implementation .
      // await publicApi.post("/change-password/", formData);
      
      toast.success("Password changed successfully! Please login again.");
      navigate(ROUTES.LOGIN);
    } catch (err) {
      toast.error("Failed to change password");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-background p-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
        <CardContent className="p-8">
          <h1 className="text-2xl font-semibold mb-6 text-center text-[#004e9a]">Set New Password</h1>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label>Current Password</Label>
              <Input 
                type="password" 
                onChange={(e) => setFormData({...formData, currentPassword: e.target.value})} 
                required 
              />
            </div>
            <div>
              <Label>New Password</Label>
              <Input 
                type="password" 
                onChange={(e) => setFormData({...formData, newPassword: e.target.value})} 
                required 
              />
            </div>
            <div>
              <Label>Confirm New Password</Label>
              <Input 
                type="password" 
                onChange={(e) => setFormData({...formData, confirmPassword: e.target.value})} 
                required 
              />
            </div>
            <button type="submit" className="w-full bg-[#004e9a] text-white py-2.5 rounded-lg">
              Update Password
            </button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
};

export default ChangePassword;