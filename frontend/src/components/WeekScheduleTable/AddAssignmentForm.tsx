// import { useState } from "react";
// import { NetworkKey } from "./WeekScheduleTable";

// interface AddAssignmentFormProps {
//   onAdd: (assignment: {
//     employee: string;
//     network: NetworkKey;
//     shift: "morning" | "afternoon" | "night";
//     date: string;
//   }) => void;
// }

// export const AddAssignmentForm: React.FC<AddAssignmentFormProps> = ({
//   onAdd,
// }) => {
//   const [form, setForm] = useState({
//     employee: "",
//     network: "Network A" as NetworkKey,
//     shift: "morning" as "morning" | "afternoon" | "night",
//     date: new Date().toISOString().slice(0, 10),
//   });

//   const handleAdd = () => {
//     if (!form.employee) return alert("Employee name is required");
//     onAdd(form);
//     setForm({
//       employee: "",
//       network: "Network A",
//       shift: "morning",
//       date: new Date().toISOString().slice(0, 10),
//     });
//   };

//   return (
//     <div className="mb-6 p-4 bg-white rounded-lg shadow-md flex flex-col gap-3 max-w-full">
//       <h4 className="font-semibold text-lg mb-2">Add Assignment</h4>

//       <div className="flex flex-wrap gap-3 items-center">
//         <input
//           type="text"
//           placeholder="Employee Name"
//           className="border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 flex-1 min-w-[150px]"
//           value={form.employee}
//           onChange={(e) => setForm({ ...form, employee: e.target.value })}
//         />

//         <select
//           value={form.network}
//           onChange={(e) =>
//             setForm({ ...form, network: e.target.value as NetworkKey })
//           }
//           className="border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[120px]"
//         >
//           <option value="Network A">Network A</option>
//           <option value="Network B">Network B</option>
//           <option value="Network C">Network C</option>
//         </select>

//         <select
//           value={form.shift}
//           onChange={(e) =>
//             setForm({
//               ...form,
//               shift: e.target.value as "morning" | "afternoon" | "night",
//             })
//           }
//           className="border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[120px]"
//         >
//           <option value="morning">Morning</option>
//           <option value="afternoon">Afternoon</option>
//           <option value="night">Night</option>
//         </select>

//         <input
//           type="date"
//           value={form.date}
//           onChange={(e) => setForm({ ...form, date: e.target.value })}
//           className="border px-3 py-2 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-400 min-w-[150px]"
//         />

//         <button
//           className="px-4 py-2 bg-blue-600 text-white rounded-md shadow hover:bg-blue-700 hover:shadow-lg transition"
//           onClick={handleAdd}
//         >
//           Add
//         </button>
//       </div>
//     </div>
//   );
// };

