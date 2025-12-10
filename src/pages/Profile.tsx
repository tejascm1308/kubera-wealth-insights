import { useState, useEffect } from 'react';
import { Navigate } from 'react-router-dom';
import { User, Briefcase, Plus, Trash2, Save, X, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { userApi, portfolioApi } from '@/lib/api';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

interface Holding {
  id: string;
  symbol: string;
  quantity: number;
  avgPrice: number;
  sector: string;
}

export default function Profile() {
  const { user, isAuthenticated, isLoading: authLoading, refreshUser } = useAuth();
  const { toast } = useToast();
  
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoadingProfile, setIsLoadingProfile] = useState(true);
  const [isLoadingHoldings, setIsLoadingHoldings] = useState(true);
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    username: '',
    riskTolerance: 'moderate',
    investmentHorizon: 'medium',
  });
  
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [newHolding, setNewHolding] = useState({ symbol: '', quantity: '', avgPrice: '', sector: '' });
  const [dialogOpen, setDialogOpen] = useState(false);
  const [isAddingHolding, setIsAddingHolding] = useState(false);

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const response = await userApi.getProfile();
        const profileData = response.user;
        setProfile({
          name: profileData.name || '',
          email: profileData.email || '',
          username: profileData.username || '',
          riskTolerance: profileData.risk_tolerance || 'moderate',
          investmentHorizon: profileData.investment_horizon || 'medium',
        });
      } catch (error) {
        console.error('Failed to load profile:', error);
        toast({ title: 'Failed to load profile', variant: 'destructive' });
      } finally {
        setIsLoadingProfile(false);
      }
    };

    if (isAuthenticated) loadProfile();
  }, [isAuthenticated, toast]);

  useEffect(() => {
    const loadHoldings = async () => {
      try {
        const response = await portfolioApi.getHoldings();
        setHoldings(
          response.holdings.map((h) => ({
            id: h.holding_id,
            symbol: h.symbol,
            quantity: h.quantity,
            avgPrice: h.avg_price,
            sector: h.sector || 'Other',
          }))
        );
      } catch (error) {
        console.error('Failed to load holdings:', error);
        toast({ title: 'Failed to load portfolio', variant: 'destructive' });
      } finally {
        setIsLoadingHoldings(false);
      }
    };

    if (isAuthenticated) loadHoldings();
  }, [isAuthenticated, toast]);

  if (authLoading) {
    return (
      <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center">
        <div className="animate-pulse text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />;

  const handleSaveProfile = async () => {
    setIsSaving(true);
    try {
      await userApi.updateProfile({
        name: profile.name,
        risk_tolerance: profile.riskTolerance,
        investment_horizon: profile.investmentHorizon,
      });
      await refreshUser();
      toast({ title: 'Profile updated', description: 'Your profile has been saved successfully.' });
      setIsEditing(false);
    } catch (error) {
      console.error('Failed to save profile:', error);
      toast({ title: 'Failed to save profile', variant: 'destructive' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleAddHolding = async () => {
    if (!newHolding.symbol || !newHolding.quantity || !newHolding.avgPrice) {
      toast({ title: 'Error', description: 'Please fill in all required fields', variant: 'destructive' });
      return;
    }

    setIsAddingHolding(true);
    try {
      const response = await portfolioApi.addHolding({
        symbol: newHolding.symbol.toUpperCase(),
        quantity: parseFloat(newHolding.quantity),
        avg_price: parseFloat(newHolding.avgPrice),
        sector: newHolding.sector || 'Other',
      });

      const holding = response.holding;
      setHoldings(prev => [
        ...prev,
        {
          id: holding.holding_id,
          symbol: holding.symbol,
          quantity: holding.quantity,
          avgPrice: holding.avg_price,
          sector: holding.sector || 'Other',
        },
      ]);
      
      setNewHolding({ symbol: '', quantity: '', avgPrice: '', sector: '' });
      setDialogOpen(false);
      toast({ title: 'Holding added', description: `${holding.symbol} has been added to your portfolio.` });
    } catch (error) {
      console.error('Failed to add holding:', error);
      toast({ title: 'Failed to add holding', variant: 'destructive' });
    } finally {
      setIsAddingHolding(false);
    }
  };

  const handleDeleteHolding = async (id: string) => {
    try {
      await portfolioApi.deleteHolding(id);
      setHoldings(prev => prev.filter(h => h.id !== id));
      toast({ title: 'Holding removed', description: 'The holding has been removed from your portfolio.' });
    } catch (error) {
      console.error('Failed to delete holding:', error);
      toast({ title: 'Failed to remove holding', variant: 'destructive' });
    }
  };

  const totalValue = holdings.reduce((sum, h) => sum + h.quantity * h.avgPrice, 0);

  return (
    <div className="container py-8 max-w-5xl">
      <h1 className="text-2xl font-bold mb-8">Profile & Portfolio</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => (isEditing ? handleSaveProfile() : setIsEditing(true))} disabled={isSaving}>
              {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : isEditing ? <><Save className="h-4 w-4 mr-1" /> Save</> : 'Edit'}
            </Button>
          </CardHeader>
          <CardContent className="space-y-4">
            {isLoadingProfile ? (
              <div className="py-8 text-center text-muted-foreground">Loading profile...</div>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Name</label>
                  {isEditing ? <Input value={profile.name} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /> : <p className="text-sm">{profile.name}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Email</label>
                  <p className="text-sm">{profile.email}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Username</label>
                  <p className="text-sm">@{profile.username}</p>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Risk Tolerance</label>
                  {isEditing ? (
                    <Select value={profile.riskTolerance} onValueChange={(v) => setProfile({ ...profile, riskTolerance: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="conservative">Conservative</SelectItem>
                        <SelectItem value="moderate">Moderate</SelectItem>
                        <SelectItem value="aggressive">Aggressive</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <p className="text-sm capitalize">{profile.riskTolerance}</p>}
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium text-muted-foreground">Investment Horizon</label>
                  {isEditing ? (
                    <Select value={profile.investmentHorizon} onValueChange={(v) => setProfile({ ...profile, investmentHorizon: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="short">Short (1-2 years)</SelectItem>
                        <SelectItem value="medium">Medium (3-5 years)</SelectItem>
                        <SelectItem value="long">Long (5+ years)</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : <p className="text-sm capitalize">{profile.investmentHorizon} term</p>}
                </div>
                {isEditing && <Button variant="ghost" size="sm" onClick={() => setIsEditing(false)} className="mt-2"><X className="h-4 w-4 mr-1" /> Cancel</Button>}
              </>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="flex items-center gap-2"><Briefcase className="h-5 w-5" />Portfolio</CardTitle>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild><Button variant="outline" size="sm"><Plus className="h-4 w-4 mr-1" /> Add</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Holding</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Symbol</label>
                    <Input placeholder="e.g., TCS" value={newHolding.symbol} onChange={(e) => setNewHolding({ ...newHolding, symbol: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Quantity</label>
                      <Input type="number" placeholder="100" value={newHolding.quantity} onChange={(e) => setNewHolding({ ...newHolding, quantity: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">Avg. Price (₹)</label>
                      <Input type="number" placeholder="1500" value={newHolding.avgPrice} onChange={(e) => setNewHolding({ ...newHolding, avgPrice: e.target.value })} />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">Sector</label>
                    <Input placeholder="e.g., IT, Banking" value={newHolding.sector} onChange={(e) => setNewHolding({ ...newHolding, sector: e.target.value })} />
                  </div>
                  <Button onClick={handleAddHolding} className="w-full" disabled={isAddingHolding}>
                    {isAddingHolding ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Add Holding
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </CardHeader>
          <CardContent>
            <div className="mb-4 p-3 rounded-md bg-secondary">
              <p className="text-sm text-muted-foreground">Total Value</p>
              <p className="text-xl font-semibold">₹{totalValue.toLocaleString('en-IN', { maximumFractionDigits: 2 })}</p>
            </div>
            {isLoadingHoldings ? (
              <div className="py-8 text-center text-muted-foreground">Loading portfolio...</div>
            ) : holdings.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">No holdings added yet</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Symbol</TableHead>
                    <TableHead className="text-right">Qty</TableHead>
                    <TableHead className="text-right">Avg Price</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {holdings.map((holding) => (
                    <TableRow key={holding.id}>
                      <TableCell><div><p className="font-medium">{holding.symbol}</p><p className="text-xs text-muted-foreground">{holding.sector}</p></div></TableCell>
                      <TableCell className="text-right">{holding.quantity}</TableCell>
                      <TableCell className="text-right">₹{holding.avgPrice.toLocaleString('en-IN')}</TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteHolding(holding.id)}>
                          <Trash2 className="h-3 w-3 text-destructive" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
