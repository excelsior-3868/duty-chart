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
import { Eye, EyeOff } from "lucide-react";
import { ROUTES, APP_NAME, COMPANY_NAME } from "@/utils/constants";
import { toast } from "sonner";
import telecomLogo from "@/assets/telecom.png";
import { Loader2 } from "lucide-react";

const Login = () => {
  const navigate = useNavigate();
  const { refreshUser } = useAuth();
  const [showPassword, setShowPassword] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [formData, setFormData] = useState({ username: "", password: "" });
  const [resetId, setResetId] = useState("");
  const [submitting, setSubmitting] = useState(false);

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
      toast.error("Invalid credentials");
      console.error("Login error:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center font-sans gradient-background p-4 pt-20 pb-20">
      <div className="w-full max-w-md">
        <Card
          className="shadow-lg border-0 bg-white/90 backdrop-blur-sm"
          style={{ borderRadius: "12px" }}
        >
          <CardContent className="p-8">
            {/* Logo Section */}
            <div className="flex justify-center mb-2 ">
              <div className="w-24 h-24 flex items-center justify-center">
                <img
                  src={telecomLogo}
                  alt="Nepal Telecom Logo"
                  className="w-full h-full object-contain drop-shadow-lg"
                />
              </div>
            </div>

            {/* Company Info */}
            <div className="text-center mb-2">
              <div className="text-xl font-bold text-gray-800">{COMPANY_NAME}</div>
              <div className="text-blue-600 font-medium text-sm">{APP_NAME}</div>
            </div>

            {/* Divider */}
            <div className="h-px bg-gradient-to-r from-transparent via-blue-200 to-transparent my-4"></div>

            <h1
              className="text-2xl font-semibold mb-3 text-center pt-5 pb-2"
              style={{ color: "#004e9a" }}
            >
              Login
            </h1>
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-2">
                <Label htmlFor="username" className="text-gray-700 font-medium">
                  Email
                </Label>
                <Input
                  id="username"
                  type="text"
                  className="bg-white border border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:border-blue-500"
                  style={{ borderRadius: "8px" }}
                  value={formData.username}
                  onChange={(e) =>
                    setFormData({ ...formData, username: e.target.value })
                  }
                  required
                  disabled={submitting}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-gray-700 font-medium">
                  Password
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pr-9 bg-white border border-gray-300 focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-0 focus-visible:border-blue-500"
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

              <div className="text-right">
                <button
                  type="button"
                  onClick={() => setResetOpen(true)}
                  className="text-sm hover:underline"
                  style={{ color: "#004e9a" }}
                >
                  Forgot Password?
                </button>
              </div>

              <button
                type="submit"
                className="w-full  text-white font-medium py-2.5 transition-colors flex items-center justify-center gap-2"
                style={{ backgroundColor: "#004e9a", borderRadius: "8px" }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.backgroundColor = "#003a7a")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.backgroundColor = "#004e9a")
                }
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
            </form>
          </CardContent>
        </Card>
      </div>

      <Dialog open={resetOpen} onOpenChange={setResetOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Reset Password</DialogTitle>
            <DialogDescription>
              Enter your Employee ID or email. We will send you instructions to
              reset your password.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="resetId">Employee ID / Email</Label>
            <Input
              id="resetId"
              value={resetId}
              onChange={(e) => setResetId(e.target.value)}
              placeholder="e.g. 123456 or name@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResetOpen(false)}>
              Cancel
            </Button>
            <Button
              onClick={() => {
                setResetOpen(false);
                toast.success("Password reset link sent");
              }}
              className="bg-[hsl(var(--nt-primary))] hover:bg-[hsl(var(--nt-primary-hover))] text-white"
            >
              Send Reset Link
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Login;
