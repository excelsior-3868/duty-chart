import React from 'react';
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Mail, Phone, MapPin, Calendar } from 'lucide-react';

export interface UserData {
  id: number | string;
  name: string;
  position: string;
  department: string;
  employeeId: string;
  status: 'active' | 'on_leave' | 'inactive';
  phone?: string;
  email?: string;
  location?: string;
  avatar?: string;
  joinDate?: string;
}

interface UserCardProps {
  user: UserData;
  showActions?: boolean;
  onView?: (id: number | string) => void;
  onEdit?: (id: number | string) => void;
  onDelete?: (id: number | string) => void;
  className?: string;
}

export const UserCard: React.FC<UserCardProps> = ({
  user,
  showActions = true,
  onView,
  onEdit,
  onDelete,
  className
}) => {
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'bg-success text-success-foreground';
      case 'on_leave': return 'bg-warning text-warning-foreground';
      case 'inactive': return 'bg-muted text-muted-foreground';
      default: return 'bg-secondary text-secondary-foreground';
    }
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };

  return (
    <Card className={`hover:shadow-md transition-shadow ${className}`}>
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <Avatar className="h-12 w-12">
            {user.avatar ? (
              <AvatarImage src={user.avatar} alt={user.name} />
            ) : (
              <AvatarFallback className="bg-primary text-primary-foreground">
                {getInitials(user.name)}
              </AvatarFallback>
            )}
          </Avatar>
          
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-medium truncate">{user.name}</h3>
              <Badge className={getStatusColor(user.status)}>
                {user.status.replace('_', ' ')}
              </Badge>
            </div>
            
            <p className="text-sm text-muted-foreground mb-1">{user.position}</p>
            <p className="text-xs text-muted-foreground mb-2">{user.department}</p>
            
            <div className="space-y-1 mb-3">
              <p className="text-xs text-muted-foreground">ID: {user.employeeId}</p>
              
              {user.phone && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Phone className="h-3 w-3" />
                  {user.phone}
                </div>
              )}
              
              {user.email && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Mail className="h-3 w-3" />
                  <span className="truncate">{user.email}</span>
                </div>
              )}
              
              {user.location && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  {user.location}
                </div>
              )}
              
              {user.joinDate && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Joined {user.joinDate}
                </div>
              )}
            </div>
            
            {showActions && (
              <div className="flex gap-1">
                {onView && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onView(user.id)}
                  >
                    View
                  </Button>
                )}
                {onEdit && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onEdit(user.id)}
                  >
                    Edit
                  </Button>
                )}
                {onDelete && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => onDelete(user.id)}
                  >
                    Delete
                  </Button>
                )}
              </div>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
};