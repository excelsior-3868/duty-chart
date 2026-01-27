 import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

export interface ScheduleData {
  id: number;
  employee: string;
  employeeId: string;
  position: string;
  shift: string;
  date: string;
  status: 'scheduled' | 'completed' | 'missed' | 'swapped';
  location: string;
  startTime?: string;
  endTime?: string;
}

interface ScheduleTableProps {
  data: ScheduleData[];
  title?: string;
  showActions?: boolean;
  onEdit?: (id: number) => void;
  onSwap?: (id: number) => void;
  onDelete?: (id: number) => void;
}

export const ScheduleTable: React.FC<ScheduleTableProps> = ({
  data,
  title = "Schedule",
  showActions = true,
  onEdit,
  onSwap,
  onDelete
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-success text-success-foreground';
      case 'scheduled': return 'bg-primary text-primary-foreground';
      case 'missed': return 'bg-destructive text-destructive-foreground';
      case 'swapped': return 'bg-warning text-warning-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b">
                <th className="text-left p-3 font-medium">Employee</th>
                <th className="text-left p-3 font-medium">Position</th>
                <th className="text-left p-3 font-medium">Shift</th>
                <th className="text-left p-3 font-medium">Date</th>
                <th className="text-left p-3 font-medium">Location</th>
                <th className="text-left p-3 font-medium">Status</th>
                {showActions && <th className="text-left p-3 font-medium">Actions</th>}
              </tr>
            </thead>
            <tbody>
              {data.map((row) => (
                <tr key={row.id} className="border-b hover:bg-muted/50">
                  <td className="p-3">
                    <div>
                      <div className="font-medium">{row.employee}</div>
                      <div className="text-sm text-muted-foreground">
                        ID: {row.employeeId || `EMP${row.id.toString().padStart(3, '0')}`}
                      </div>
                    </div>
                  </td>
                  <td className="p-3 text-sm">{row.position}</td>
                  <td className="p-3 text-sm">
                    <div>
                      {row.shift}
                      {row.startTime && row.endTime && (
                        <div className="text-xs text-muted-foreground">
                          {row.startTime} - {row.endTime}
                        </div>
                      )}
                    </div>
                  </td>
                  <td className="p-3 text-sm">{row.date}</td>
                  <td className="p-3 text-sm">{row.location}</td>
                  <td className="p-3">
                    <Badge className={getStatusColor(row.status)}>
                      {row.status}
                    </Badge>
                  </td>
                  {showActions && (
                    <td className="p-3">
                      <div className="flex gap-1">
                        {onEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onEdit(row.id)}
                          >
                            Edit
                          </Button>
                        )}
                        {onSwap && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onSwap(row.id)}
                          >
                            Swap
                          </Button>
                        )}
                        {onDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => onDelete(row.id)}
                          >
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
};