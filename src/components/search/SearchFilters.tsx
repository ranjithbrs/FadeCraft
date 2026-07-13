import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Filter, X } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface SearchFiltersProps {
  selectedSpecialties: string[];
  selectedCities: string[];
  onSpecialtyToggle: (specialty: string) => void;
  onCityToggle: (city: string) => void;
  onClearFilters: () => void;
}

const specialties = [
  "Cardiology",
  "Neurology",
  "Orthopedics",
  "Pediatrics",
  "Ophthalmology",
  "Dermatology",
  "General Medicine",
];

const cities = ["Mumbai", "Delhi", "Bangalore", "Chennai", "Kolkata", "Hyderabad"];

export const SearchFilters = ({
  selectedSpecialties,
  selectedCities,
  onSpecialtyToggle,
  onCityToggle,
  onClearFilters,
}: SearchFiltersProps) => {
  const activeFiltersCount = selectedSpecialties.length + selectedCities.length;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Sheet>
          <SheetTrigger asChild>
            <Button variant="outline" className="gap-2">
              <Filter className="h-4 w-4" />
              Filters
              {activeFiltersCount > 0 && (
                <Badge variant="default" className="ml-1 h-5 w-5 p-0 flex items-center justify-center rounded-full">
                  {activeFiltersCount}
                </Badge>
              )}
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-80 overflow-y-auto">
            <SheetHeader>
              <SheetTitle>Filter Results</SheetTitle>
              <SheetDescription>
                Refine your search by specialty and location
              </SheetDescription>
            </SheetHeader>
            
            <div className="mt-6 space-y-6">
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">Specialty</h3>
                  {selectedSpecialties.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectedSpecialties.forEach(onSpecialtyToggle)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {specialties.map((specialty) => (
                    <div key={specialty} className="flex items-center space-x-2">
                      <Checkbox
                        id={`specialty-${specialty}`}
                        checked={selectedSpecialties.includes(specialty)}
                        onCheckedChange={() => onSpecialtyToggle(specialty)}
                      />
                      <Label
                        htmlFor={`specialty-${specialty}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {specialty}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <h3 className="font-semibold">City</h3>
                  {selectedCities.length > 0 && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => selectedCities.forEach(onCityToggle)}
                    >
                      Clear
                    </Button>
                  )}
                </div>
                <div className="space-y-3">
                  {cities.map((city) => (
                    <div key={city} className="flex items-center space-x-2">
                      <Checkbox
                        id={`city-${city}`}
                        checked={selectedCities.includes(city)}
                        onCheckedChange={() => onCityToggle(city)}
                      />
                      <Label
                        htmlFor={`city-${city}`}
                        className="text-sm font-normal cursor-pointer"
                      >
                        {city}
                      </Label>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {activeFiltersCount > 0 && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onClearFilters}
            className="gap-2"
          >
            <X className="h-4 w-4" />
            Clear All
          </Button>
        )}
      </div>

      {activeFiltersCount > 0 && (
        <div className="flex flex-wrap gap-2">
          {selectedSpecialties.map((specialty) => (
            <Badge
              key={specialty}
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer"
              onClick={() => onSpecialtyToggle(specialty)}
            >
              {specialty}
              <X className="h-3 w-3" />
            </Badge>
          ))}
          {selectedCities.map((city) => (
            <Badge
              key={city}
              variant="secondary"
              className="gap-1 pr-1 cursor-pointer"
              onClick={() => onCityToggle(city)}
            >
              {city}
              <X className="h-3 w-3" />
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
};