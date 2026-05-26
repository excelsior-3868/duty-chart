import React, { useState } from "react";
import * as XLSX from "xlsx";
import { NetworkKey, Assignment } from "./WeekScheduleTable";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { FileUp, AlertCircle } from "lucide-react";

interface BulkUploadProps {
  onUpload: (
    assignments: Array<{
      employee: string;
      network: NetworkKey;
      shift: "morning" | "afternoon" | "night";
      date: string;
    }>
  ) => void;
}

export const BulkUpload: React.FC<BulkUploadProps> = ({ onUpload }) => {
  const [error, setError] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = evt.target?.result;
      if (!data) return;

      try {
        const workbook = XLSX.read(data, { type: "binary" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet, { raw: false });

        const requiredColumns = ["employee", "network", "shift", "date"];
        const missingColumns = requiredColumns.filter(
          (col) => !Object.keys(jsonData[0] || {}).includes(col)
        );
        if (missingColumns.length) {
          setError(`Missing columns: ${missingColumns.join(", ")}`);
          return;
        }

        const formatted: Array<{
          employee: string;
          network: NetworkKey;
          shift: "morning" | "afternoon" | "night";
          date: string;
        }> = [];

        for (let i = 0; i < jsonData.length; i++) {
          const row = jsonData[i];
          const network = row.network as NetworkKey;
          const shift = row.shift.toLowerCase() as
            | "morning"
            | "afternoon"
            | "night";

          if (!["Network A", "Network B", "Network C"].includes(network)) {
            setError(`Invalid network at row ${i + 2}`);
            return;
          }

          if (!["morning", "afternoon", "night"].includes(shift)) {
            setError(`Invalid shift at row ${i + 2}`);
            return;
          }

          formatted.push({
            employee: row.employee,
            network,
            shift,
            date: row.date,
          });
        }

        setError("");
        onUpload(formatted);
      } catch (err) {
        console.error(err);
        setError("Failed to read Excel file.");
      }
    };

    reader.readAsBinaryString(file);
  };

  return (
    <Card className="max-w-md hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileUp className="h-5 w-5 text-primary" />
          Bulk Upload Assignments
        </CardTitle>
        <CardDescription>
          Upload an Excel file to assign duties in bulk.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3">
          <input
            id="file-upload"
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="hidden"
          />
          <Label htmlFor="file-upload" className="w-full">
            <Button variant="outline" className="w-full border-dashed py-8 h-auto flex flex-col gap-2" asChild>
              <label htmlFor="file-upload" className="cursor-pointer font-normal">
                <FileUp className="h-8 w-8 text-muted-foreground" />
                <span>Click to choose or drag & drop</span>
                <span className="text-xs text-muted-foreground">.xlsx or .xls files</span>
              </label>
            </Button>
          </Label>

          {error && (
            <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 p-3 rounded-md">
              <AlertCircle className="h-4 w-4" />
              {error}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
