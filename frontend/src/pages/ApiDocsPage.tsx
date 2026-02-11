import React, { useEffect, useState } from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

export default function ApiDocsPage() {
    const [isLoading, setIsLoading] = useState(true);
    // Point directly to Swagger UI since the user is now authenticated
    const swaggerUrl = "http://localhost:8000/swagger/";

    useEffect(() => {
        document.title = "API Documentation - NT Duty Chart Management System";
    }, []);

    return (
        <div className="p-6 h-[calc(100vh-4rem)] flex flex-col gap-6">
            <div>
                <h1 className="text-2xl font-bold text-primary">API Documentation</h1>
                <p className="text-muted-foreground">Interactive API reference (Swagger UI)</p>
            </div>

            <Card className="flex-1 flex flex-col overflow-hidden border-none shadow-sm">
                <CardContent className="p-0 flex-1 relative bg-slate-50">
                    {isLoading && (
                        <div className="absolute inset-0 flex items-center justify-center bg-white/80 z-10">
                            <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        </div>
                    )}
                    <iframe
                        src={swaggerUrl}
                        className="w-full h-full border-none"
                        title="API Documentation"
                        onLoad={() => setIsLoading(false)}
                        allow="clipboard-write"
                    />
                </CardContent>
            </Card>
        </div>
    );
}
