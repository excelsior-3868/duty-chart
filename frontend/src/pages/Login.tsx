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

    useEffect(() => {
        document.title = "Login - Duty Chart";
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (submitting) return;
        setSubmitting(true);
        try {
            const res = await publicApi.post("/token/", {
                email: formData.username.trim(),
                password: formData.password,
            });

            if (res.data['2fa_required']) {
                setLogin2FAInfo(res.data);
                setShowOTP(true);
                toast.info(`Two-Factor Authentication required. OTP sent to ${res.data.phone_mask}`);
                return;
            }

            const { access, refresh, first_login } = res.data;

            localStorage.setItem("access", access);
            localStorage.setItem("refresh", refresh);

            // Store first_login flag if present
            if (first_login !== undefined) {
                localStorage.setItem("first_login", String(first_login));
            }

            // Fetch user data to populate AuthContext
            await refreshUser();

            toast.success("Login successful");

            // Navigate based on first_login flag
            if (first_login) {
                navigate(ROUTES.CHANGE_PASSWORD);
            } else {
                navigate(ROUTES.DASHBOARD);
            }
        } catch (err: any) {
            toast.error(err.response?.data?.detail || "Invalid credentials");
            console.error("Login error:", err);
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
            toast.error(err.response?.data?.detail || "Invalid OTP");
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
                                    id="username"
                                    type="text"
                                    placeholder="Username"
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
                                {submitting ? (
                                    <>
                                        <Loader2 className="h-4 w-4 animate-spin" />
                                        Signing in…
                                    </>
                                ) : (
                                    "Login"
                                )}
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
            <Dialog open={showOTP} onOpenChange={setShowOTP}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="flex items-center gap-2">
                            <ShieldCheck className="h-5 w-5 text-primary" />
                            Two-Factor Authentication
                        </DialogTitle>
                        <DialogDescription>
                            We've sent a 4-digit verification code to your phone: <strong>{login2FAInfo?.phone_mask}</strong>
                        </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleVerify2FA}>
                        <div className="py-4">
                            <Label htmlFor="2fa-otp" className="sr-only">OTP</Label>
                            <Input
                                id="2fa-otp"
                                placeholder="Enter 4-digit code"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                className="text-center text-2xl tracking-widest"
                                maxLength={4}
                                required
                                autoFocus
                            />
                        </div>
                        <DialogFooter>
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setShowOTP(false)}
                                disabled={submitting}
                            >
                                Cancel
                            </Button>
                            <Button
                                type="submit"
                                className="bg-primary text-white"
                                disabled={submitting || otp.length < 4}
                            >
                                {submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                                Verify & Login
                            </Button>
                        </DialogFooter>
                    </form>
                </DialogContent>
            </Dialog>

            <PasswordResetModal isOpen={resetOpen} onClose={() => setResetOpen(false)} />
        </div>
    );
};

export default Login;