import { useState, useEffect } from "react";
import { NetworkKey } from "./WeekScheduleTable";
import { getUsers } from "@/services/users";
import { getOffices } from "@/services/offices";
import { getSchedules } from "@/services/schedule";
import { createDuty } from "@/services/dutiesService";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { UserPlus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";

interface User {
  id: number;
  username: string;
  email: string;
  is_active: boolean;
  office?: number;
}

interface Office {
  id: number;
  name: string;
  location?: string;
}

interface Schedule {
  id: number;
  name: string;
  start_date?: string;
  end_date?: string;
  start_time: string;
  end_time: string;
  shift?: string;
  employee_name?: string;
  office?: number;
  office_name?: string;
  phone_number?: string;
  created_at?: string;
  updated_at?: string;
}

interface AddAssignmentFormProps {
  onAdd: (assignment: {
    employee: string;
    network: NetworkKey;
    shift: "morning" | "afternoon" | "night";
    date: string;
    startTime?: string;
    endTime?: string;
  }) => void;
}

export const AddAssignmentForm: React.FC<AddAssignmentFormProps> = ({
  onAdd,
}) => {
  const { canManageOffice, hasPermission } = useAuth();
  const [form, setForm] = useState({
    employeeId: "",
    officeId: "",
    scheduleId: "",
    date: new Date().toISOString().slice(0, 10),
  });

  const [users, setUsers] = useState<User[]>([]);
  const [offices, setOffices] = useState<Office[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [loading, setLoading] = useState(false);

  // Load users, offices, and schedules on component mount
  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [usersData, officesData, schedulesData] = await Promise.all([
          getUsers(),
          getOffices(),
          getSchedules(),
        ]);

        setUsers(usersData);
        setOffices(officesData);
        setSchedules(schedulesData);
      } catch (error) {
        console.error("Error fetching data:", error);
        toast.error("Failed to load form data. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleAdd = async () => {
    if (!form.employeeId || !form.officeId || !form.scheduleId) {
      toast.error("Please fill in all required fields");
      return;
    }

    try {
      setLoading(true);

      // Find the selected schedule to get start and end times
      const selectedSchedule = schedules.find(s => s.id.toString() === form.scheduleId);

      if (!selectedSchedule) {
        toast.error("Selected schedule not found");
        return;
      }

      // Validate that all required fields are present
      if (!selectedSchedule.shift || !selectedSchedule.start_time || !selectedSchedule.end_time) {
        toast.error("Selected schedule is missing required information");
        return;
      }

      // Create duty object
      const dutyData = {
        date: form.date,
        user: parseInt(form.employeeId),
        office: parseInt(form.officeId),
        schedule: parseInt(form.scheduleId),
        is_completed: false,
        currently_available: true,
      };

      // Create duty using the API
      const result = await createDuty(dutyData);

      // Also call the onAdd callback for local state management
      const selectedUser = users.find(u => u.id.toString() === form.employeeId);
      const selectedOffice = offices.find(o => o.id.toString() === form.officeId);

      if (selectedUser && selectedOffice && selectedSchedule) {
        onAdd({
          employee: selectedUser.username,
          network: selectedOffice.name as NetworkKey,
          shift: selectedSchedule.shift as "morning" | "afternoon" | "night",
          date: form.date,
          startTime: selectedSchedule.start_time,
          endTime: selectedSchedule.end_time,
        });
      }

      // Reset form
      setForm({
        employeeId: "",
        officeId: "",
        scheduleId: "",
        date: new Date().toISOString().slice(0, 10),
      });

      toast.success("Duty Assigned Successfully");
    } catch (error: any) {
      console.error("Error creating duty:", error);

      // Handle specific error messages
      let errorMessage = "Failed to assign duty. Please try again.";

      if (error.response?.data?.detail) {
        errorMessage = error.response.data.detail;
      } else if (error.response?.data?.message) {
        errorMessage = error.response.data.message;
      } else if (error.message) {
        errorMessage = error.message;
      }

      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  if (loading && users.length === 0) {
    return (
      <div className="mb-6 p-4 bg-white rounded-lg shadow-md">
        <h4 className="font-semibold text-lg mb-2">Add Assignment</h4>
        <div className="flex items-center justify-center h-20">
          <div className="text-gray-500">Loading form data...</div>
        </div>
      </div>
    );
  }

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserPlus className="h-5 w-5 text-primary" />
          Add Assignment
        </CardTitle>
        <CardDescription>
          Manually assign an employee to a specific office and shift.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-wrap gap-4 items-end">
          {/* Employee Selection */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-sm font-medium">Select Employee</label>
            <Select
              value={form.employeeId}
              onValueChange={(v) => setForm({ ...form, employeeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Employee" />
              </SelectTrigger>
              <SelectContent>
                {users
                  .filter(user => !user.office || canManageOffice(user.office) || hasPermission("duties.assign_any_office_employee"))
                  .map((user) => (
                    <SelectItem key={user.id} value={String(user.id)}>
                      {user.username} ({user.email})
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Office Selection (Network) */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-sm font-medium">Select Office</label>
            <Select
              value={form.officeId}
              onValueChange={(v) => setForm({ ...form, officeId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Office" />
              </SelectTrigger>
              <SelectContent>
                {offices
                  .filter(office => canManageOffice(office.id) || hasPermission("duties.assign_any_office_employee"))
                  .map((office) => (
                    <SelectItem key={office.id} value={String(office.id)}>
                      {office.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          {/* Schedule Selection (replaces shift selection) */}
          <div className="flex-1 min-w-[200px] space-y-1.5">
            <label className="text-sm font-medium">Select Schedule</label>
            <Select
              value={form.scheduleId}
              onValueChange={(v) => setForm({ ...form, scheduleId: v })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select Schedule" />
              </SelectTrigger>
              <SelectContent>
                {schedules.map((schedule) => (
                  <SelectItem key={schedule.id} value={String(schedule.id)}>
                    {schedule.name} ({schedule.shift}) - {schedule.start_time} to {schedule.end_time}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Date Selection */}
          <div className="flex-1 min-w-[150px] space-y-1.5">
            <label className="text-sm font-medium">Date</label>
            <input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              className="w-full flex h-10 rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              required
            />
          </div>

          {/* Add Button */}
          <Button
            onClick={handleAdd}
            disabled={loading}
            className="px-8"
          >
            {loading ? "Adding..." : "Add Duty"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
