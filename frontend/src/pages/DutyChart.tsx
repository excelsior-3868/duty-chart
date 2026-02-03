import { useState, useEffect, useCallback } from "react";
import { getDutyCharts } from "@/services/dutichart";
import { getOffices } from "@/services/offices";
import { CalendarRosterHybrid, Office, DutyChart } from "@/components/CalendarRosterHybrid";
import { useLocation } from "react-router-dom";
import { Loader2, AlertCircle } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

// ---------- Types ----------
export interface Person {
  id: number;
  name: string;
  phone: string;
  start_date: string;
  end_date: string;
}

export type RosterData = Record<string, Person[]>; // office_name -> persons list

interface Duty {
  id: number;
  office_name: string;
  employee_name: string;
  phone_number: string;
  effective_date: string;
  end_date: string;
}

// ---------- Wrapper Page ----------
const DutyChartPage: React.FC = () => {
  const { canManageOffice, hasPermission } = useAuth();
  const [offices, setOffices] = useState<Office[]>([]);
  const [dutyCharts, setDutyCharts] = useState<DutyChart[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string>("");

  const location = useLocation();
  const preselect = (location.state as any)?.preselect;
  const [selectedOfficeId, setSelectedOfficeId] = useState<string>(preselect?.officeId ?? "");
  const [selectedDutyChartId, setSelectedDutyChartId] = useState<string>(preselect?.dutyChartId ?? "");

  const [lastSelectedByOffice, setLastSelectedByOffice] = useState<Record<string, string>>(() => {
    try {
      const raw = localStorage.getItem("lastSelectedChartByOffice");
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  });

  // Load offices
  useEffect(() => {
    document.title = "Duty Chart - INOC Duty Roster";
    const fetchOfficesAndStats = async () => {
      try {
        setLoading(true);
        setError("");

        // Parallel fetch for offices and all charts (for stats)
        const [officesData, allCharts] = await Promise.all([
          getOffices(),
          getDutyCharts()
        ]);

        // Calculate chart counts
        const counts: Record<string, number> = {};
        allCharts.forEach((c: any) => {
          const oid = String(c.office);
          counts[oid] = (counts[oid] || 0) + 1;
        });

        // Transform to match Office interface
        const transformedOffices: Office[] = officesData.map((office: any) => ({
          id: String(office.id),
          name: office.name,
          code: office.code || office.location
        }));

        // Sort offices by chart count (descending)
        const sorted = transformedOffices.sort((a, b) => {
          const countA = counts[a.id] || 0;
          const countB = counts[b.id] || 0;
          return countB - countA;
        });

        setOffices(sorted);
      } catch (err) {
        console.error("Error fetching offices:", err);
        setError("Failed to load offices. Please try again.");
      } finally {
        setLoading(false);
      }
    };
    fetchOfficesAndStats();
  }, []);

  const rememberSelection = (officeId: string, chartId: string) => {
    setLastSelectedByOffice((prev) => {
      const next = { ...prev, [String(officeId)]: String(chartId) };
      try {
        localStorage.setItem("lastSelectedChartByOffice", JSON.stringify(next));
      } catch { }
      return next;
    });
  };

  // Move fetchDutyCharts to useCallback so it can be called from multiple places
  const fetchDutyCharts = useCallback(async (officeFilter: number, forceSelectId?: string) => {
    try {
      setError("");
      const res = await getDutyCharts(officeFilter);
      const transformedCharts: DutyChart[] = res.map((chart: any) => ({
        id: String(chart.id),
        name: chart.name || `Duty Chart ${chart.id}`,
      }));
      setDutyCharts(transformedCharts);

      const officeIdStr = String(officeFilter);
      const exists = (id: string) => transformedCharts.some((c) => String(c.id) === String(id));

      let nextId: string | null = null;

      // Prioritize forceSelectId (newly created chart)
      if (forceSelectId && exists(forceSelectId)) {
        nextId = forceSelectId;
      } else if (selectedDutyChartId && exists(selectedDutyChartId)) {
        nextId = String(selectedDutyChartId);
      } else {
        const remembered = lastSelectedByOffice[officeIdStr];
        if (remembered && exists(remembered)) {
          nextId = String(remembered);
        }
      }

      if (!nextId && transformedCharts.length > 0) {
        nextId = String(transformedCharts[0].id);
      }

      if (nextId) {
        setSelectedDutyChartId(nextId);
        rememberSelection(officeIdStr, nextId);
      } else {
        setSelectedDutyChartId("");
      }
    } catch (err) {
      console.error("Error fetching duty charts:", err);
      setError("Failed to load duty charts. Please try again.");
    }
  }, [selectedDutyChartId, lastSelectedByOffice]);

  // Load duty charts (filtered by office)
  useEffect(() => {
    if (selectedOfficeId) {
      fetchDutyCharts(parseInt(selectedOfficeId));
    } else {
      setDutyCharts([]);
      setSelectedDutyChartId("");
    }
  }, [selectedOfficeId, fetchDutyCharts]);

  const handleDutyChartCreated = (chart: any) => {
    const targetOfficeId = String(chart.office);
    const targetChartId = String(chart.id);

    // Always update office state if it differs
    if (targetOfficeId !== selectedOfficeId) {
      setSelectedOfficeId(targetOfficeId);
    }

    // Force a fetch for the target office and select the new chart
    fetchDutyCharts(parseInt(targetOfficeId), targetChartId);
  };

  const handleOfficeChange = (officeId: number) => {
    if (!officeId || officeId === 0) {
      setSelectedOfficeId("");
    } else {
      setSelectedOfficeId(String(officeId));
    }
  };

  const handleDutyChartChange = (dutyChartId: number) => {
    setSelectedDutyChartId(String(dutyChartId));
    if (selectedOfficeId) {
      rememberSelection(String(selectedOfficeId), String(dutyChartId));
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[400px]">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground animate-pulse text-sm">Loading duty roster data...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-primary">Duty Chart</h1>
          <p className="text-muted-foreground">View and manage the weekly duty roster for all offices.</p>
        </div>
        <div className="bg-destructive/10 border border-destructive/20 rounded-lg p-4 flex items-center gap-3 text-destructive">
          <AlertCircle className="h-5 w-5" />
          <p className="text-sm font-medium">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-primary">Duty Chart</h1>
        <p className="text-muted-foreground">View and manage the weekly duty roster for all offices.</p>
      </div>
      <CalendarRosterHybrid
        offices={offices.filter(o => canManageOffice(Number(o.id)) || hasPermission("duties.assign_any_office_employee"))}
        dutyCharts={dutyCharts}
        selectedOfficeId={selectedOfficeId}
        selectedDutyChartId={selectedDutyChartId}
        onOfficeChange={handleOfficeChange}
        onDutyChartChange={handleDutyChartChange}
        onDutyChartCreated={handleDutyChartCreated}
      />
    </div>
  );
};

export default DutyChartPage;
