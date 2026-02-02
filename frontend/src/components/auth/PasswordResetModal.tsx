import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@/components/ui/dialog";
import publicApi from "@/services/publicApi";
import { toast } from "sonner";
import { Loader2, Eye, EyeOff } from "lucide-react";

interface PasswordResetModalProps {
    isOpen: boolean;
    onClose: () => void;
}

type Step = "LOOKUP" | "SELECT_CHANNEL" | "VALIDATE" | "RESET";

interface Channel {
    type: string;
    value: string;
    label: string;
}

export function PasswordResetModal({ isOpen, onClose }: PasswordResetModalProps) {
    const [step, setStep] = useState<Step>("LOOKUP");
    const [isLoading, setIsLoading] = useState(false);
    const [email, setEmail] = useState("");
    const [phone, setPhone] = useState("");
    const [requestId, setRequestId] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [maskedPhone, setMaskedPhone] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleSendOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email || !phone) return;

        setIsLoading(true);
        try {
            const { data } = await publicApi.post("/v1/otp/request/", {
                email: email,
                phone: phone,
                channel: "sms_ntc",
                purpose: "forgot_password",
            });

            setRequestId(data.request_id);
            if (data.masked_phone) {
                setMaskedPhone(data.masked_phone);
                toast.success(`OTP sent to ${data.masked_phone}`);
            } else {
                toast.success("OTP sent.");
            }
            setStep("VALIDATE");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to send OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleValidateOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!otp) return;

        setIsLoading(true);
        try {
            await publicApi.post("/v1/otp/validate/", {
                request_id: requestId,
                otp,
            });
            toast.success("OTP verified successfully");
            setStep("RESET");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Invalid OTP");
        } finally {
            setIsLoading(false);
        }
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (newPassword !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }

        setIsLoading(true);
        try {
            await publicApi.post("/v1/otp/password/reset/", {
                request_id: requestId,
                new_password: newPassword,
            });
            toast.success("Password reset successfully. Please login.");
            onClose();
            // Reset state
            setStep("LOOKUP");
            setEmail("");
            setPhone("");
            setOtp("");
            setNewPassword("");
            setConfirmPassword("");
        } catch (error: any) {
            toast.error(error.response?.data?.message || "Failed to reset password");
            console.error("Reset Password Error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle>Forgot Password?</DialogTitle>
                    <DialogDescription>
                        {step === "LOOKUP" && "Enter your Email Address and Phone Number."}
                        {step === "VALIDATE" && "Enter the OTP sent to you."}
                        {step === "RESET" && "Enter your new password."}
                    </DialogDescription>
                </DialogHeader>

                {step === "LOOKUP" && (
                    <form onSubmit={handleSendOTP} className="space-y-4">
                        <div className="space-y-4 pt-4">
                            <Input
                                id="email"
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="Email Address *"
                                required
                                className="h-12 text-lg"
                            />

                            <div className="flex gap-2">
                                <Input
                                    id="phone"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    placeholder="Phone *"
                                    required
                                    className="h-12 text-lg flex-1"
                                />
                                <Button
                                    type="submit"
                                    disabled={isLoading}
                                    className="h-12 px-6 font-bold bg-[#1F5CA9] hover:bg-[#1a4d8c]"
                                >
                                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "SEND OTP"}
                                </Button>
                            </div>
                        </div>
                    </form>
                )}

                {step === "VALIDATE" && (
                    <form onSubmit={handleValidateOTP} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="otp">One-Time Password (OTP)</Label>
                            <Input
                                id="otp"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 4-digit OTP"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full h-12 font-bold bg-[#1F5CA9] hover:bg-[#1a4d8c]" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            VERIFY OTP
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            className="w-full"
                            onClick={() => setStep("LOOKUP")}
                        >
                            Back
                        </Button>
                    </form>
                )}

                {step === "RESET" && (
                    <form onSubmit={handleResetPassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="newPassword">New Password</Label>
                            <div className="relative">
                                <Input
                                    id="newPassword"
                                    type={showNewPassword ? "text" : "password"}
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                    placeholder="Enter new password"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowNewPassword(!showNewPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    tabIndex={-1}
                                >
                                    {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword">Confirm Password</Label>
                            <div className="relative">
                                <Input
                                    id="confirmPassword"
                                    type={showConfirmPassword ? "text" : "password"}
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="Confirm new password"
                                    required
                                    minLength={8}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                                    tabIndex={-1}
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Reset Password
                        </Button>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
}
