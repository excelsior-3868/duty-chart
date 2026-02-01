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
    const [username, setUsername] = useState("");
    const [channels, setChannels] = useState<Channel[]>([]);
    const [selectedChannel, setSelectedChannel] = useState<string>("");
    const [requestId, setRequestId] = useState("");
    const [otp, setOtp] = useState("");
    const [newPassword, setNewPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [maskedPhone, setMaskedPhone] = useState("");
    const [showNewPassword, setShowNewPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);

    const handleLookup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!username) return;

        setIsLoading(true);
        try {
            const { data } = await publicApi.post("/v1/otp/lookup/", { username });
            if (data.exists && data.channels.length > 0) {
                setChannels(data.channels);
                const smsChannel = data.channels.find((ch: Channel) => ch.type === 'sms_ntc');
                setSelectedChannel(smsChannel ? 'sms_ntc' : data.channels[0].type);
                setStep("SELECT_CHANNEL");
            } else {
                toast.error("No account found with provided details.");
            }
        } catch (error: any) {
            toast.error("Failed to lookup user.");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRequestOTP = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedChannel) return;

        setIsLoading(true);
        try {
            const { data } = await publicApi.post("/v1/otp/request/", {
                username,
                channel: selectedChannel,
                purpose: "forgot_password",
            });

            setRequestId(data.request_id);
            if (data.masked_phone && selectedChannel === 'sms_ntc') {
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
            setUsername("");
            setOtp("");
            setNewPassword("");
            setConfirmPassword("");
            setChannels([]);
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
                    <DialogTitle>Reset Password</DialogTitle>
                    <DialogDescription>
                        {step === "LOOKUP" && "Enter your Email or Phone Number or Employee ID."}
                        {step === "SELECT_CHANNEL" && "Choose how you want to receive the OTP."}
                        {step === "VALIDATE" && "Enter the OTP sent to you."}
                        {step === "RESET" && "Enter your new password."}
                    </DialogDescription>
                </DialogHeader>

                {step === "LOOKUP" && (
                    <form onSubmit={handleLookup} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="username">Username</Label>
                            <Input
                                id="username"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                placeholder="Enter your credential"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Continue
                        </Button>
                    </form>
                )}

                {step === "SELECT_CHANNEL" && (
                    <form onSubmit={handleRequestOTP} className="space-y-4">
                        <div className="space-y-3">
                            <Label>Select Verification Method</Label>
                            {channels.map((ch) => (
                                <div key={ch.type} className="flex items-center space-x-2 border p-3 rounded-md cursor-pointer hover:bg-slate-50" onClick={() => setSelectedChannel(ch.type)}>
                                    <input
                                        type="radio"
                                        name="channel"
                                        value={ch.type}
                                        checked={selectedChannel === ch.type}
                                        onChange={() => setSelectedChannel(ch.type)}
                                        className="h-4 w-4 border-gray-300 text-blue-600 focus:ring-blue-500"
                                    />
                                    <span className="text-sm font-medium">{ch.label}</span>
                                </div>
                            ))}
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading || !selectedChannel}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Send OTP
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

                {step === "VALIDATE" && (
                    <form onSubmit={handleValidateOTP} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="otp">One-Time Password (OTP)</Label>
                            <Input
                                id="otp"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value)}
                                placeholder="Enter 6-digit OTP"
                                required
                            />
                        </div>
                        <Button type="submit" className="w-full" disabled={isLoading}>
                            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            Verify OTP
                        </Button>
                        <Button
                            type="button"
                            variant="link"
                            className="w-full"
                            onClick={() => setStep("SELECT_CHANNEL")}
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
