import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { ROUTES } from "@/utils/constants";
import api from "@/services/api";
import { useAuth } from "@/context/AuthContext";
import { Loader2 } from "lucide-react";
import publicApi from "@/services/publicApi"; // Use publicApi for OTP endpoints if they are under /otp/ which might be public, but here we use authenticated context so 'api' is better IF endpoints allow it. 
// Actually our otp endpoints are public (permission_classes=[]), but ChangePasswordView IS authenticated. 
// RequestOTPView works for both. Users lookup is public.
// But since we are logged in, we should use 'api' to ensure we capture any session issues, though 'publicApi' is fine for the OTP parts.
// However, the ChangePasswordView requires AUTH. So 'api' is MUST for that.
// Let's use 'api' for everything if possible, but 'UserLookupView' is public. 'api' attaches token. It should work fine on public endpoints too.

type Step = "VERIFY_OLD" | "SELECT_CHANNEL" | "VALIDATE_OTP" | "NEW_PASSWORD";

interface Channel {
  type: string;
  value: string;
  label: string;
}

const ChangePassword = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [step, setStep] = useState<Step>("VERIFY_OLD");
  const [isLoading, setIsLoading] = useState(false);

  const [currentPassword, setCurrentPassword] = useState("");
  const [channels, setChannels] = useState<Channel[]>([]);
  const [selectedChannel, setSelectedChannel] = useState<string>("");
  const [requestId, setRequestId] = useState("");
  const [otp, setOtp] = useState("");
  const [maskedPhone, setMaskedPhone] = useState("");

  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleVerifyOld = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post("/otp/password/verify/", { password: currentPassword });
      // If success, fetch channels
      // We can use the user's email/phone directly since we are logged in? 
      // Or call Lookup to get masking?
      // Let's call lookup with our email to get the nice masked options
      if (user?.email) {
        const { data } = await api.post("/otp/lookup/", { username: user.email });
        // Check api.ts. It usually has baseURL.
        // The paths in urls.py are 'otp/lookup/'. 
        // publicApi has baseURL `${BACKEND}/api`. 
        // api.ts usually similar.
        // Let's assume /otp/lookup/ is correct relative to baseURL.
        if (data.exists && data.channels.length > 0) {
          setChannels(data.channels);
          const smsChannel = data.channels.find((ch: Channel) => ch.type === 'sms_ntc');
          setSelectedChannel(smsChannel ? 'sms_ntc' : data.channels[0].type);
          setStep("SELECT_CHANNEL");
        } else {
          // Fallback if lookup fails or no channels?
          toast.error("No verification channels found.");
        }
      } else {
        toast.error("User email not found.");
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid current password");
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      // Use user.email as username for request
      const { data } = await api.post("/otp/request/", {
        username: user?.email,
        channel: selectedChannel,
        purpose: "change_password",
      });
      setRequestId(data.request_id);
      if (data.masked_phone && selectedChannel === 'sms_ntc') {
        setMaskedPhone(data.masked_phone);
        toast.success(`OTP sent to ${data.masked_phone}`);
      } else {
        toast.success("OTP sent.");
      }
      setStep("VALIDATE_OTP");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleValidateOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await api.post("/otp/validate/", {
        request_id: requestId,
        otp,
      });
      toast.success("OTP verified");
      setStep("NEW_PASSWORD");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Invalid OTP");
    } finally {
      setIsLoading(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return toast.error("New passwords do not match!");
    }

    setIsLoading(true);
    try {
      await api.post("/otp/password/change/", {
        old_password: currentPassword,
        new_password: newPassword,
        request_id: requestId
      });

      toast.success("Password changed successfully! Please login again.");
      navigate(ROUTES.LOGIN);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center gradient-background p-4">
      <Card className="w-full max-w-md shadow-lg border-0 bg-white/90 backdrop-blur-sm">
        <CardContent className="p-8">
          <h1 className="text-2xl font-bold mb-6 text-center text-[#005a9c]">
            {step === "VERIFY_OLD" && "Verify Identity"}
            {step === "SELECT_CHANNEL" && "Select Verification Method"}
            {step === "VALIDATE_OTP" && "Enter Verification Code"}
            {step === "NEW_PASSWORD" && "Set New Password"}
          </h1>

          {step === "VERIFY_OLD" && (
            <form onSubmit={handleVerifyOld} className="space-y-4">
              <div>
                <Label>Current Password</Label>
                <Input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Enter current password"
                  required
                />
              </div>
              <Button type="submit" className="w-full bg-[#1F5CA9]" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Continue
              </Button>
            </form>
          )}

          {step === "SELECT_CHANNEL" && (
            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div className="space-y-3">
                {channels.map((ch) => (
                  <div key={ch.type} className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-slate-50" onClick={() => setSelectedChannel(ch.type)}>
                    <input
                      type="radio"
                      name="channel"
                      value={ch.type}
                      checked={selectedChannel === ch.type}
                      onChange={() => setSelectedChannel(ch.type)}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="text-sm font-medium">{ch.label}</span>
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full bg-[#1F5CA9]" disabled={isLoading || !selectedChannel}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Send Verification Code
              </Button>
            </form>
          )}

          {step === "VALIDATE_OTP" && (
            <form onSubmit={handleValidateOTP} className="space-y-4">
              <div>
                <Label>One-Time Password (OTP)</Label>
                <Input
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  placeholder="Enter 6-digit code"
                  required
                />
                {maskedPhone && <p className="text-xs text-gray-500 mt-1">Sent to {maskedPhone}</p>}
              </div>
              <Button type="submit" className="w-full bg-[#1F5CA9]" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Verify
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => setStep("SELECT_CHANNEL")}>Back</Button>
            </form>
          )}

          {step === "NEW_PASSWORD" && (
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <Label>New Password</Label>
                <Input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <div>
                <Label>Confirm New Password</Label>
                <Input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  minLength={8}
                />
              </div>
              <Button type="submit" className="w-full bg-[#1F5CA9]" disabled={isLoading}>
                {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Update Password
              </Button>
            </form>
          )}

        </CardContent>
      </Card>
    </div>
  );
};


export default ChangePassword;