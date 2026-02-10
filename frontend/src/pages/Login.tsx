import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import publicApi from "@/services/publicApi";
import { useAuth } from "@/context/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from "@/components/ui/dialog";
import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { ROUTES, APP_NAME, COMPANY_NAME } from "@/utils/constants";
import { toast } from "sonner";
import telecomLogo from "@/assets/telecom.png";
import { PasswordResetModal } from "@/components/auth/PasswordResetModal";
import { Loader2 } from "lucide-react";

const Login = () => {
    const navigate = useNavigate();
    const { refreshUser } = useAuth();
    const [showPassword, setShowPassword] = useState(false);
    const [resetOpen, setResetOpen] = useState(false);
    const [formData, setFormData] = useState({ username: "", password: "" });
    const [submitting, setSubmitting] = useState(false);
    const [rememberMe, setRememberMe] = useState(false);

    // 2FA States
    const [showOTP, setShowOTP] = useState(false);
    const [otp, setOtp] = useState("");
    const [login2FAInfo, setLogin2FAInfo] = useState<{ '2fa_required'?: boolean, phone_mask?: string, username?: string } | null>(null);
    const [timer, setTimer] = useState(300);
    const [canResend, setCanResend] = useState(false);

    useEffect(() => {
        let interval: any;
        if (showOTP && timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        } else if (timer === 0) {
            setCanResend(true);
            clearInterval(interval);
        }
        return () => clearInterval(interval);
    }, [showOTP, timer]);

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const handleResendOTP = async () => {
        if (!canResend) return;
        setSubmitting(true);
        try {
            await publicApi.post("/token/", {
                employee_id: formData.username.trim(),
                password: formData.password,
            });
            setTimer(300);
            setCanResend(false);
            setOtp("");
            toast.success("A new verification code has been sent.");
        } catch (error) {
            toast.error("Failed to resend OTP. Please try logging in again.");
        } finally {
            setSubmitting(false);
        }
    };

    useEffect(() => {
        document.title = "Login - Duty Chart";
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const res = await publicApi.post("/token/", {
                employee_id: formData.username.trim(),
                password: formData.password,
            });

            if (res.data['2fa_required']) {
                setLogin2FAInfo(res.data);
                setShowOTP(true);
                setTimer(300);
                setCanResend(false);
                setOtp("");
                // toast.info(`Two-Factor Authentication required. OTP sent to ${res.data.phone_mask}`);
                return;
            }
            // ... rest of the logic ...
            const { access, refresh, first_login } = res.data;
            // ... (lines 61-111) ...
            localStorage.setItem("access", access);
            localStorage.setItem("refresh", refresh);

            if (first_login !== undefined) {
                localStorage.setItem("first_login", String(first_login));
            }

            await refreshUser();
            toast.success("Login successful");

            if (first_login) {
                navigate(ROUTES.CHANGE_PASSWORD);
            } else {
                navigate(ROUTES.DASHBOARD);
            }
        } catch (err: any) {
            console.error("Login error:", err);
            if (!err.response) {
                toast.error("Network error. Please check your connection.");
                return;
            }
            const status = err.response.status;
            const data = err.response.data;

            if (status === 401) {
                toast.error(data?.detail || "Invalid Employee ID or Password");
            } else if (status === 403) {
                toast.error(data?.detail || "Account is inactive or locked");
            } else if (status === 429) {
                toast.error("Too many login attempts. Please try again later.");
            } else if (status >= 500) {
                toast.error("Server error. Please try again later.");
            } else {
                toast.error(data?.detail || "Login failed. Please try again.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    const handleVerify2FA = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const res = await publicApi.post("/token/verify-2fa/", {
                username: login2FAInfo?.username,
                otp: otp
            });

            const { access, refresh } = res.data;
            localStorage.setItem("access", access);
            localStorage.setItem("refresh", refresh);

            await refreshUser();
            toast.success("Login successful");
            navigate(ROUTES.DASHBOARD);
        } catch (err: any) {
            console.error("2FA error:", err);
            if (!err.response) {
                toast.error("Network error. Please check your connection.");
                return;
            }
            const status = err.response.status;
            const data = err.response.data;

            if (status === 400 || status === 401) {
                toast.error(data?.detail || "Invalid OTP");
            } else if (status >= 500) {
                toast.error("Server error. Please try again later.");
            } else {
                toast.error(data?.detail || "Verification failed.");
            }
        } finally {
            setSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center font-sans gradient-background p-4 py-12">
            <div className="w-full max-w-xs">
                <Card
                    className="shadow-lg border-0 bg-white/90 backdrop-blur-sm"
                    style={{ borderRadius: "12px" }}
                >
                    <CardContent className="p-6">
                        {/* Logo Section */}
                        <div className="flex justify-center mb-1">
                            <div className="w-20 h-20 flex items-center justify-center">
                                <img
                                    src={telecomLogo}
                                    alt="Nepal Telecom Logo"
                                    className="w-full h-full object-contain drop-shadow-lg"
                                />
                            </div>
                        </div>

                        {/* Company Info */}
                        <div className="text-center mb-1">
                            <div className="text-xl font-bold text-gray-800">{COMPANY_NAME}</div>
                            <div className="text-primary font-medium text-sm">{APP_NAME}</div>
                        </div>

                        {/* Divider */}
                        <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent my-2"></div>

                        <h1
                            className="text-2xl font-semibold mb-1 text-center pt-2 pb-1 text-primary"

                        >
                            Login
                        </h1>
                        <form onSubmit={handleSubmit} className="space-y-3">
                            <div className="space-y-1">
                                <Input
                                    id="employee_id"
                                    type="text"
                                    placeholder="Employee ID"
                                    className="bg-white border border-gray-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
                                    style={{ borderRadius: "8px" }}
                                    value={formData.username}
                                    onChange={(e) =>
                                        setFormData({ ...formData, username: e.target.value })
                                    }
                                    required
                                    disabled={submitting}
                                />
                            </div>

                            <div className="space-y-1">
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Password"
                                        className="pr-9 bg-white border border-gray-300 focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-0 focus-visible:border-primary"
                                        style={{ borderRadius: "8px" }}
                                        value={formData.password}
                                        onChange={(e) =>
                                            setFormData({ ...formData, password: e.target.value })
                                        }
                                        required
                                        disabled={submitting}
                                    />
                                    <button
                                        type="button"
                                        tabIndex={-1}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                                        onClick={() => setShowPassword(!showPassword)}
                                        disabled={submitting}
                                    >
                                        {showPassword ? (
                                            <EyeOff className="h-4 w-4" />
                                        ) : (
                                            <Eye className="h-4 w-4" />
                                        )}
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center justify-between px-1">
                                <div className="flex items-center space-x-2">
                                    <input
                                        type="checkbox"
                                        id="remember"
                                        checked={rememberMe}
                                        onChange={(e) => setRememberMe(e.target.checked)}
                                        className="h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <Label
                                        htmlFor="remember"
                                        className="text-sm text-gray-600 cursor-pointer font-normal"
                                    >
                                        Remember me
                                    </Label>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setResetOpen(true)}
                                    className="text-sm hover:underline text-primary"
                                >
                                    Forgot Password?
                                </button>
                            </div>

                            <button
                                type="submit"
                                className="w-full text-white font-medium py-2.5 transition-colors flex items-center justify-center gap-2 mt-2 bg-primary hover:bg-primary-hover rounded-lg"
                                disabled={submitting}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Login"}
                            </button>

                            <div className="text-center mt-4">
                                <p className="text-sm text-gray-600">
                                    Don't have an account?{" "}
                                    <button
                                        type="button"
                                        onClick={() => navigate(ROUTES.REGISTER)}
                                        className="font-medium hover:underline text-primary"
                                    >
                                        Sign up
                                    </button>
                                </p>
                            </div>
                        </form>
                    </CardContent>
                </Card>
            </div>

            {/* 2FA Dialog */}
            <Dialog open={showOTP} onOpenChange={(open) => {
                if (!open && !submitting) setShowOTP(false);
            }}>
                <DialogContent className="sm:max-w-md border-0 shadow-2xl p-0 overflow-hidden" style={{ borderRadius: '16px' }}>
                    <div className="p-8 space-y-6">
                        <div className="space-y-2 text-center">
                            <h2 className="text-xl font-bold text-gray-800 flex items-center justify-center gap-2">
                                🔐 Enter Verification Code
                            </h2>
                            <p className="text-sm text-gray-500">
                                Enter the verification code we sent to your registered mobile number ending in <span className="font-semibold text-primary">{login2FAInfo?.phone_mask?.slice(-4)}</span>
                            </p>
                        </div>

                        <div className="text-center space-y-1">
                            <p className="text-sm font-medium text-gray-400">Code expires in</p>
                            <p className={`text-2xl font-mono font-bold ${timer < 30 ? 'text-red-500 animate-pulse' : 'text-primary'}`}>
                                {formatTime(timer)}
                            </p>
                        </div>

                        <form onSubmit={handleVerify2FA} className="space-y-6">
                            <div className="flex justify-center">
                                <Input
                                    id="2fa-otp"
                                    placeholder="••••"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                    className="text-center text-3xl tracking-[1em] h-16 w-full max-w-[240px] border-2 border-gray-100 focus:border-primary focus:ring-4 focus:ring-primary/10 transition-all font-bold placeholder:text-gray-200"
                                    maxLength={6}
                                    required
                                    autoFocus
                                    autoComplete="one-time-code"
                                />
                            </div>

                            <Button
                                type="submit"
                                className="w-full h-12 text-lg font-semibold bg-primary hover:bg-primary-hover shadow-lg shadow-primary/20"
                                disabled={submitting || otp.length < 4 || timer === 0}
                            >
                                {submitting ? <Loader2 className="h-5 w-5 animate-spin" /> : "Verify Code"}
                            </Button>
                        </form>

                        <div className="flex gap-3 pt-2">
                            <Button
                                type="button"
                                variant="secondary"
                                className="flex-1 h-11 font-medium bg-slate-100 hover:bg-slate-200 text-slate-700"
                                onClick={handleResendOTP}
                                disabled={!canResend || submitting}
                            >
                                {canResend ? "Resend Code" : `Resend in ${timer}s`}
                            </Button>
                            <Button
                                type="button"
                                variant="outline"
                                className="flex-1 h-11 font-medium border-slate-200 text-slate-500 hover:bg-slate-50"
                                onClick={() => setShowOTP(false)}
                                disabled={submitting}
                            >
                                ← Back
                            </Button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>

            <PasswordResetModal isOpen={resetOpen} onClose={() => setResetOpen(false)} />
        </div>
    );
};

export default Login;
