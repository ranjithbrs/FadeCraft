import { MainLayout } from "@/components/layout/MainLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Bell, Globe, Shield, FileText, HelpCircle, LogOut } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";

const Settings = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to logout. Please try again.",
      });
    } else {
      toast({
        title: "Success",
        description: "Logged out successfully",
      });
      navigate("/auth");
    }
  };

  return (
    <MainLayout>
      <div className="container py-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Settings</h1>

        {/* Notification Settings */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Bell className="h-5 w-5 text-primary" />
              <CardTitle>Notification Preferences</CardTitle>
            </div>
            <CardDescription>
              Manage how you receive notifications
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="appointment-reminders">Appointment Reminders</Label>
                <p className="text-sm text-muted-foreground">
                  Receive reminders before your appointments
                </p>
              </div>
              <Switch id="appointment-reminders" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="queue-updates">Queue Updates</Label>
                <p className="text-sm text-muted-foreground">
                  Get notified about queue position changes
                </p>
              </div>
              <Switch id="queue-updates" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="booking-confirmations">Booking Confirmations</Label>
                <p className="text-sm text-muted-foreground">
                  Receive confirmation for new bookings
                </p>
              </div>
              <Switch id="booking-confirmations" defaultChecked />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="promotional">Promotional Notifications</Label>
                <p className="text-sm text-muted-foreground">
                  Receive updates about new features and offers
                </p>
              </div>
              <Switch id="promotional" />
            </div>
          </CardContent>
        </Card>

        {/* Language Settings */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Globe className="h-5 w-5 text-primary" />
              <CardTitle>Language & Region</CardTitle>
            </div>
            <CardDescription>
              Choose your preferred language
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="language">Language</Label>
              <Select defaultValue="en">
                <SelectTrigger id="language">
                  <SelectValue placeholder="Select language" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="en">English</SelectItem>
                  <SelectItem value="es">Español</SelectItem>
                  <SelectItem value="fr">Français</SelectItem>
                  <SelectItem value="de">Deutsch</SelectItem>
                  <SelectItem value="hi">हिन्दी</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Privacy & Security */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-primary" />
              <CardTitle>Privacy & Security</CardTitle>
            </div>
            <CardDescription>
              Manage your privacy and security settings
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="two-factor">Two-Factor Authentication</Label>
                <p className="text-sm text-muted-foreground">
                  Add an extra layer of security
                </p>
              </div>
              <Switch id="two-factor" />
            </div>
            <Separator />
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="data-sharing">Data Sharing</Label>
                <p className="text-sm text-muted-foreground">
                  Share anonymous data to improve service
                </p>
              </div>
              <Switch id="data-sharing" />
            </div>
            <Separator />
            <Button variant="outline" className="w-full justify-start">
              Change Password
            </Button>
          </CardContent>
        </Card>

        {/* Legal & Support */}
        <Card className="mb-6">
          <CardHeader>
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-primary" />
              <CardTitle>Legal & Support</CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <Button variant="ghost" className="w-full justify-start">
              <FileText className="mr-2 h-4 w-4" />
              Terms of Service
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <Shield className="mr-2 h-4 w-4" />
              Privacy Policy
            </Button>
            <Button variant="ghost" className="w-full justify-start">
              <HelpCircle className="mr-2 h-4 w-4" />
              Help & Support
            </Button>
          </CardContent>
        </Card>

        {/* App Information */}
        <Card className="mb-6">
          <CardContent className="pt-6">
            <div className="text-center text-sm text-muted-foreground">
              <p>MediQ Version 1.0.0</p>
              <p className="mt-1">© 2025 MediQ. All rights reserved.</p>
            </div>
          </CardContent>
        </Card>

        {/* Logout Button */}
        <Button
          variant="destructive"
          className="w-full"
          onClick={handleLogout}
        >
          <LogOut className="mr-2 h-4 w-4" />
          Logout
        </Button>
      </div>
    </MainLayout>
  );
};

export default Settings;
