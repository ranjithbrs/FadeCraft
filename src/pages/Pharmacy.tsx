import { MainLayout } from "@/components/layout/MainLayout";
import { usePharmacy } from "@/hooks/usePharmacy";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Pill, MapPin, Phone, Mail } from "lucide-react";

const Pharmacy = () => {
  const { data: pharmacies, isLoading, error } = usePharmacy();

  return (
    <MainLayout>
      <div className="px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Pharmacies</h1>
        
        {isLoading && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-32 w-full rounded-lg" />
            ))}
          </div>
        )}

        {error && (
          <div className="text-center py-8 text-destructive">
            Failed to load pharmacies. Please try again.
          </div>
        )}

        {pharmacies && pharmacies.length === 0 && (
          <div className="text-center py-8 text-muted-foreground">
            No pharmacies found.
          </div>
        )}

        <div className="space-y-4">
          {pharmacies?.map((pharmacy) => (
            <Card key={pharmacy.id} className="p-4">
              <div className="flex gap-4">
                <div className="w-16 h-16 bg-success/10 rounded-lg flex items-center justify-center flex-shrink-0">
                  <Pill className="h-8 w-8 text-success" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-lg truncate">{pharmacy.name}</h3>
                  
                  {pharmacy.address && (
                    <div className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
                      <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <span className="line-clamp-2">{pharmacy.address}</span>
                    </div>
                  )}
                  
                  <div className="flex flex-wrap gap-4 mt-2">
                    {pharmacy.phone && (
                      <a 
                        href={`tel:${pharmacy.phone}`}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Phone className="h-4 w-4" />
                        {pharmacy.phone}
                      </a>
                    )}
                    
                    {pharmacy.email && (
                      <a 
                        href={`mailto:${pharmacy.email}`}
                        className="flex items-center gap-1 text-sm text-primary hover:underline"
                      >
                        <Mail className="h-4 w-4" />
                        {pharmacy.email}
                      </a>
                    )}
                  </div>
                </div>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </MainLayout>
  );
};

export default Pharmacy;
