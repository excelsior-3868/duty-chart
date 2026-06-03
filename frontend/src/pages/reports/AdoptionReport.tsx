// File: src/pages/reports/AdoptionReport.tsx

import { useState, useEffect, useMemo } from "react";
import api from "@/services/api";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/PageHeader";
import { 
  Building, 
  TrendingUp, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  RefreshCw,
  ArrowUpDown,
  Check,
  ChevronsUpDown
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { cn } from "@/lib/utils";
import { getOffices, type Office } from "@/services/offices";
import { getDirectorates, type Directorate } from "@/services/directorates";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip";
import NepaliDate from "nepali-date-converter";

interface EmployeeDetail {
  employee_id: string;
  name: string;
}

interface RosterChartDetail {
  id: number;
  name: string;
  start_date: string;
  end_date: string;
  nepali_start_date?: string;
  nepali_end_date?: string;
  employee_count: number;
  employees?: EmployeeDetail[];
}

interface AdoptionSummary {
  total_offices: number;
  started_offices: number;
  not_started_offices: number;
  adoption_rate: number;
}

interface OfficeAdoptionData {
  id: number;
  name: string;
  directorate_name: string;
  ac_office_name: string;
  cc_office_name: string;
  duty_chart_count: number;
  duty_count: number;
  last_activity: string | null;
  has_started: boolean;
  charts?: RosterChartDetail[];
}

// Global module-level cache to persist data across page navigation (component unmounting)
let globalAdoptionCache: Record<string, { summary: AdoptionSummary; offices: OfficeAdoptionData[] }> = {};

function AdoptionReport() {
  // Filters
  const [selectedDirectorateId, setSelectedDirectorateId] = useState<string>("");
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>("");
  const [officeOpen, setOfficeOpen] = useState<boolean>(false);
  const [directorateOpen, setDirectorateOpen] = useState<boolean>(false);
  const [adoptionStatus, setAdoptionStatus] = useState<string>("all");

  // Pagination State
  const [page, setPage] = useState<number>(1);

  // Cache key based on both parameters
  const cacheKey = `${selectedDirectorateId || "all"}_${selectedOfficeId || "all"}`;

  // Cached Page Data / Loading States
  const [loading, setLoading] = useState<boolean>(!globalAdoptionCache[cacheKey]);
  const [data, setData] = useState<{ summary: AdoptionSummary; offices: OfficeAdoptionData[] }>(
    globalAdoptionCache[cacheKey] || {
      summary: { total_offices: 0, started_offices: 0, not_started_offices: 0, adoption_rate: 0 },
      offices: [],
    }
  );

  // Dropdown lists
  const [officesList, setOfficesList] = useState<Office[]>([]);
  const [directoratesList, setDirectoratesList] = useState<Directorate[]>([]);

  // Dialog states for Roster details modal
  const [isDetailOpen, setIsDetailOpen] = useState<boolean>(false);
  const [selectedOfficeForDetail, setSelectedOfficeForDetail] = useState<OfficeAdoptionData | null>(null);

  // Sorting
  const [sortField, setSortField] = useState<"name" | "duty_chart_count" | "duty_count" | "last_activity" | "has_started">("has_started");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");

  // Fetch filter options
  useEffect(() => {
    document.title = "Duty Chart Implementation - INOC Duty Roster";
    const fetchFilterOptions = async () => {
      try {
        const [officesData, directoratesData] = await Promise.all([
          getOffices(),
          getDirectorates({ all: true }) as Promise<Directorate[]>
        ]);
        setOfficesList(officesData || []);
        
        const allowedDirectorateIds = [13, 14, 15, 16, 17, 18];
        const filteredDirectorates = (directoratesData || []).filter(d =>
          allowedDirectorateIds.includes(d.id)
        );
        setDirectoratesList(filteredDirectorates);
      } catch (err) {
        console.error("Failed to load filter options", err);
      }
    };
    fetchFilterOptions();
  }, []);

  // Filter and sort offices list for the select combobox
  const sortedOfficesList = useMemo(() => {
    let list = officesList;
    if (selectedDirectorateId) {
      list = list.filter(o => String(o.directorate) === selectedDirectorateId);
    }
    return [...list].sort((a, b) => a.name.localeCompare(b.name));
  }, [officesList, selectedDirectorateId]);

  // Reset selected working office if it doesn't belong to the selected directorate
  useEffect(() => {
    if (selectedDirectorateId && selectedOfficeId) {
      const office = officesList.find(o => String(o.id) === selectedOfficeId);
      if (!office || String(office.directorate) !== selectedDirectorateId) {
        setSelectedOfficeId("");
      }
    }
  }, [selectedDirectorateId, selectedOfficeId, officesList]);

  // Fetch Adoption dataset
  const fetchAdoptionData = async (bypassCache: boolean = false) => {
    const currentCacheKey = `${selectedDirectorateId || "all"}_${selectedOfficeId || "all"}`;

    if (!bypassCache && globalAdoptionCache[currentCacheKey]) {
      setData(globalAdoptionCache[currentCacheKey]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const params: any = {};
      if (selectedOfficeId) params.office_id = selectedOfficeId;
      if (selectedDirectorateId) params.directorate_id = selectedDirectorateId;
      params._t = new Date().getTime(); // Prevent browser caching

      const res = await api.get("/reports/duties/adoption/", { params });
      setData(res.data);
      globalAdoptionCache[currentCacheKey] = res.data;
    } catch (err) {
      console.error("Failed to fetch adoption report", err);
      toast.error("Failed to load adoption report data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAdoptionData();
  }, [selectedOfficeId, selectedDirectorateId]);

  // Reset page to 1 when filters or sorting change
  useEffect(() => {
    setPage(1);
  }, [selectedOfficeId, selectedDirectorateId, adoptionStatus, sortField, sortOrder]);

  // Handle local sorting and status filter
  const filteredAndSortedOffices = useMemo(() => {
    let result = [...data.offices];

    // Status Filter
    if (adoptionStatus === "active") {
      result = result.filter(o => o.has_started);
    } else if (adoptionStatus === "pending") {
      result = result.filter(o => !o.has_started);
    }

    // Sorting
    result.sort((a, b) => {
      let valA: any = a[sortField];
      let valB: any = b[sortField];

      if (sortField === "name") {
        valA = (valA || "").toLowerCase();
        valB = (valB || "").toLowerCase();
      } else if (sortField === "last_activity") {
        valA = valA ? new Date(valA).getTime() : 0;
        valB = valB ? new Date(valB).getTime() : 0;
      } else if (sortField === "has_started") {
        const getRosterScore = (office: OfficeAdoptionData) => {
          const latest = office.charts && office.charts.length > 0
            ? [...office.charts].sort((x, y) => y.id - x.id)[0]
            : null;
          if (!latest) return 0;
          const today = new Date().toISOString().split('T')[0];
          const start = latest.start_date.split('T')[0];
          const end = latest.end_date.split('T')[0];
          return (today >= start && today <= end) ? 2 : 1;
        };
        valA = getRosterScore(a);
        valB = getRosterScore(b);
      }

      if (valA < valB) return sortOrder === "asc" ? -1 : 1;
      if (valA > valB) return sortOrder === "asc" ? 1 : -1;

      // Secondary alphabetical fallback sort
      if (sortField !== "name") {
        return a.name.localeCompare(b.name);
      }
      return 0;
    });

    return result;
  }, [data.offices, adoptionStatus, sortField, sortOrder]);
  // Recalculate summary metrics dynamically based on filtered dataset
  const filteredSummary = useMemo(() => {
    const total = filteredAndSortedOffices.length;
    const active = filteredAndSortedOffices.filter(o => o.has_started).length;
    const pending = total - active;
    const rate = total > 0 ? (active / total * 100) : 0;
    return {
      total_offices: total,
      started_offices: active,
      not_started_offices: pending,
      adoption_rate: parseFloat(rate.toFixed(1))
    };
  }, [filteredAndSortedOffices]);

  // Sliced offices list for display in active page
  const paginatedOffices = useMemo(() => {
    const startIndex = (page - 1) * 15;
    return filteredAndSortedOffices.slice(startIndex, startIndex + 15);
  }, [filteredAndSortedOffices, page]);

  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  const handleExportExcel = () => {
    if (filteredAndSortedOffices.length === 0) {
      toast.error("No data available to export");
      return;
    }

    // Format export payload
    const exportRows = filteredAndSortedOffices.map((office, idx) => {
      const latestChart = office.charts && office.charts.length > 0
        ? [...office.charts].sort((a, b) => b.id - a.id)[0]
        : null;
      let statusStr = "None";
      if (latestChart) {
        const todayStr = new Date().toISOString().split('T')[0];
        const startDate = latestChart.start_date.split('T')[0];
        const endDate = latestChart.end_date.split('T')[0];
        statusStr = (todayStr >= startDate && todayStr <= endDate) ? "Active" : "Ended";
      }

      return {
        "S.N.": idx + 1,
        "Working Office Name": office.name,
        "Roster Charts Created": office.duty_chart_count,
        "Last Activity Timestamp": office.last_activity ? new Date(office.last_activity).toLocaleString() : "N/A",
        "Latest Roster Chart": latestChart ? latestChart.name : "None",
        "Roster Status": statusStr
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Adoption Statistics");

    // Auto-fit column widths
    const maxLens = Object.keys(exportRows[0]).map(key => {
      const lens = exportRows.map((r: any) => String(r[key] ?? "").length);
      return Math.max(key.length, ...lens) + 3;
    });
    ws["!cols"] = maxLens.map(w => ({ wch: w }));

    XLSX.writeFile(wb, `Duty_Chart_Adoption_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Excel sheet downloaded successfully");
  };

  const handleResetFilters = () => {
    setSelectedDirectorateId("");
    setSelectedOfficeId("");
    setAdoptionStatus("all");
    setPage(1);
    toast.success("Filters reset successfully");
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <PageHeader 
          title="Duty Chart Implementation" 
          subtitle="Real-time audit of office rosters and implementation status" 
          icon={Building} 
          iconColor="text-emerald-500"
        />
        <div className="flex gap-2">
          <Button onClick={() => fetchAdoptionData(true)} variant="outline" size="sm" className="h-9 gap-1 text-xs">
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExportExcel} size="sm" className="h-9 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs">
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </Button>
        </div>
      </div>

      {/* Grid Summaries */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card className="shadow-md border-slate-100 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-slate-700 dark:text-slate-300">Total Offices</CardTitle>
            <Building className="h-5 w-5 text-indigo-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-slate-800 dark:text-white">
              {loading ? "..." : filteredSummary.total_offices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Offices matching active filters</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-slate-100 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-emerald-600 dark:text-emerald-400">Active Offices (Implemented)</CardTitle>
            <CheckCircle2 className="h-5 w-5 text-emerald-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-emerald-600">
              {loading ? "..." : filteredSummary.started_offices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Have created rosters/shifts</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-slate-100 hover:shadow-lg transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-orange-600 dark:text-orange-400">Pending Offices</CardTitle>
            <AlertCircle className="h-5 w-5 text-orange-500" />
          </CardHeader>
          <CardContent>
            <div className="text-3xl font-extrabold text-orange-600">
              {loading ? "..." : filteredSummary.not_started_offices}
            </div>
            <p className="text-xs text-muted-foreground mt-1">Have not started making duties</p>
          </CardContent>
        </Card>

        <Card className="shadow-md border-slate-100 hover:shadow-lg transition-shadow bg-gradient-to-br from-indigo-50/30 to-emerald-50/30 dark:from-indigo-950/20 dark:to-emerald-950/20">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-sm font-bold text-indigo-600 dark:text-indigo-400">Implementation Progress</CardTitle>
            <TrendingUp className="h-5 w-5 text-emerald-600" />
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-indigo-600 dark:text-indigo-400">
                {loading ? "..." : `${filteredSummary.adoption_rate}%`}
              </span>
            </div>
            {/* Elegant visual progress bar */}
            <div className="w-full bg-slate-200 dark:bg-slate-700 h-2 rounded-full mt-3 overflow-hidden">
              <div 
                className="bg-gradient-to-r from-indigo-500 to-emerald-500 h-full rounded-full transition-all duration-500" 
                style={{ width: `${loading ? 0 : filteredSummary.adoption_rate}%` }}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Advanced Filters */}
      <Card className="shadow-sm border-slate-150">
        <CardContent className="p-5 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-4">
            
            {/* Provincial Directorate combobox */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">Provincial Directorate</Label>
              <Popover open={directorateOpen} onOpenChange={setDirectorateOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={directorateOpen}
                    className="w-full justify-between h-9 text-xs font-normal border border-input rounded-md px-3 hover:border-slate-300 transition-colors focus:ring-1 focus:ring-ring bg-background text-left truncate"
                  >
                    <span className="truncate">
                      {selectedDirectorateId
                        ? directoratesList.find((d) => String(d.id) === selectedDirectorateId)?.name
                        : "All Directorates"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search directorate..." className="h-9 text-xs" />
                    <CommandList className="max-h-[250px] overflow-y-auto">
                      <CommandEmpty className="text-xs p-2 text-center text-slate-500">No directorate found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="All Directorates"
                          onSelect={() => {
                            setSelectedDirectorateId("");
                            setDirectorateOpen(false);
                          }}
                          className={cn(
                            "flex items-center px-2 py-1.5 cursor-pointer text-xs rounded-sm",
                            !selectedDirectorateId
                              ? "bg-slate-100 font-semibold text-slate-900"
                              : "text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          <Check className={cn("mr-2 h-3.5 w-3.5", !selectedDirectorateId ? "opacity-100" : "opacity-0")} />
                          All Directorates
                        </CommandItem>
                        {[...directoratesList].sort((a, b) => a.name.localeCompare(b.name)).map((directorate) => (
                          <CommandItem
                            key={directorate.id}
                            value={directorate.name}
                            onSelect={() => {
                              setSelectedDirectorateId(String(directorate.id));
                              setDirectorateOpen(false);
                            }}
                            className={cn(
                              "flex items-center px-2 py-1.5 cursor-pointer text-xs rounded-sm",
                              selectedDirectorateId === String(directorate.id)
                                ? "bg-indigo-50 font-semibold text-indigo-700"
                                : "text-slate-900 hover:bg-slate-50"
                            )}
                          >
                            <Check className={cn("mr-2 h-3.5 w-3.5", selectedDirectorateId === String(directorate.id) ? "opacity-100" : "opacity-0")} />
                            {directorate.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Working Office combobox */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">Working Office</Label>
              <Popover open={officeOpen} onOpenChange={setOfficeOpen}>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    aria-expanded={officeOpen}
                    className="w-full justify-between h-9 text-xs font-normal border border-input rounded-md px-3 hover:border-slate-300 transition-colors focus:ring-1 focus:ring-ring bg-background text-left truncate"
                  >
                    <span className="truncate">
                      {selectedOfficeId
                        ? officesList.find((o) => String(o.id) === selectedOfficeId)?.name
                        : "All Working Offices"}
                    </span>
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[300px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Search working office..." className="h-9 text-xs" />
                    <CommandList className="max-h-[250px] overflow-y-auto">
                      <CommandEmpty className="text-xs p-2 text-center text-slate-500">No working office found.</CommandEmpty>
                      <CommandGroup>
                        <CommandItem
                          value="All Working Offices"
                          onSelect={() => {
                            setSelectedOfficeId("");
                            setOfficeOpen(false);
                          }}
                          className={cn(
                            "flex items-center px-2 py-1.5 cursor-pointer text-xs rounded-sm",
                            !selectedOfficeId
                              ? "bg-slate-100 font-semibold text-slate-900"
                              : "text-slate-900 hover:bg-slate-50"
                          )}
                        >
                          <Check className={cn("mr-2 h-3.5 w-3.5", !selectedOfficeId ? "opacity-100" : "opacity-0")} />
                          All Working Offices
                        </CommandItem>
                        {sortedOfficesList.map((office) => (
                          <CommandItem
                            key={office.id}
                            value={office.name}
                            onSelect={() => {
                              setSelectedOfficeId(String(office.id));
                              setOfficeOpen(false);
                            }}
                            className={cn(
                              "flex items-center px-2 py-1.5 cursor-pointer text-xs rounded-sm",
                              selectedOfficeId === String(office.id)
                                ? "bg-indigo-50 font-semibold text-indigo-700"
                                : "text-slate-900 hover:bg-slate-50"
                            )}
                          >
                            <Check className={cn("mr-2 h-3.5 w-3.5", selectedOfficeId === String(office.id) ? "opacity-100" : "opacity-0")} />
                            {office.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>

            {/* Status Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-slate-500">Implementation Status</Label>
              <select
                value={adoptionStatus}
                onChange={(e) => setAdoptionStatus(e.target.value)}
                className="w-full text-xs h-9 bg-background border border-input rounded-md px-3 hover:border-slate-300 transition-colors focus:ring-1 focus:ring-ring"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active (Started)</option>
                <option value="pending">Pending (Not Started)</option>
              </select>
            </div>

            {/* Reset Button */}
            <div className="flex items-end">
              <Button onClick={handleResetFilters} variant="secondary" className="w-full text-xs h-9 font-semibold">
                Reset Filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table */}
      <Card className="shadow-md border-slate-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-sm">
            <thead className="bg-primary text-white border-b border-primary/20">
              <tr>
                <th className="p-4 font-bold text-xs text-white tracking-wider">Office Details</th>
                <th 
                  onClick={() => handleSort("duty_chart_count")}
                  className="p-4 font-bold text-xs text-white tracking-wider cursor-pointer hover:bg-primary-hover transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Charts Made
                    <ArrowUpDown className="h-3 w-3 text-white/70" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("last_activity")}
                  className="p-4 font-bold text-xs text-white tracking-wider cursor-pointer hover:bg-primary-hover transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Last Activity
                    <ArrowUpDown className="h-3 w-3 text-white/70" />
                  </div>
                </th>
                <th 
                  onClick={() => handleSort("has_started")}
                  className="p-4 font-bold text-xs text-white tracking-wider cursor-pointer hover:bg-primary-hover transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    Latest Roster
                    <ArrowUpDown className="h-3 w-3 text-white/70" />
                  </div>
                </th>
                <th className="p-4 font-bold text-xs text-white tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
              {loading ? (
                <tr>
                  <td colSpan={5} className="text-center p-8 text-slate-500">
                    <RefreshCw className="h-6 w-6 animate-spin mx-auto mb-2 text-indigo-500" />
                    loading report details...
                  </td>
                </tr>
              ) : filteredAndSortedOffices.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center p-12 text-slate-500">
                    <Building className="h-10 w-10 text-slate-300 mx-auto mb-3" />
                    no working offices found matching selection filters.
                  </td>
                </tr>
              ) : (
                paginatedOffices.map((office) => {
                  const latestChart = office.charts && office.charts.length > 0
                    ? [...office.charts].sort((a, b) => b.id - a.id)[0]
                    : null;
                  
                  let isChartActive = false;
                  if (latestChart) {
                    const todayStr = new Date().toISOString().split('T')[0];
                    const startDate = latestChart.start_date.split('T')[0];
                    const endDate = latestChart.end_date.split('T')[0];
                    isChartActive = todayStr >= startDate && todayStr <= endDate;
                  }

                  return (
                    <tr key={office.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                      <td className="p-4">
                        <div className="font-semibold text-slate-800 dark:text-slate-200">{office.name}</div>
                        <div className="text-xs text-slate-400 font-light mt-0.5">office id: {office.id}</div>
                      </td>
                      <td className="p-4">
                        <span className={`inline-flex items-center justify-center px-2.5 py-1 text-xs font-semibold rounded-full ${
                          office.duty_chart_count > 0 ? "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/40 dark:text-indigo-400" : "bg-slate-100 text-slate-400 dark:bg-slate-800"
                        }`}>
                          {office.duty_chart_count}
                        </span>
                      </td>
                      <td className="p-4 text-xs font-medium text-slate-600 dark:text-slate-400">
                        {office.last_activity ? (
                          <div>
                            <div className="font-medium text-slate-800 dark:text-slate-200">
                              {(() => {
                                try {
                                  return new NepaliDate(new Date(office.last_activity!)).format("YYYY/MM/DD") + " BS";
                                } catch (e) {
                                  return "N/A";
                                }
                              })()}
                            </div>
                            <div className="text-xxs text-slate-400 font-light mt-0.5">
                              ({new Date(office.last_activity).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })})
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">never</span>
                        )}
                      </td>
                      <td className="p-4">
                        {latestChart ? (
                          <div className="flex flex-col gap-1">
                            <span className="font-semibold text-slate-800 dark:text-slate-200 text-xs">
                              {latestChart.name}
                            </span>
                            <div>
                              {isChartActive ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xxs font-bold bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400 rounded-full lowercase">
                                  active
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-xxs font-bold bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 rounded-full lowercase">
                                  ended
                                </span>
                              )}
                            </div>
                          </div>
                        ) : (
                          <span className="text-slate-400 dark:text-slate-600 text-xs italic font-light lowercase">none</span>
                        )}
                      </td>
                      <td className="p-4">
                        <Button
                          onClick={() => {
                            setSelectedOfficeForDetail(office);
                            setIsDetailOpen(true);
                          }}
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs font-semibold px-3 border-primary text-primary hover:bg-primary hover:text-white transition-colors bg-transparent"
                        >
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Controls */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-6 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50/50 dark:bg-slate-900/20">
          <p className="text-xs text-slate-500 font-medium">
            Showing {((filteredAndSortedOffices.length) > 0) ? (page - 1) * 15 + 1 : 0} to {Math.min(page * 15, filteredAndSortedOffices.length)} of {filteredAndSortedOffices.length} entries
          </p>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1 || loading}
            >
              &laquo; Prev
            </Button>

            {/* Page Numbers */}
            {(() => {
              const totalPages = Math.ceil((filteredAndSortedOffices.length || 0) / 15) || 1;
              const pages = [];
              const maxVisible = 5;
              let start = Math.max(1, page - Math.floor(maxVisible / 2));
              let end = Math.min(totalPages, start + maxVisible - 1);

              if (end - start + 1 < maxVisible) {
                start = Math.max(1, end - maxVisible + 1);
              }

              for (let i = start; i <= end; i++) {
                pages.push(
                  <Button
                    key={i}
                    variant={page === i ? "default" : "outline"}
                    size="sm"
                    className={`h-8 w-8 p-0 text-xs font-medium border-slate-200 ${page === i
                      ? "bg-primary text-white hover:bg-primary/90 border-primary"
                      : "text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
                      }`}
                    onClick={() => setPage(i)}
                    disabled={loading}
                  >
                    {i}
                  </Button>
                );
              }
              return pages;
            })()}

            <Button
              variant="outline"
              size="sm"
              className="h-8 px-3 text-xs font-medium border-slate-200 text-slate-600 hover:text-primary hover:border-primary/50 hover:bg-primary/5"
              onClick={() => setPage((p) => Math.min(Math.ceil((filteredAndSortedOffices.length || 0) / 15) || 1, p + 1))}
              disabled={page === (Math.ceil((filteredAndSortedOffices.length || 0) / 15) || 1) || loading}
            >
              Next &raquo;
            </Button>
          </div>
        </div>
      </Card>

      {/* Roster detail popup modal */}
      <Dialog open={isDetailOpen} onOpenChange={setIsDetailOpen}>
        <DialogContent className="max-w-2xl sm:rounded-xl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Building className="h-5 w-5 text-primary" />
              {selectedOfficeForDetail?.name} — Roster Summary
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              A comprehensive list of duty charts created for this office with start/end periods and employee coverage.
            </DialogDescription>
          </DialogHeader>

          <div className="my-4 max-h-[50vh] overflow-y-auto border border-slate-150 rounded-lg shadow-sm">
            <table className="w-full text-left text-sm border-collapse">
              <thead className="bg-primary text-white border-b border-primary/20 sticky top-0 z-10">
                <tr>
                  <th className="p-3 text-xs font-bold text-white tracking-wider">Roster/Duty Chart Name</th>
                  <th className="p-3 text-xs font-bold text-white tracking-wider">Start Date</th>
                  <th className="p-3 text-xs font-bold text-white tracking-wider">End Date</th>
                  <th className="p-3 text-xs font-bold text-white tracking-wider text-center">Employees Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-850">
                {!selectedOfficeForDetail?.charts || selectedOfficeForDetail.charts.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-6 text-center text-slate-500 italic text-xs">
                      No duty rosters created yet for this office.
                    </td>
                  </tr>
                ) : (
                  (() => {
                    const sortedCharts = [...(selectedOfficeForDetail.charts)].sort((a, b) => b.id - a.id);
                    return sortedCharts.map((chart, idx) => {
                      const isLatest = idx === 0;
                      return (
                        <tr key={chart.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/40 transition-colors">
                          <td className="p-3 font-semibold text-slate-800 dark:text-slate-200">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span>{chart.name}</span>
                              {isLatest && (
                                <span className="inline-flex items-center px-1.5 py-0.5 text-[9px] font-bold bg-indigo-50 text-indigo-700 dark:bg-indigo-950/40 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/40 rounded lowercase">
                                  latest
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {chart.nepali_start_date ? `${chart.nepali_start_date} BS` : "N/A"}
                              </span>
                              <span className="text-slate-400 text-xxs font-normal">
                                ({new Date(chart.start_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })})
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">
                            <div className="flex items-center gap-1.5 whitespace-nowrap">
                              <span className="font-semibold text-slate-800 dark:text-slate-200">
                                {chart.nepali_end_date ? `${chart.nepali_end_date} BS` : "N/A"}
                              </span>
                              <span className="text-slate-400 text-xxs font-normal">
                                ({new Date(chart.end_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })})
                              </span>
                            </div>
                          </td>
                          <td className="p-3 text-center">
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <span className="inline-flex items-center justify-center h-6 min-w-6 px-1.5 text-xs font-bold bg-primary/10 text-primary rounded-full cursor-pointer hover:bg-primary/20 transition-colors">
                                  {chart.employee_count}
                                </span>
                              </TooltipTrigger>
                              <TooltipContent className="p-3 w-[280px] shadow-lg border border-slate-150 rounded-lg bg-popover text-popover-foreground text-xs leading-relaxed">
                                <div className="font-semibold text-slate-800 dark:text-slate-200 mb-1.5 border-b pb-1">
                                  Assigned Employees ({chart.employee_count})
                                </div>
                                {!chart.employees || chart.employees.length === 0 ? (
                                  <p className="italic text-slate-400 text-[11px]">No employees assigned</p>
                                ) : (
                                  <div className="max-h-[200px] overflow-y-auto rounded border border-slate-100 dark:border-slate-800">
                                    <table className="w-full text-left border-collapse text-[10px]">
                                      <thead>
                                        <tr className="bg-slate-50 dark:bg-slate-900 border-b border-slate-100 dark:border-slate-800">
                                          <th className="p-1.5 font-bold text-slate-600 dark:text-slate-400">ID</th>
                                          <th className="p-1.5 font-bold text-slate-600 dark:text-slate-400">Employee Name</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {chart.employees.map((emp, i) => (
                                          <tr key={i} className="border-b border-slate-100 dark:border-slate-800 last:border-none hover:bg-slate-50/50 dark:hover:bg-slate-900/50">
                                            <td className="p-1.5 font-mono text-slate-500">{emp.employee_id}</td>
                                            <td className="p-1.5 font-medium text-slate-700 dark:text-slate-300">{emp.name}</td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  </div>
                                )}
                              </TooltipContent>
                            </Tooltip>
                          </td>
                        </tr>
                      );
                    });
                  })()
                )}
              </tbody>
            </table>
          </div>

          <DialogFooter className="mt-0">
            <Button onClick={() => setIsDetailOpen(false)} size="sm" className="bg-primary hover:bg-primary-hover text-white font-semibold">
              Close Summary
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdoptionReport;
