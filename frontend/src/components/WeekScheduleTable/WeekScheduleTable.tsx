// import { ChevronLeft, ChevronRight } from "lucide-react";
// import { addDays, format } from "date-fns";
// import { useMemo, useState } from "react";

// export type NetworkKey = "Network A" | "Network B" | "Network C";

// export interface Assignment {
//   employee: string;
//   network: NetworkKey;
// }

// interface WeekScheduleTableProps {
//   startDate?: Date;
//   assignments: Record<
//     string,
//     { morning?: Assignment; afternoon?: Assignment; night?: Assignment }
//   >;
//   setAssignments?: React.Dispatch<
//     React.SetStateAction<
//       Record<
//         string,
//         { morning?: Assignment; afternoon?: Assignment; night?: Assignment }
//       >
//     >
//   >;
// }

// const dayNames = [
//   "Sunday",
//   "Monday",
//   "Tuesday",
//   "Wednesday",
//   "Thursday",
//   "Friday",
//   "Saturday",
// ];

// const networkClasses: Record<NetworkKey, string> = {
//   "Network A": "bg-blue-200 text-blue-800",
//   "Network B": "bg-green-200 text-green-800",
//   "Network C": "bg-yellow-200 text-yellow-800",
// };

// export const WeekScheduleTable: React.FC<WeekScheduleTableProps> = ({
//   startDate,
//   assignments,
//   setAssignments,
// }) => {
//   const [monday, setMonday] = useState(
//     () => startDate ?? getMonday(new Date())
//   );

//   const weekDays = useMemo(
//     () => Array.from({ length: 7 }, (_, i) => addDays(monday, i)),
//     [monday]
//   );
//   const rangeLabel = `${format(weekDays[0], "MMM d")} - ${format(
//     weekDays[6],
//     "MMM d, yyyy"
//   )}`;

//   const goPrev = () => setMonday(addDays(monday, -7));
//   const goNext = () => setMonday(addDays(monday, 7));

//   return (
//     <section className="bg-white rounded-lg shadow-md p-4">
//       {/* Header with Prev/Next */}
//       <div className="flex items-center justify-between mb-4">
//         <h3 className="font-bold text-lg">{rangeLabel}</h3>
//         <div className="flex gap-2">
//           <button
//             onClick={goPrev}
//             className="px-2 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
//           >
//             <ChevronLeft />
//           </button>
//           <button
//             onClick={goNext}
//             className="px-2 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
//           >
//             <ChevronRight />
//           </button>
//         </div>
//       </div>

//       {/* Table */}
//       <div className="overflow-x-auto">
//         <table className="min-w-full border border-gray-200">
//           <thead>
//             <tr className="bg-gray-100">
//               <th className="border px-4 py-2">Day</th>
//               <th className="border px-4 py-2">Morning</th>
//               <th className="border px-4 py-2">Afternoon</th>
//               <th className="border px-4 py-2">Night</th>
//             </tr>
//           </thead>
//           <tbody>
//             {weekDays.map((d) => {
//               const key = format(d, "yyyy-MM-dd");
//               const a = assignments[key] ?? {};
//               return (
//                 <tr key={key} className="border-b">
//                   <td className="border px-4 py-2 font-semibold">
//                     {dayNames[d.getDay()]}
//                     <br />
//                     {format(d, "MMM d")}
//                   </td>
//                   {(["morning", "afternoon", "night"] as const).map((shift) => (
//                     <td key={shift} className="border px-4 py-2">
//                       {a[shift] ? (
//                         <div
//                           className={`rounded px-2 py-1 ${
//                             networkClasses[a[shift]!.network]
//                           }`}
//                         >
//                           <div className="font-semibold">
//                             {a[shift]!.employee}
//                           </div>
//                           <div className="text-xs">{a[shift]!.network}</div>
//                         </div>
//                       ) : (
//                         <div className="min-h-[40px]" />
//                       )}
//                     </td>
//                   ))}
//                 </tr>
//               );
//             })}
//           </tbody>
//         </table>
//       </div>
//     </section>
//   );
// };

// // Helper to get Monday of current week
// function getMonday(d: Date) {
//   const date = new Date(d);
//   const day = date.getDay();
//   const diff = date.getDate() - day + (day === 0 ? -6 : 1); // adjust when day is Sunday
//   date.setDate(diff);
//   return date;
// }
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, format } from "date-fns";
import { useMemo, useState } from "react";

export type NetworkKey = "Network A" | "Network B" | "Network C";

export interface Assignment {
  employee: string;
  network: NetworkKey;
}

interface Schedule {
  id: number;
  name: string;
  shift: string;
  start_time: string;
  end_time: string;
}

interface WeekScheduleTableProps {
  startDate?: Date;
  assignments: Record<string, Record<string, Assignment>>;
  setAssignments?: React.Dispatch<
    React.SetStateAction<Record<string, Record<string, Assignment>>>
  >;
  schedules?: Schedule[];
}

const dayNames = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const networkClasses: Record<NetworkKey, string> = {
  "Network A": "bg-blue-200 text-blue-800",
  "Network B": "bg-green-200 text-green-800",
  "Network C": "bg-yellow-200 text-yellow-800",
};

export const WeekScheduleTable: React.FC<WeekScheduleTableProps> = ({
  startDate,
  assignments,
  setAssignments,
  schedules = [],
}) => {
  const [sunday, setSunday] = useState(
    () => startDate ?? getSunday(new Date())
  );

  const weekDays = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(sunday, i)),
    [sunday]
  );
  const rangeLabel = `${format(weekDays[0], "MMM d")} - ${format(
    weekDays[6],
    "MMM d, yyyy"
  )}`;

  const goPrev = () => setSunday(addDays(sunday, -7));
  const goNext = () => setSunday(addDays(sunday, 7));

  return (
    <section className="bg-white rounded-lg shadow-md p-4">
      {/* Header with Prev/Next */}
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-bold text-lg">{rangeLabel}</h3>
        <div className="flex gap-2">
          <button
            onClick={goPrev}
            className="px-2 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            <ChevronLeft />
          </button>
          <button
            onClick={goNext}
            className="px-2 py-1 bg-gray-200 rounded-md hover:bg-gray-300"
          >
            <ChevronRight />
          </button>
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="min-w-full border border-gray-200">
          <thead>
            <tr className="bg-gray-100">
              <th className="border px-4 py-2">Day</th>
              {schedules.map((schedule) => (
                <th key={schedule.id} className="border px-4 py-2">
                  {schedule.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {weekDays.map((d) => {
              const key = format(d, "yyyy-MM-dd");
              const a = assignments[key] ?? {};
              return (
                <tr key={key} className="border-b">
                  <td className="border px-4 py-2 font-semibold">
                    {dayNames[d.getDay()]}
                    <br />
                    {format(d, "MMM d")}
                  </td>
                  {schedules.map((schedule) => (
                    <td key={schedule.id} className="border px-4 py-2">
                      {a[schedule.name] ? (
                        <div
                          className={`rounded px-2 py-1 ${
                            networkClasses[a[schedule.name]!.network]
                          }`}
                        >
                          <div className="font-semibold">
                            {a[schedule.name]!.employee}
                          </div>
                          <div className="text-xs">{a[schedule.name]!.network}</div>
                        </div>
                      ) : (
                        <div className="min-h-[40px]" />
                      )}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
};

// Helper to get Sunday of current week
function getSunday(d: Date) {
  const date = new Date(d);
  const day = date.getDay(); // 0 = Sunday
  const diff = date.getDate() - day;
  date.setDate(diff);
  return date;
}
