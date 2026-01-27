import { addDays, format, parseISO, isSameDay } from "date-fns";
import { useMemo, useState } from "react";
import { ChevronLeft, ChevronRight, Download, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

export interface Person {
  id: number;
  name: string;
  phone: string;
  start_date: string; // effective_date from backend
  end_date: string;
}

export type RosterData = Record<string, Person[]>; // office_name -> persons list

interface DutyRosterTableProps {
  data: RosterData;
}

const personBgClass = (id: number) => {
  const key = ((id - 1) % 4) + 1;
  switch (key) {
    case 1:
      return "bg-[hsl(var(--person-1-bg))]";
    case 2:
      return "bg-[hsl(var(--person-2-bg))]";
    case 3:
      return "bg-[hsl(var(--person-3-bg))]";
    case 4:
    default:
      return "bg-[hsl(var(--person-4-bg))]";
  }
};

export const DutyRosterTable: React.FC<DutyRosterTableProps> = ({ data }) => {
  const [monday, setMonday] = useState(getMonday(new Date()));
  const [query, setQuery] = useState("");

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
    [monday]
  );

  const dayNames = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const offices = Object.keys(data);

  const rangeLabel = `${format(weekDays[0], "MMM d")}–${format(
    weekDays[6],
    "d, yyyy"
  )}`;

  const goPrev = () => setMonday(addDays(monday, -7));
  const goNext = () => setMonday(addDays(monday, 7));

  const handleDownload = () => {
    const rows: string[] = ["Office,Name,Phone,Effective Date,End Date"];
    offices.forEach((office) => {
      data[office].forEach((p) => {
        rows.push(
          `${office},${p.name},${p.phone},${p.start_date},${p.end_date}`
        );
      });
    });
    const csv = rows.join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `weekly-roster-${format(weekDays[0], "yyyy-MM-dd")}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const safeParseISO = (dateStr?: string) => {
    if (!dateStr) return null;
    try {
      return parseISO(dateStr);
    } catch {
      return null;
    }
  };

  return (
    <section className="bg-[hsl(var(--card))] rounded-lg shadow-md">
      <div className="flex flex-col md:flex-row md:justify-between p-6 border-b border-[hsl(var(--border))]">
        <h3 className="font-bold">{rangeLabel}</h3>
        <div className="flex gap-2 items-center">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search name or phone"
              className="pl-8 w-56"
            />
          </div>
          <Button onClick={handleDownload} className="flex items-center gap-1">
            <Download className="h-4 w-4" />
            Download
          </Button>
          <div className="hidden sm:flex gap-2">
            <button
              onClick={goPrev}
              className="h-9 w-9 rounded-md bg-gray-200 grid place-items-center"
            >
              <ChevronLeft className="h-4 w-4 text-gray-700" />
            </button>
            <button
              onClick={goNext}
              className="h-9 w-9 rounded-md bg-gray-200 grid place-items-center"
            >
              <ChevronRight className="h-4 w-4 text-gray-700" />
            </button>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[960px] border-collapse">
          <thead className="bg-white sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 bg-white px-4 py-2 text-left border-b">
                Office
              </th>
              {weekDays.map((d) => (
                <th
                  key={d.toISOString()}
                  className="px-4 py-2 text-left border-b"
                >
                  <div className="flex flex-col">
                    <span>{dayNames[d.getDay()]}</span>
                    <span className="text-xs text-gray-500">
                      {format(d, "MMM d")}
                    </span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {offices.map((office) => (
              <tr key={office} className="border-b align-top">
                <td className="sticky left-0 bg-white px-4 py-2 font-semibold">
                  {office}
                </td>
                {weekDays.map((d) => {
                  // Only show users whose effective_date or end_date matches this column
                  const persons = data[office]
                    .filter((p) => {
                      const start = safeParseISO(p.start_date);
                      const end = safeParseISO(p.end_date);
                      if (!start || !end) return false;
                      return isSameDay(d, start) || isSameDay(d, end);
                    })
                    .filter(
                      (p) =>
                        p.name.toLowerCase().includes(query.toLowerCase()) ||
                        p.phone.includes(query)
                    );

                  return (
                    <td key={d.toISOString()} className="px-4 py-2">
                      <div className="flex flex-col gap-2">
                        {persons.map((p) => (
                          <div
                            key={p.id}
                            className={`rounded-md shadow-sm ${personBgClass(
                              p.id
                            )} px-3 py-2`}
                          >
                            <div className="text-sm font-semibold">
                              {p.name}
                            </div>
                            <div className="text-xs opacity-90">{p.phone}</div>
                          </div>
                        ))}
                        {persons.length === 0 && (
                          <div className="min-h-[40px]" />
                        )}
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
};

function getMonday(d: Date) {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  return new Date(date.setDate(diff));
}
