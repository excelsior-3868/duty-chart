import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Upload, Calendar, Trash2, CheckCircle2, AlertCircle, Loader2, Search, X } from 'lucide-react';
import api from '@/services/api';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import NepaliDate from "nepali-date-converter";

interface Holiday {
  id?: number;
  date: string;
  name: string;
  is_public: boolean;
}

interface HolidayManagerProps {
  settings: any;
  setSettings: (s: any) => void;
  onSave: () => void;
  saving: boolean;
}

export const HolidayManager = ({ settings, setSettings, onSave, saving }: HolidayManagerProps) => {
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [previewData, setPreviewData] = useState<Holiday[]>([]);
  const [showPreview, setShowPreview] = useState(false);
  const [search, setSearch] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchHolidays();
  }, []);

  const getNepaliDate = (isoDate: string) => {
    try {
      const d = new Date(isoDate);
      const nepali = new NepaliDate(d);
      return nepali.format("YYYY-MM-DD");
    } catch {
      return isoDate;
    }
  };

  const getDayName = (isoDate: string) => {
    try {
      return format(new Date(isoDate), 'EEEE');
    } catch {
      return "";
    }
  };

  const fetchHolidays = async () => {
    setLoading(true);
    try {
      const { data } = await api.get('holidays/');
      setHolidays(data);
    } catch (err) {
      toast.error("Failed to load holidays");
    } finally {
      setLoading(false);
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    setUploading(true);
    try {
      const { data } = await api.post('holidays/preview-upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' }
      });
      
      const newPreview = data.preview || [];
      setPreviewData(newPreview);
      
      if (newPreview.length === 0) {
        if (data.skipped && data.skipped.length > 0) {
          toast.error(`No valid holidays found. ${data.skipped.length} rows were skipped due to errors.`);
        } else {
          toast.warning("No holiday data found in the file. Please check the column names.");
        }
        setShowPreview(false);
      } else {
        setShowPreview(true);
        if (data.skipped && data.skipped.length > 0) {
          toast.warning(`Showing ${newPreview.length} holidays. ${data.skipped.length} rows were skipped.`);
        } else {
          toast.info(`Previewing ${newPreview.length} holidays from file`);
        }
      }
    } catch (err: any) {
      console.error("Upload Error:", err);
      toast.error(err.response?.data?.error || "Failed to parse file");
      setShowPreview(false);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleBulkUpload = async () => {
    if (previewData.length === 0) return;

    setUploading(true);
    try {
      await api.post('holidays/bulk-upload/', previewData);
      toast.success("Holidays uploaded successfully");
      setPreviewData([]);
      setShowPreview(false);
      fetchHolidays();
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to upload holidays");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this holiday?")) return;
    try {
      await api.delete(`holidays/${id}/`);
      toast.success("Holiday deleted");
      fetchHolidays();
    } catch (err) {
      toast.error("Failed to delete holiday");
    }
  };

  const filteredHolidays = holidays.filter(h => 
    h.name.toLowerCase().includes(search.toLowerCase()) || 
    h.date.includes(search)
  );

  return (
    <div className="space-y-6">

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1 space-y-6">
          {/* Upload Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Holidays
              </CardTitle>
              <CardDescription>Upload an Excel file with holiday data</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div 
                className="border-2 border-dashed border-muted rounded-lg p-6 flex flex-col items-center justify-center gap-3 hover:border-primary/50 transition-colors cursor-pointer"
                onClick={() => fileInputRef.current?.click()}
              >
                <input 
                  type="file" 
                  ref={fileInputRef} 
                  className="hidden" 
                  accept=".xlsx,.xls" 
                  onChange={handleFileChange}
                />
                {uploading ? (
                  <>
                    <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    <p className="text-sm font-medium">Processing...</p>
                  </>
                ) : (
                  <>
                    <div className="bg-primary/10 p-3 rounded-full">
                      <Calendar className="h-6 w-6 text-primary" />
                    </div>
                    <div className="text-center">
                      <p className="text-sm font-medium">Click to upload Excel</p>
                      <p className="text-xs text-muted-foreground mt-1">Columns: Date, Name</p>
                    </div>
                  </>
                )}
              </div>

              {previewData.length > 0 && (
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <Badge variant="secondary" className="px-2 py-1">
                      {previewData.length} New Holidays Detected
                    </Badge>
                    <Button variant="ghost" size="sm" onClick={() => setPreviewData([])} className="h-8 text-xs">
                      <X className="h-3 w-3 mr-1" /> Clear
                    </Button>
                  </div>
                  <Button className="w-full" onClick={handleBulkUpload} disabled={uploading}>
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Confirm & Save
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sunday Holiday Configuration */}
          <Card className="border-blue-100 shadow-sm overflow-hidden">
            <CardHeader className="py-4 bg-slate-50/50 border-b">
              <CardTitle className="text-sm font-bold flex items-center gap-2 text-primary">
                <Calendar className="h-4 w-4" />
                Calendar Configuration
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="sunday-holiday" className="text-xs font-bold uppercase tracking-wider text-slate-500">Sunday as Holiday</Label>
                  <Switch 
                    id="sunday-holiday" 
                    checked={settings.show_sunday_as_holiday}
                    onCheckedChange={(checked) => setSettings({ ...settings, show_sunday_as_holiday: checked })}
                  />
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Highlight Sundays in red on the calendar system-wide.
                </p>
              </div>
              <Button 
                size="sm" 
                onClick={onSave} 
                disabled={saving}
                className="w-full h-9 font-bold"
              >
                {saving ? <Loader2 className="h-3 w-3 animate-spin mr-2" /> : <CheckCircle2 className="h-3 w-3 mr-2" />}
                Save Preference
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* List Card */}
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Holiday List
                </CardTitle>
                <CardDescription>Manage your system holidays</CardDescription>
              </div>
              <div className="relative w-48">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search..." 
                  className="pl-8 h-9" 
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center p-8">
                <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
              </div>
            ) : (
              <div className="max-h-[500px] overflow-auto border rounded-md">
                <Table>
                  <TableHeader className="bg-slate-50 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-[180px]">Date (AD / BS)</TableHead>
                      <TableHead>Day</TableHead>
                      <TableHead>Holiday Name</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredHolidays.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">
                          {search ? "No matches found" : "No holidays added yet"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredHolidays.map((holiday) => (
                        <TableRow key={holiday.id} className="hover:bg-slate-50/50">
                          <TableCell className="py-3">
                            <div className="flex flex-col">
                              <span className="font-bold text-slate-800 text-sm">{format(new Date(holiday.date), 'MMM dd, yyyy')}</span>
                              <span className="text-[11px] font-mono font-semibold text-primary">{getNepaliDate(holiday.date)}</span>
                            </div>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold text-slate-500 italic">{getDayName(holiday.date)}</span>
                          </TableCell>
                          <TableCell className="font-semibold text-slate-700">{holiday.name}</TableCell>
                          <TableCell>
                            <Badge variant={holiday.is_public ? "default" : "secondary"} className="text-[10px] uppercase font-bold tracking-wider">
                              {holiday.is_public ? "Public" : "Office"}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="h-8 w-8 text-red-500 hover:text-red-700 hover:bg-red-50"
                              onClick={() => holiday.id && handleDelete(holiday.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Preview Dialog */}
      <Dialog open={showPreview} onOpenChange={setShowPreview}>
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-blue-500" />
              Holiday Import Preview
            </DialogTitle>
            <DialogDescription>
              We found {previewData.length} holidays in your file. Please review them before saving.
            </DialogDescription>
          </DialogHeader>
          
          <div className="flex-1 overflow-auto my-4 border rounded-md">
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0">
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Holiday Name</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {previewData.map((p, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{p.date}</TableCell>
                    <TableCell>{p.name}</TableCell>
                    <TableCell>
                      <Badge variant={p.is_public ? "default" : "secondary"}>
                        {p.is_public ? "Public" : "Office"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPreviewData([])} disabled={uploading}>
              Cancel
            </Button>
            <Button onClick={handleBulkUpload} disabled={uploading}>
              {uploading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  Uploading...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2" />
                  Confirm & Save All
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};
