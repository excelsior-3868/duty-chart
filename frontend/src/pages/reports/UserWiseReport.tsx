import React, { useEffect, useRef, useState } from "react";
import api from "@/services/api";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

/* ===================== TYPES ===================== */

interface DutyRow {
  id: number;
  date: string;
  weekday: string;
  schedule: string;
  start_time: string;
  end_time: string;
  is_completed: boolean;
  currently_available: boolean;
}

interface User {
  id: number;
  full_name: string;
}

interface DutyOption {
  id: number;
  name: string;
}

/* ===================== COMPONENT ===================== */

function UserWiseReport() {
  const [users, setUsers] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<number[]>([]);
  const [selectAllUsers, setSelectAllUsers] = useState(false);

  const [duties, setDuties] = useState<DutyRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [firstLoad, setFirstLoad] = useState(true);

  const [me, setMe] = useState<any>(null);

  const [dateFrom, setDateFrom] = useState("2025-11-01");
  const [dateTo, setDateTo] = useState("2025-11-06");

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const [dutyOptions, setDutyOptions] = useState<DutyOption[]>([]);
  const [selectedDuty, setSelectedDuty] = useState<number | null>(null);

  /* ================= Outside click ================= */

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  /* ================= Fetch me ================= */

  useEffect(() => {
    async function fetchMe() {
      try {
        const res = await api.get("/auth/me/");
        setMe(res.data);
        if (!res.data.is_staff) {
          setSelectedUsers([res.data.id]);
        }
      } catch (err) {
        console.error("Failed to fetch /me/", err);
      }
    }
    fetchMe();
  }, []);

  /* ================= Fetch users ================= */

  useEffect(() => {
    if (!me || !me.is_staff) return;

    async function fetchUsers() {
      try {
        const res = await api.get("/users/");
        setUsers(res.data);
      } catch (err) {
        console.error("User fetch failed", err);
      }
    }

    fetchUsers();
  }, [me]);

  /* ================= Fetch duty options ================= */

  useEffect(() => {
    async function fetchDuties() {
      try {
        const res = await api.get("/reports/duties/options/");
        setDutyOptions(res.data || []);
      } catch (err) {
        console.error("Failed to fetch duty options", err);
      }
    }
    fetchDuties();
  }, []);

  /* ================= Load preview ================= */

  async function loadReport() {
    if (!selectAllUsers && selectedUsers.length === 0) {
      alert("Please select a user or enable Complete Duty Chart");
      return;
    }
    setLoading(true);
    setFirstLoad(false);
    try {
      const res = await api.get("/reports/duties/preview/", {
        params: {
          date_from: dateFrom,
          date_to: dateTo,
          user_id: selectedUsers,
          duty_id: selectedDuty ?? undefined,
        },
      });

      setDuties(res.data || []);
    } catch (err) {
      alert("Failed to load report.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  /* ================= Download DOCX ================= */

  async function downloadReport() {
    if (!selectAllUsers && selectedUsers.length === 0) {
      alert("No users selected!");
      return;
    }

    try {
      const params: any = {
        date_from: dateFrom,
        date_to: dateTo,
      };

      if (selectAllUsers) {
        params["user_id[]"] = users.map((u) => u.id);
      } else if (selectedUsers.length > 0) {
        params["user_id[]"] = selectedUsers;
      } else if (selectedDuty) {
        params["duty_id"] = selectedDuty;
      }

      const response = await api.get("/reports/duties/file/", {
        params,
        responseType: "blob",
      });

      const url = window.URL.createObjectURL(
        new Blob([response.data], {
          type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        })
      );

      const link = document.createElement("a");
      link.href = url;
      link.download = `Duty_Report_${dateFrom}_${dateTo}.docx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Download failed", err);
      alert("Failed to download report");
    }
  }

  /* ================= Render ================= */

  return (
    <div className="p-6 space-y-6">
      <h2 className="text-2xl font-bold">User Wise Duty Report</h2>

      {/* Select Duty */}
      <div className="flex items-center gap-3">
        <label className="font-medium">Select Duty:</label>
        <select
          className="border rounded p-2 min-w-[250px]"
          value={selectedDuty ?? ""}
          onChange={(e) =>
            setSelectedDuty(e.target.value ? Number(e.target.value) : null)
          }
        >
          <option value="">-- Select Duty --</option>
          {dutyOptions.map((d) => (
            <option key={d.id} value={d.id}>
              {d.name}
            </option>
          ))}
        </select>
      </div>

      {/* Complete Duty Chart */}
      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          checked={selectAllUsers}
          onChange={(e) => {
            setSelectAllUsers(e.target.checked);
            if (e.target.checked) setSelectedUsers([]);
          }}
        />
        <label className="font-medium">Complete Duty Chart (All Users)</label>
      </div>

      {/* User selection */}
      <div className="flex items-center gap-3">
        <label className="font-medium">Select User(s):</label>

        {me && me.is_staff ? (
          <div className="relative inline-block" ref={dropdownRef}>
            <button
              type="button"
              className="border rounded p-2 min-w-[250px] bg-white text-left"
              disabled={selectAllUsers}
              onClick={() => setDropdownOpen((p) => !p)}
            >
              {selectedUsers.length === 0
                ? "-- Select User --"
                : `${selectedUsers.length} user(s) selected`}
            </button>

            {dropdownOpen && !selectAllUsers && (
              <div className="absolute z-10 mt-1 w-full bg-white border rounded shadow">
                <div className="max-h-40 overflow-y-auto p-2">
                  {users.map((u) => (
                    <label key={u.id} className="flex items-center gap-2 py-1">
                      <input
                        type="checkbox"
                        checked={selectedUsers.includes(u.id)}
                        onChange={() =>
                          setSelectedUsers((prev) =>
                            prev.includes(u.id)
                              ? prev.filter((id) => id !== u.id)
                              : [...prev, u.id]
                          )
                        }
                      />
                      <span>{u.full_name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <select disabled className="border rounded p-2">
            <option>{me?.full_name}</option>
          </select>
        )}
      </div>

      {/* Date + Actions */}
      <div className="flex gap-4 items-center">
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />

        <Button onClick={loadReport} disabled={loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Load Preview"}
        </Button>

        <Button onClick={downloadReport} variant="outline">
          Download Report
        </Button>
      </div>

      {/* Preview */}
      {firstLoad ? (
        <p>Please select a user, duty, or complete duty chart.</p>
      ) : duties.length === 0 ? (
        <p className="text-red-600">No data loaded.</p>
      ) : (
        <table className="min-w-full border">
          <thead>
            <tr>
              <th>Date</th>
              <th>Weekday</th>
              <th>Schedule</th>
              <th>Start</th>
              <th>End</th>
              <th>Completed</th>
              <th>Available</th>
            </tr>
          </thead>
          <tbody>
            {duties.map((d) => (
              <tr key={d.id}>
                <td>{d.date}</td>
                <td>{d.weekday}</td>
                <td>{d.schedule}</td>
                <td>{d.start_time}</td>
                <td>{d.end_time}</td>
                <td>{d.is_completed ? "✔️" : "❌"}</td>
                <td>{d.currently_available ? "✔️" : "❌"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default UserWiseReport;
