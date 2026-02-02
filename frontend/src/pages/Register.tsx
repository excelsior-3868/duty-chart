import React, { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Eye, EyeOff, Loader2, KeyRound, UserCheck, ShieldCheck } from "lucide-react";
import publicApi from "@/services/publicApi";
import { toast } from "sonner";
import { ROUTES, APP_NAME, COMPANY_NAME } from "@/utils/constants";
import telecomLogo from "@/assets/telecom.png";

type Step = "LOOKUP" | "VERIFY" | "OTP" | "PASSWORD";

const Register = () => {
  const navigate = useNavigate();
  const [step, setStep] = useState<Step>("LOOKUP");
  const [isLoading, setIsLoading] = useState(false);

  // Form States
  const [employeeId, setEmployeeId] = useState("");
  const [userData, setUserData] = useState<{ email: string, phone: string, full_name: string } | null>(null);
  const [otp, setOtp] = useState("");
  const [requestId, setRequestId] = useState("");
  const [passwordData, setPasswordData] = useState({ password: "", confirmPassword: "" });
  const [showPasswords, setShowPasswords] = useState({ p1: false, p2: false });

  useEffect(() => {
    document.title = "Signup - Duty Chart";
  }, []);

  // Step 1: Lookup Employee
  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const { data } = await publicApi.post("/v1/otp/signup/lookup/", { employee_id: employeeId });
      setUserData(data);
      setStep("VERIFY");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Employee ID not found.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 2: Request OTP
  const handleRequestOTP = async () => {
    setIsLoading(true);
    try {
      const { data } = await publicApi.post("/v1/otp/request/", {
        employee_id: employeeId,
        phone: userData?.phone,
        channel: "sms_ntc",
        purpose: "signup"
      });
      setRequestId(data.request_id);
      toast.success("OTP sent to your registered mobile number.");
      setStep("OTP");
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 3: Validate OTP
  const handleValidateOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await publicApi.post("/v1/otp/validate/", {
        request_id: requestId,
        otp
      });
      setStep("PASSWORD");
    } catch (err: any) {
      toast.error("Invalid OTP. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Step 4: Complete Signup
  const handleComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (passwordData.password !== passwordData.confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    setIsLoading(true);
    try {
      await publicApi.post("/v1/otp/signup/complete/", {
        request_id: requestId,
        password: passwordData.password,
        confirm_password: passwordData.confirmPassword
      });
      toast.success("Account activated successfully!");
      navigate(ROUTES.LOGIN);
    } catch (err: any) {
      toast.error(err.response?.data?.message || "Failed to set password.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans gradient-background p-4">
      <div className="w-full max-w-xs">
        <Card className="shadow-lg border-0 bg-white/90 backdrop-blur-sm" style={{ borderRadius: "12px" }}>
          <CardContent className="p-6">
            {/* Logo */}
            <div className="flex justify-center mb-1">
              <img src={telecomLogo} alt="Logo" className="w-16 h-16 object-contain" />
            </div>
            <div className="text-center mb-1">
              <div className="text-lg font-bold text-gray-800">{COMPANY_NAME}</div>
              <div className="text-primary font-medium text-xs">Employee Activation</div>
            </div>

            <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent my-3"></div>

            <h1 className="text-xl font-semibold mb-4 text-center text-primary">
              {step === "LOOKUP" && "Find Your Account"}
              {step === "VERIFY" && "Verify Details"}
              {step === "OTP" && "Enter OTP"}
              {step === "PASSWORD" && "Set Password"}
            </h1>

            {/* STEP 1: LOOKUP */}
            {step === "LOOKUP" && (
              <form onSubmit={handleLookup} className="space-y-4">
                <div className="space-y-1">
                  <Input
                    placeholder="Employee ID"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    required
                    className="h-11"
                  />
                </div>
                <Button type="submit" className="w-full h-11 bg-primary" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Find Account"}
                </Button>
              </form>
            )}

            {/* STEP 2: VERIFY DETAILS */}
            {step === "VERIFY" && userData && (
              <div className="space-y-4">
                <div className="bg-primary/5 p-3 rounded-lg border border-primary/20 text-sm space-y-2">
                  <div><span className="text-gray-500">Name:</span> <p className="font-semibold">{userData.full_name}</p></div>
                  <div><span className="text-gray-500">Email:</span> <p className="font-semibold">{userData.email}</p></div>
                  <div><span className="text-gray-500">Phone:</span> <p className="font-semibold">{userData.phone}</p></div>
                </div>
                <Button onClick={handleRequestOTP} className="w-full h-11 bg-primary" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Send OTP to Mobile"}
                </Button>
                <Button variant="ghost" onClick={() => setStep("LOOKUP")} className="w-full text-xs underline">
                  Not you? Search again
                </Button>
              </div>
            )}

            {/* STEP 3: OTP */}
            {step === "OTP" && (
              <form onSubmit={handleValidateOTP} className="space-y-4">
                <p className="text-center text-xs text-gray-500">
                  Sent to {userData?.phone.substring(0, 3)}****{userData?.phone.slice(-3)}
                </p>
                <Input
                  placeholder="4-digit OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={4}
                  required
                  className="h-11 text-center text-xl tracking-widest"
                />
                <Button type="submit" className="w-full h-11 bg-primary" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Verify OTP"}
                </Button>
              </form>
            )}

            {/* STEP 4: PASSWORD */}
            {step === "PASSWORD" && (
              <form onSubmit={handleComplete} className="space-y-3">
                <div className="relative">
                  <Input
                    type={showPasswords.p1 ? "text" : "password"}
                    placeholder="New Password"
                    value={passwordData.password}
                    onChange={(e) => setPasswordData({ ...passwordData, password: e.target.value })}
                    required
                    className="h-11 pr-10"
                  />
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, p1: !showPasswords.p1 })} className="absolute right-3 top-3.5 text-gray-400">
                    {showPasswords.p1 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="relative border-t pt-1">
                  <Input
                    type={showPasswords.p2 ? "text" : "password"}
                    placeholder="Confirm Password"
                    value={passwordData.confirmPassword}
                    onChange={(e) => setPasswordData({ ...passwordData, confirmPassword: e.target.value })}
                    required
                    className="h-11 pr-10"
                  />
                  <button type="button" onClick={() => setShowPasswords({ ...showPasswords, p2: !showPasswords.p2 })} className="absolute right-3 top-3.5 text-gray-400">
                    {showPasswords.p2 ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="text-[10px] text-gray-500 bg-slate-50 p-2 rounded">
                  * Password must be at least 8 characters long and include numbers and special characters.
                </div>
                <Button type="submit" className="w-full h-11 bg-green-600 hover:bg-green-700 font-bold" disabled={isLoading}>
                  {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "ACTIVATE ACCOUNT"}
                </Button>
              </form>
            )}

            <div className="mt-4 text-center">
              <Link to={ROUTES.LOGIN} className="text-xs text-primary hover:underline">
                Back to Login
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Register;

