import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { ArrowLeft, Upload, Loader2 } from "lucide-react";
import { z } from "zod";

const profileSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  phone: z.string().min(10, "Phone must be at least 10 digits"),
  address: z.string().optional(),
  emergencyContact: z.string().optional(),
  emergencyPhone: z.string().optional(),
});

const ProfileEdit = () => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Form state
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("+91 ");
  const [address, setAddress] = useState("");
  const [emergencyContact, setEmergencyContact] = useState("");
  const [emergencyPhone, setEmergencyPhone] = useState("+91 ");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [bloodGroup, setBloodGroup] = useState("");
  const [medicalHistory, setMedicalHistory] = useState("");
  const [allergies, setAllergies] = useState("");
  const [currentMedications, setCurrentMedications] = useState("");
  const [insuranceProvider, setInsuranceProvider] = useState("");
  const [insuranceNumber, setInsuranceNumber] = useState("");
  const [insuranceExpiry, setInsuranceExpiry] = useState("");

  useEffect(() => {
    loadUserData();
  }, []);

  const loadUserData = async () => {
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setEmail(user.email || "");
        setFullName(user.user_metadata.full_name || "");

        // Load profile data from profiles table
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("*")
          .eq("id", user.id)
          .single();

        if (error && error.code !== "PGRST116") {
          console.error("Error loading profile:", error);
        } else if (profile) {
          setPhone(profile.phone || "+91 ");
          setAddress(profile.address || "");
          setEmergencyContact(profile.emergency_contact || "");
          setEmergencyPhone(profile.emergency_phone || "");
          setDateOfBirth(profile.date_of_birth || "");
          setBloodGroup(profile.blood_group || "");
          setMedicalHistory(profile.medical_history || "");
          setAllergies(profile.allergies || "");
          setCurrentMedications(profile.current_medications || "");
          setInsuranceProvider(profile.insurance_provider || "");
          setInsuranceNumber(profile.insurance_number || "");
          setInsuranceExpiry(profile.insurance_expiry || "");
        }
      }
    } catch (error) {
      console.error("Error loading user data:", error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const validated = profileSchema.parse({
        fullName,
        phone,
        address,
        emergencyContact,
        emergencyPhone,
      });

      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("No user found");

      // Update user metadata
      const { error: authError } = await supabase.auth.updateUser({
        data: {
          full_name: validated.fullName,
        },
      });

      if (authError) throw authError;

      // Update profile data in profiles table
      const { error: profileError } = await supabase
        .from("profiles")
        .update({
          full_name: validated.fullName,
          phone: validated.phone,
          address: validated.address || null,
          emergency_contact: validated.emergencyContact || null,
          emergency_phone: validated.emergencyPhone || null,
          date_of_birth: dateOfBirth || null,
          blood_group: bloodGroup || null,
          medical_history: medicalHistory || null,
          allergies: allergies || null,
          current_medications: currentMedications || null,
          insurance_provider: insuranceProvider || null,
          insurance_number: insuranceNumber || null,
          insurance_expiry: insuranceExpiry || null,
        })
        .eq("id", user.id);

      if (profileError) throw profileError;

      toast({
        title: "Success",
        description: "Profile updated successfully",
      });
      navigate("/profile");
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast({
          variant: "destructive",
          title: "Validation error",
          description: error.errors[0].message,
        });
      } else {
        toast({
          variant: "destructive",
          title: "Error",
          description: "Failed to update profile. Please try again.",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <MainLayout>
        <div className="container py-6 flex items-center justify-center min-h-[50vh]">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="container py-6 max-w-4xl">
        <Button
          variant="ghost"
          className="mb-4"
          onClick={() => navigate("/profile")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Profile
        </Button>

        <h1 className="text-3xl font-bold mb-6">Edit Profile</h1>

        {/* Profile Photo */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Profile Photo</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-6">
              <Avatar className="h-24 w-24">
                <AvatarImage src="" alt={fullName} />
                <AvatarFallback className="text-2xl">
                  {fullName.split(" ").map(n => n[0]).join("").toUpperCase()}
                </AvatarFallback>
              </Avatar>
              <Button variant="outline">
                <Upload className="mr-2 h-4 w-4" />
                Upload Photo
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Personal Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Personal Information</CardTitle>
            <CardDescription>Update your personal details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">Full Name *</Label>
                <Input
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Phone Number *</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={phone}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Ensure +91 prefix is always present
                    if (!value.startsWith("+91")) {
                      setPhone("+91 " + value.replace(/^\+91\s*/, ""));
                    } else {
                      setPhone(value);
                    }
                  }}
                  placeholder="+91 98765 43210"
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="address">Address</Label>
                <Textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="123 Main St, City, State, ZIP"
                  rows={2}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Emergency Contact */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Emergency Contact</CardTitle>
            <CardDescription>Person to contact in case of emergency</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="emergencyContact">Contact Name</Label>
                <Input
                  id="emergencyContact"
                  value={emergencyContact}
                  onChange={(e) => setEmergencyContact(e.target.value)}
                  placeholder="Jane Doe"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="emergencyPhone">Contact Phone</Label>
                <Input
                  id="emergencyPhone"
                  type="tel"
                  value={emergencyPhone}
                  onChange={(e) => {
                    const value = e.target.value;
                    // Ensure +91 prefix is always present
                    if (!value.startsWith("+91")) {
                      setEmergencyPhone("+91 " + value.replace(/^\+91\s*/, ""));
                    } else {
                      setEmergencyPhone(value);
                    }
                  }}
                  placeholder="+91 98765 43210"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Medical Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Medical Information</CardTitle>
            <CardDescription>Your medical history and conditions</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="dateOfBirth">Date of Birth</Label>
                <Input
                  id="dateOfBirth"
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => setDateOfBirth(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="bloodGroup">Blood Group</Label>
                <Input
                  id="bloodGroup"
                  value={bloodGroup}
                  onChange={(e) => setBloodGroup(e.target.value)}
                  placeholder="O+, A-, etc."
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="allergies">Allergies</Label>
              <Textarea
                id="allergies"
                value={allergies}
                onChange={(e) => setAllergies(e.target.value)}
                placeholder="List any known allergies (medications, food, etc.)"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="medicalHistory">Medical History</Label>
              <Textarea
                id="medicalHistory"
                value={medicalHistory}
                onChange={(e) => setMedicalHistory(e.target.value)}
                placeholder="List any past medical conditions, surgeries, or ongoing treatments"
                rows={4}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="currentMedications">Current Medications</Label>
              <Textarea
                id="currentMedications"
                value={currentMedications}
                onChange={(e) => setCurrentMedications(e.target.value)}
                placeholder="List current medications..."
                rows={2}
              />
            </div>
          </CardContent>
        </Card>

        {/* Insurance Information */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Insurance Information</CardTitle>
            <CardDescription>Your health insurance details</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="insuranceProvider">Insurance Provider</Label>
                <Input
                  id="insuranceProvider"
                  value={insuranceProvider}
                  onChange={(e) => setInsuranceProvider(e.target.value)}
                  placeholder="Blue Cross Blue Shield"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceNumber">Policy Number</Label>
                <Input
                  id="insuranceNumber"
                  value={insuranceNumber}
                  onChange={(e) => setInsuranceNumber(e.target.value)}
                  placeholder="ABC123456789"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insuranceExpiry">Policy Expiry Date</Label>
                <Input
                  id="insuranceExpiry"
                  type="date"
                  value={insuranceExpiry}
                  onChange={(e) => setInsuranceExpiry(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => navigate("/profile")}
          >
            Cancel
          </Button>
          <Button
            className="flex-1"
            onClick={handleSave}
            disabled={isSaving}
          >
            {isSaving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save Changes
          </Button>
        </div>
      </div>
    </MainLayout>
  );
};

export default ProfileEdit;
