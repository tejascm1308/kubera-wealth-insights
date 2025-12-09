import { useState, useEffect } from 'react';
import { Navigate, Link } from 'react-router-dom';
import {
  Users,
  MessageSquare,
  Activity,
  AlertTriangle,
  TrendingUp,
  Settings,
  LogOut,
  Moon,
  Sun,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useTheme } from '@/contexts/ThemeContext';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const mockChartData = [
  { day: 'Mon', messages: 120, users: 45 },
  { day: 'Tue', messages: 180, users: 52 },
  { day: 'Wed', messages: 150, users: 48 },
  { day: 'Thu', messages: 220, users: 61 },
  { day: 'Fri', messages: 280, users: 75 },
  { day: 'Sat', messages: 190, users: 58 },
  { day: 'Sun', messages: 140, users: 42 },
];

const mockUsers = [
  { id: '1', name: 'John Doe', email: 'john@example.com', status: 'active', chats: 15 },
  { id: '2', name: 'Jane Smith', email: 'jane@example.com', status: 'active', chats: 28 },
  { id: '3', name: 'Bob Wilson', email: 'bob@example.com', status: 'blocked', chats: 5 },
  { id: '4', name: 'Alice Brown', email: 'alice@example.com', status: 'active', chats: 42 },
];

export default function AdminDashboard() {
  const { theme, toggleTheme } = useTheme();
  const { toast } = useToast();
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  
  const [rateLimits, setRateLimits] = useState({
    burst: 10,
    perChat: 50,
    hourly: 150,
    daily: 1000,
  });
  
  const [users, setUsers] = useState(mockUsers);

  useEffect(() => {
    const token = localStorage.getItem('kubera-admin-token');
    setIsAuthenticated(!!token);
    setIsLoading(false);
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('kubera-admin-token');
    setIsAuthenticated(false);
  };

  const handleToggleUserStatus = (id: string) => {
    setUsers((prev) =>
      prev.map((user) =>
        user.id === id
          ? { ...user, status: user.status === 'active' ? 'blocked' : 'active' }
          : user
      )
    );
    toast({
      title: 'User status updated',
      description: 'The user status has been changed.',
    });
  };

  const handleSaveRateLimits = () => {
    toast({
      title: 'Rate limits saved',
      description: 'The new rate limits are now active.',
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/admin" replace />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-4">
            <Link to="/admin/dashboard" className="brand-text text-xl tracking-widest">
              KUBERA
            </Link>
            <span className="text-xs px-2 py-1 rounded bg-foreground text-background font-medium">
              ADMIN
            </span>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={toggleTheme}>
              {theme === 'light' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout}>
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="container py-8">
        <h1 className="text-2xl font-bold mb-8">Dashboard</h1>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4 mb-8">
          <StatCard
            title="Total Users"
            value="1,247"
            icon={<Users className="h-4 w-4" />}
            trend="+12%"
          />
          <StatCard
            title="Active Chats"
            value="342"
            icon={<MessageSquare className="h-4 w-4" />}
            trend="+8%"
          />
          <StatCard
            title="Messages Today"
            value="2,891"
            icon={<Activity className="h-4 w-4" />}
            trend="+23%"
          />
          <StatCard
            title="Rate Limit Hits"
            value="17"
            icon={<AlertTriangle className="h-4 w-4" />}
            trend="-5%"
            negative
          />
        </div>

        {/* Charts */}
        <div className="grid gap-6 lg:grid-cols-2 mb-8">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Activity Overview
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={mockChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="day"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: 'hsl(var(--card))',
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '6px',
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="messages"
                      stroke="hsl(var(--foreground))"
                      strokeWidth={2}
                      dot={false}
                    />
                    <Line
                      type="monotone"
                      dataKey="users"
                      stroke="hsl(var(--muted-foreground))"
                      strokeWidth={2}
                      dot={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>

          {/* Rate Limits */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-4 w-4" />
                Rate Limits
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Burst Limit</label>
                  <Input
                    type="number"
                    value={rateLimits.burst}
                    onChange={(e) =>
                      setRateLimits({ ...rateLimits, burst: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Per Chat</label>
                  <Input
                    type="number"
                    value={rateLimits.perChat}
                    onChange={(e) =>
                      setRateLimits({ ...rateLimits, perChat: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Hourly</label>
                  <Input
                    type="number"
                    value={rateLimits.hourly}
                    onChange={(e) =>
                      setRateLimits({ ...rateLimits, hourly: parseInt(e.target.value) })
                    }
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Daily</label>
                  <Input
                    type="number"
                    value={rateLimits.daily}
                    onChange={(e) =>
                      setRateLimits({ ...rateLimits, daily: parseInt(e.target.value) })
                    }
                  />
                </div>
              </div>
              <Button onClick={handleSaveRateLimits} className="w-full">
                Save Rate Limits
              </Button>
            </CardContent>
          </Card>
        </div>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              User Management
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Email</TableHead>
                  <TableHead className="text-center">Chats</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                  <TableHead className="text-center">Active</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell className="font-medium">{user.name}</TableCell>
                    <TableCell className="text-muted-foreground">{user.email}</TableCell>
                    <TableCell className="text-center">{user.chats}</TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                          user.status === 'active'
                            ? 'bg-success/10 text-success'
                            : 'bg-destructive/10 text-destructive'
                        }`}
                      >
                        {user.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-center">
                      <Switch
                        checked={user.status === 'active'}
                        onCheckedChange={() => handleToggleUserStatus(user.id)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function StatCard({
  title,
  value,
  icon,
  trend,
  negative,
}: {
  title: string;
  value: string;
  icon: React.ReactNode;
  trend: string;
  negative?: boolean;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-muted-foreground">{title}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className="flex items-end justify-between">
          <span className="text-2xl font-bold">{value}</span>
          <span
            className={`text-xs font-medium ${
              negative ? 'text-destructive' : 'text-success'
            }`}
          >
            {trend}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
