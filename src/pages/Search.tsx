import { useState, useEffect } from "react";
import { MainLayout } from "@/components/layout/MainLayout";
import { Search as SearchIcon } from "lucide-react";
import { Input } from "@/components/ui/input";
import { SearchFilters } from "@/components/search/SearchFilters";
import { HospitalCard } from "@/components/search/HospitalCard";
import { DoctorCard } from "@/components/search/DoctorCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useSearchParams } from "react-router-dom";
import { useHospitals } from "@/hooks/useHospitals";
import { useDoctors } from "@/hooks/useDoctors";

const Search = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const specialtyParam = searchParams.get("specialty");
  const queryParam = searchParams.get("q");
  
  const [selectedSpecialties, setSelectedSpecialties] = useState<string[]>(
    specialtyParam ? [specialtyParam] : []
  );
  const [selectedCities, setSelectedCities] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState("rating");
  const [searchQuery, setSearchQuery] = useState(queryParam || "");

  // Sync search query from URL params
  useEffect(() => {
    if (queryParam) {
      setSearchQuery(queryParam);
    }
  }, [queryParam]);

  const handleSearch = (query: string) => {
    setSearchQuery(query);
    setSearchParams((prev) => {
      if (query) {
        prev.set("q", query);
      } else {
        prev.delete("q");
      }
      return prev;
    });
  };

  const { data: hospitals = [], isLoading: hospitalsLoading } = useHospitals({
    searchText: searchQuery,
    city: selectedCities[0],
    specialty: selectedSpecialties[0],
  });

  const { data: doctors = [], isLoading: doctorsLoading } = useDoctors({
    searchText: searchQuery,
    specialization: selectedSpecialties[0],
  });

  const loading = hospitalsLoading || doctorsLoading;

  const handleSpecialtyToggle = (specialty: string) => {
    setSelectedSpecialties((prev) =>
      prev.includes(specialty)
        ? prev.filter((s) => s !== specialty)
        : [...prev, specialty]
    );
  };

  const handleCityToggle = (city: string) => {
    setSelectedCities((prev) =>
      prev.includes(city)
        ? prev.filter((c) => c !== city)
        : [...prev, city]
    );
  };

  const handleClearFilters = () => {
    setSelectedSpecialties([]);
    setSelectedCities([]);
  };

  return (
    <MainLayout>
      <div className="container py-6 px-4 max-w-5xl mx-auto space-y-6 text-slate-100 min-h-screen">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-100">Find Salons & Master Stylists</h1>
          <p className="text-xs text-slate-400 mt-0.5">Explore top-rated grooming studios and reserve your chair</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-3 shadow-lg">
          <form onSubmit={(e) => { e.preventDefault(); handleSearch(searchQuery); }} className="relative">
            <SearchIcon className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-amber-400 pointer-events-none" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search studios, fade specialists, or grooming services..."
              className="pl-11 h-12 bg-slate-950/80 border-slate-700/80 text-slate-100 placeholder:text-slate-500 rounded-xl focus:ring-amber-500/30 focus:border-amber-500 text-sm"
            />
          </form>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <SearchFilters
            selectedSpecialties={selectedSpecialties}
            selectedCities={selectedCities}
            onSpecialtyToggle={handleSpecialtyToggle}
            onCityToggle={handleCityToggle}
            onClearFilters={handleClearFilters}
          />

          <Select value={sortBy} onValueChange={setSortBy}>
            <SelectTrigger className="w-[180px] bg-slate-900 border-slate-800 text-slate-200">
              <SelectValue placeholder="Sort by" />
            </SelectTrigger>
            <SelectContent className="bg-slate-900 border-slate-800 text-slate-200">
              <SelectItem value="rating">Highest Rated</SelectItem>
              <SelectItem value="name">Name (A-Z)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Tabs defaultValue="hospitals" className="w-full">
          <TabsList className="grid w-full grid-cols-2 bg-slate-900 border border-slate-800 text-slate-400">
            <TabsTrigger value="hospitals" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 data-[state=active]:font-bold transition-all">
              Studios & Salons ({hospitals.length})
            </TabsTrigger>
            <TabsTrigger value="doctors" className="data-[state=active]:bg-amber-500 data-[state=active]:text-slate-950 data-[state=active]:font-bold transition-all">
              Stylists & Barbers ({doctors.length})
            </TabsTrigger>
          </TabsList>
          
          <TabsContent value="hospitals" className="space-y-4 mt-6">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-64 w-full bg-slate-900 border border-slate-800" />
              ))
            ) : hospitals.length === 0 ? (
              <div className="text-center py-12 text-slate-400">
                <p>No studios found matching your criteria</p>
              </div>
            ) : (
              hospitals.map((hospital) => (
                <HospitalCard
                  key={hospital.id}
                  id={hospital.id}
                  name={hospital.name}
                  address={hospital.address}
                  city={hospital.city}
                  specialties={hospital.specialties}
                  rating={hospital.rating}
                  totalReviews={hospital.total_reviews}
                  image={hospital.images[0] || "/placeholder.svg"}
                />
              ))
            )}
          </TabsContent>
          
          <TabsContent value="doctors" className="space-y-4">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-48 w-full" />
              ))
            ) : doctors.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No doctors found matching your criteria</p>
              </div>
            ) : (
              doctors.map((doctor) => (
                <DoctorCard
                  key={doctor.id}
                  id={doctor.id}
                  name={doctor.name}
                  photo={doctor.photo || "/placeholder.svg"}
                  specialization={doctor.specialization}
                  qualification={doctor.qualification}
                  experience={doctor.experience}
                  consultationFee={doctor.consultation_fee}
                  rating={doctor.rating}
                  totalReviews={doctor.total_reviews}
                  availabilityStatus={doctor.availability_status as "available" | "busy" | "offline"}
                />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </MainLayout>
  );
};

export default Search;
