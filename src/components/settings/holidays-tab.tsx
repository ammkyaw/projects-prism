'use client';

import type { ChangeEvent } from 'react';
import { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'; // Import Select components
import {
  PlusCircle,
  Trash2,
  CalendarDays,
  Save,
  Edit,
  XCircle,
  Globe,
  Info,
} from 'lucide-react'; // Added Info icon
import type { HolidayCalendar, PublicHoliday } from '@/types/sprint-data';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { format, parseISO, isValid, getYear } from 'date-fns';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';

interface HolidaysTabProps {
  projectId: string;
  projectName: string;
  initialCalendars: HolidayCalendar[];
  onSaveCalendars: (calendars: HolidayCalendar[]) => void;
}

interface EditableCalendar extends HolidayCalendar {
  _internalId: string; // For React key management
  holidays: EditableHoliday[];
  isCountryBased?: boolean; // Flag to indicate if holidays are auto-populated
  isLoading?: boolean; // Flag to indicate holidays are being fetched
}

interface EditableHoliday extends PublicHoliday {
  _internalId: string; // For React key management
  dateObj?: Date | null; // For date picker state
}

// Updated list of countries for the dropdown
const countryOptions = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'CA', name: 'Canada' },
  { code: 'AU', name: 'Australia' },
  { code: 'DE', name: 'Germany' },
  { code: 'SG', name: 'Singapore' }, // Added Singapore
  { code: 'JP', name: 'Japan' },
  // Removed Brazil, France, India
];

const createEmptyCalendar = (): EditableCalendar => ({
  _internalId: `cal_${Date.now()}_${Math.random()}`,
  id: '', // Will be assigned on save
  name: 'New Calendar',
  countryCode: '', // Initialize country code as empty string
  holidays: [createEmptyHoliday()],
  isCountryBased: false,
  isLoading: false,
});

const createEmptyHoliday = (): EditableHoliday => ({
  _internalId: `holiday_${Date.now()}_${Math.random()}`,
  id: '',
  name: '',
  date: '',
  dateObj: null,
});

// Helper to parse date string safely
const parseDateString = (dateString: string | undefined): Date | undefined => {
  if (!dateString) return undefined;
  try {
    const parsed = parseISO(dateString);
    return isValid(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
};

export default function HolidaysTab({
  projectId,
  projectName,
  initialCalendars,
  onSaveCalendars,
}: HolidaysTabProps) {
  const [calendars, setCalendars] = useState<EditableCalendar[]>([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const { toast } = useToast();
  const currentYear = getYear(new Date()); // Get current year for holiday fetching

  // --- New function to fetch holidays from the Nager.Date API ---
  const fetchNagerHolidays = useCallback(
    async (countryCode: string, year: number): Promise<PublicHoliday[]> => {
      if (!countryCode) return []; // Don't fetch if no country code

      try {
        const response = await fetch(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/${countryCode}`
        );
        if (!response.ok) {
          // Attempt to parse error response body for more details
          let errorBody = '';
          try {
            errorBody = await response.text();
          } catch {
            // Ignore if can't read body
          }
          console.error(
            `HTTP error fetching holidays for ${countryCode}: ${response.status} ${response.statusText}`,
            errorBody
          );
          throw new Error(
            `HTTP error! status: ${response.status} - Failed to fetch holidays for ${countryCode}`
          );
        }
        const data = await response.json();
        // Map the API response to the PublicHoliday type
        const holidays: PublicHoliday[] = data.map(
          (item: any, index: number) => ({
            id: `nager_${countryCode}_${year}_${item.date}_${index}`, // Generate a unique ID using date
            name: item.name,
            date: item.date, // Already in YYYY-MM-DD format
          })
        );
        console.log(
          `Fetched ${holidays.length} holidays for ${countryCode} in ${year}`
        );
        return holidays;
      } catch (error: any) {
        console.error(
          `Failed to fetch holidays from Nager.Date API for ${countryCode}:`,
          error.message
        );
        toast({
          variant: 'destructive',
          title: 'Error Fetching Holidays',
          description: `Could not retrieve holidays for ${countryCode}. ${error.message}`,
        });
        return [];
      }
    },
    [toast]
  );

  // Initialize or update calendars based on initial prop
  useEffect(() => {
    console.log('Initializing calendars from props:', initialCalendars);
    const mappedCalendars = initialCalendars.map((cal, calIndex) => ({
      ...cal,
      countryCode: cal.countryCode || '',
      _internalId: cal.id || `initial_cal_${calIndex}_${Date.now()}`,
      isCountryBased: !!cal.countryCode,
      isLoading: false, // Initialize isLoading flag
      holidays: (cal.holidays || []).map((holiday, holIndex) => ({
        ...holiday,
        _internalId:
          holiday.id || `initial_hol_${calIndex}_${holIndex}_${Date.now()}`,
        dateObj: parseDateString(holiday.date),
      })),
    }));
    setCalendars(mappedCalendars);
    // Add one empty calendar if none exist initially
    if (mappedCalendars.length === 0) {
      setCalendars([createEmptyCalendar()]);
    }
    setHasUnsavedChanges(false);
  }, [initialCalendars, projectId]); // Only depend on initial data and project ID

  // Track unsaved changes
  useEffect(() => {
    const cleanCalendars = (
      cals: HolidayCalendar[]
    ): Omit<HolidayCalendar, 'id' | 'holidays'> &
      { holidays: Omit<PublicHoliday, 'id'>[] }[] =>
      cals
        .map(({ id, holidays, ...rest }) => ({
          ...rest,
          name: rest.name.trim(),
          countryCode: rest.countryCode?.trim() || undefined, // Store as undefined if empty
          holidays: (holidays || [])
            .map(({ id: hId, ...hRest }) => ({
              ...hRest,
              name: hRest.name.trim(),
              date: hRest.date.trim(),
            }))
            .sort((a, b) => a.date.localeCompare(b.date)), // Sort holidays by date
        }))
        .sort((a, b) => a.name.localeCompare(b.name)); // Sort calendars by name

    const originalCalendarsString = JSON.stringify(
      cleanCalendars(initialCalendars)
    );
    const currentCalendarsString = JSON.stringify(
      cleanCalendars(
        calendars.filter(
          (cal) =>
            cal.name.trim() ||
            cal.holidays.some((h) => h.name.trim() || h.date.trim()) ||
            cal.countryCode
        ) // Filter empty before comparing
      )
    );
    setHasUnsavedChanges(originalCalendarsString !== currentCalendarsString);
  }, [calendars, initialCalendars]);

  const handleAddCalendar = () => {
    setCalendars((prev) => [...prev, createEmptyCalendar()]);
    setHasUnsavedChanges(true);
  };

  const handleRemoveCalendar = (internalId: string) => {
    setCalendars((prev) => {
      const newCalendars = prev.filter((cal) => cal._internalId !== internalId);
      // Ensure at least one (potentially empty) calendar remains
      return newCalendars.length > 0 ? newCalendars : [createEmptyCalendar()];
    });
    setHasUnsavedChanges(true);
  };

  const handleCalendarInputChange = (
    internalId: string,
    field: keyof Omit<HolidayCalendar, 'id' | 'holidays' | 'countryCode'>,
    value: string
  ) => {
    setCalendars((prev) =>
      prev.map((cal) =>
        cal._internalId === internalId ? { ...cal, [field]: value } : cal
      )
    );
    setHasUnsavedChanges(true);
  };

  // Handler specifically for country code change from Select
  const handleCountryChange = (internalId: string, value: string) => {
    const countryCode = value === 'none' ? '' : value;
    const isNowCountryBased = !!countryCode;

    // Set loading state for the specific calendar
    setCalendars((prev) =>
      prev.map((cal) =>
        cal._internalId === internalId
          ? { ...cal, isLoading: isNowCountryBased }
          : cal
      )
    );
    setHasUnsavedChanges(true); // Mark as changed immediately

    if (isNowCountryBased) {
      fetchNagerHolidays(countryCode, currentYear)
        .then((fetchedHolidays) => {
          // Map fetched holidays to EditableHoliday format
          const mappedEditableHolidays = fetchedHolidays.map((hol, index) => ({
            ...hol,
            _internalId:
              hol.id || `fetched_${internalId}_${index}_${Date.now()}`,
            dateObj: parseDateString(hol.date),
          }));

          setCalendars((prev) =>
            prev.map((cal) => {
              if (cal._internalId === internalId) {
                return {
                  ...cal,
                  countryCode: countryCode,
                  isCountryBased: true,
                  holidays: mappedEditableHolidays,
                  isLoading: false, // Turn off loading
                };
              }
              return cal;
            })
          );
        })
        .catch(() => {
          // If fetch fails, reset loading state
          setCalendars((prev) =>
            prev.map((cal) =>
              cal._internalId === internalId
                ? { ...cal, isLoading: false }
                : cal
            )
          );
        });
    } else {
      // If switching to custom, clear holidays and reset flags
      setCalendars((prev) =>
        prev.map((cal) => {
          if (cal._internalId === internalId) {
            return {
              ...cal,
              countryCode: '',
              isCountryBased: false,
              holidays: [createEmptyHoliday()], // Start with one empty row for custom
              isLoading: false, // Ensure loading is off
            };
          }
          return cal;
        })
      );
    }
  };

  const handleAddHoliday = (calendarInternalId: string) => {
    // Prevent adding if it's a country-based calendar
    const calendar = calendars.find(
      (cal) => cal._internalId === calendarInternalId
    );
    if (calendar?.isCountryBased) {
      toast({
        variant: 'default',
        title: 'Info',
        description:
          'Manual holiday editing is disabled for country-based calendars.',
      });
      return;
    }
    setCalendars((prev) =>
      prev.map((cal) =>
        cal._internalId === calendarInternalId
          ? { ...cal, holidays: [...cal.holidays, createEmptyHoliday()] }
          : cal
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleRemoveHoliday = (
    calendarInternalId: string,
    holidayInternalId: string
  ) => {
    // Prevent removing if it's a country-based calendar
    const calendar = calendars.find(
      (cal) => cal._internalId === calendarInternalId
    );
    if (calendar?.isCountryBased) {
      toast({
        variant: 'default',
        title: 'Info',
        description:
          'Manual holiday editing is disabled for country-based calendars.',
      });
      return;
    }
    setCalendars((prev) =>
      prev.map((cal) => {
        if (cal._internalId === calendarInternalId) {
          const updatedHolidays = cal.holidays.filter(
            (hol) => hol._internalId !== holidayInternalId
          );
          // Keep at least one empty holiday row if all are removed
          return {
            ...cal,
            holidays:
              updatedHolidays.length > 0
                ? updatedHolidays
                : [createEmptyHoliday()],
          };
        }
        return cal;
      })
    );
    setHasUnsavedChanges(true);
  };

  const handleHolidayInputChange = (
    calendarInternalId: string,
    holidayInternalId: string,
    field: keyof Omit<PublicHoliday, 'id' | 'date'>,
    value: string
  ) => {
    // Prevent editing if it's a country-based calendar
    const calendar = calendars.find(
      (cal) => cal._internalId === calendarInternalId
    );
    if (calendar?.isCountryBased) return; // Silently ignore or show toast

    setCalendars((prev) =>
      prev.map((cal) =>
        cal._internalId === calendarInternalId
          ? {
              ...cal,
              holidays: cal.holidays.map((hol) =>
                hol._internalId === holidayInternalId
                  ? { ...hol, [field]: value }
                  : hol
              ),
            }
          : cal
      )
    );
    setHasUnsavedChanges(true);
  };

  const handleHolidayDateChange = (
    calendarInternalId: string,
    holidayInternalId: string,
    date: Date | undefined
  ) => {
    // Prevent editing if it's a country-based calendar
    const calendar = calendars.find(
      (cal) => cal._internalId === calendarInternalId
    );
    if (calendar?.isCountryBased) return; // Silently ignore or show toast

    setCalendars((prev) =>
      prev.map((cal) =>
        cal._internalId === calendarInternalId
          ? {
              ...cal,
              holidays: cal.holidays.map((hol) =>
                hol._internalId === holidayInternalId
                  ? {
                      ...hol,
                      date: date ? format(date, 'yyyy-MM-dd') : '',
                      dateObj: date,
                    }
                  : hol
              ),
            }
          : cal
      )
    );
    setHasUnsavedChanges(true);
  };

  const renderDatePicker = (
    calendarInternalId: string,
    holidayInternalId: string,
    dateValue: Date | undefined,
    disabled: boolean
  ) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant={'outline'}
          className={cn(
            'h-9 w-full justify-start px-2 text-left text-xs font-normal',
            !dateValue && 'text-muted-foreground'
          )}
          disabled={disabled}
        >
          <CalendarDays className="mr-1 h-3 w-3" />
          {dateValue ? (
            format(dateValue, 'MM/dd/yyyy')
          ) : (
            <span>Pick a date</span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="single"
          selected={dateValue}
          onSelect={(date) =>
            handleHolidayDateChange(calendarInternalId, holidayInternalId, date)
          }
          initialFocus
        />
      </PopoverContent>
    </Popover>
  );

  const handleSave = () => {
    let hasErrors = false;
    const finalCalendars: HolidayCalendar[] = [];
    const calendarNames = new Set<string>();

    calendars.forEach((cal, calIndex) => {
      // Skip completely empty calendars silently
      if (
        !cal.name.trim() &&
        cal.holidays.every((h) => !h.name.trim() && !h.date.trim()) &&
        !cal.countryCode
      ) {
        return;
      }

      const calendarName = cal.name.trim();
      const countryCode = cal.countryCode?.trim() || undefined; // Save as undefined if empty

      if (!calendarName) {
        toast({
          variant: 'destructive',
          title: `Error in Calendar ${calIndex + 1}`,
          description: 'Calendar name is required.',
        });
        hasErrors = true;
        return;
      }
      if (calendarNames.has(calendarName.toLowerCase())) {
        toast({
          variant: 'destructive',
          title: `Error in Calendar ${calIndex + 1}`,
          description: `Duplicate calendar name "${calendarName}".`,
        });
        hasErrors = true;
        return;
      }
      calendarNames.add(calendarName.toLowerCase());

      const finalHolidays: PublicHoliday[] = [];
      const holidayNamesDates = new Set<string>(); // Check for duplicate name+date within the *same* calendar

      cal.holidays.forEach((hol, holIndex) => {
        // Skip completely empty holidays silently
        if (!hol.name.trim() && !hol.date.trim()) {
          return;
        }

        const holidayName = hol.name.trim();
        const holidayDate = hol.date.trim();

        let holidayErrors: string[] = [];
        // Only validate name/date if it's NOT country-based, OR if country-based and the data is missing (shouldn't happen)
        if (
          !cal.isCountryBased ||
          (cal.isCountryBased && (!holidayName || !holidayDate))
        ) {
          if (!holidayName) holidayErrors.push('Holiday name required');
          if (
            !holidayDate ||
            !/^\d{4}-\d{2}-\d{2}$/.test(holidayDate) ||
            !isValid(parseISO(holidayDate))
          ) {
            holidayErrors.push('Invalid Date (use YYYY-MM-DD)');
          }
        }

        const nameDateKey = `${holidayName.toLowerCase()}|${holidayDate}`;
        if (holidayName && holidayDate && holidayNamesDates.has(nameDateKey)) {
          holidayErrors.push(
            `Duplicate holiday "${holidayName}" on ${holidayDate}`
          );
        }

        if (holidayErrors.length > 0) {
          toast({
            variant: 'destructive',
            title: `Error in Holiday Row ${holIndex + 1} (Calendar: ${calendarName || `Calendar ${calIndex + 1}`})`,
            description: holidayErrors.join(', '),
          });
          hasErrors = true;
          return; // Stop processing this holiday row
        }

        if (holidayName && holidayDate) holidayNamesDates.add(nameDateKey);

        finalHolidays.push({
          id:
            hol.id ||
            `holiday_${cal.id || cal._internalId}_${Date.now()}_${holIndex}`, // Generate ID if new
          name: holidayName,
          date: holidayDate,
        });
      });

      // If it was country-based and now has no holidays (e.g., country removed or API failed), report error?
      if (cal.isCountryBased && finalHolidays.length === 0) {
        // This might happen if the API call failed initially or during save
        toast({
          variant: 'warning',
          title: `Warning for Calendar '${calendarName}'`,
          description:
            'Country-based calendar has no holidays. Ensure the country code is valid.',
        });
        // Optionally prevent saving this calendar or save it as custom?
        // For now, we save it as is (potentially empty)
      }

      // Sort holidays by date before saving
      finalHolidays.sort((a, b) => a.date.localeCompare(b.date));

      finalCalendars.push({
        id: cal.id || cal._internalId, // Preserve existing ID or use internal one
        name: calendarName,
        countryCode: countryCode,
        holidays: finalHolidays,
      });
    });

    if (hasErrors) {
      return;
    }

    // Sort calendars alphabetically by name before saving
    finalCalendars.sort((a, b) => a.name.localeCompare(b.name));

    onSaveCalendars(finalCalendars);
    setHasUnsavedChanges(false);
    // Update state to reflect sorted/cleaned data with potentially new IDs
    setCalendars(
      finalCalendars.map((cal, calIndex) => ({
        ...cal,
        _internalId: cal.id || `saved_cal_${calIndex}_${Date.now()}`,
        countryCode: cal.countryCode || '', // Ensure string for state
        isCountryBased: !!cal.countryCode, // Recalculate flag based on saved data
        isLoading: false, // Ensure loading is off
        holidays: cal.holidays.map((hol, holIndex) => ({
          ...hol,
          _internalId:
            hol.id || `saved_hol_${cal.id}_${holIndex}_${Date.now()}`,
          dateObj: parseDateString(hol.date),
        })),
      }))
    );
    if (finalCalendars.length === 0) {
      setCalendars([createEmptyCalendar()]); // Ensure one empty calendar if all were deleted/empty
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <CalendarDays className="h-5 w-5 text-primary" /> Holiday
              Calendars: {projectName}
            </CardTitle>
            <CardDescription>
              Manage public holiday calendars. Select a country to auto-populate
              standard holidays for the current year, or choose 'None' for a
              custom calendar.
            </CardDescription>
          </div>
          <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
            <Save className="mr-2 h-4 w-4" /> Save Calendars
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <Accordion
          type="multiple"
          className="w-full space-y-4"
          defaultValue={calendars.map((c) => c._internalId)}
        >
          {calendars.map((calendar) => (
            <AccordionItem
              value={calendar._internalId}
              key={calendar._internalId}
              className="overflow-hidden rounded-lg border bg-card"
            >
              {/* Moved Input and Select outside of AccordionTrigger */}
              <div className="flex items-center justify-between border-b px-4 py-2">
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <Input
                    value={calendar.name}
                    onChange={(e) =>
                      handleCalendarInputChange(
                        calendar._internalId,
                        'name',
                        e.target.value
                      )
                    }
                    placeholder="Calendar Name (e.g., US Holidays)"
                    className="mr-2 h-8 flex-1 border-0 text-base font-medium shadow-none focus:bg-muted/50 focus-visible:ring-0"
                  />
                  <Select
                    value={calendar.countryCode || 'none'}
                    onValueChange={(value) =>
                      handleCountryChange(calendar._internalId, value)
                    }
                    disabled={calendar.isLoading}
                  >
                    <SelectTrigger className="h-8 w-48 border-0 text-sm shadow-none focus:bg-muted/50 focus-visible:ring-0">
                      <Globe className="mr-2 h-4 w-4 text-muted-foreground" />
                      <SelectValue placeholder="Select Country" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectGroup>
                        <SelectLabel>Country (Optional)</SelectLabel>
                        <SelectItem
                          value="none"
                          className="text-muted-foreground"
                        >
                          -- None (Custom) --
                        </SelectItem>
                        {countryOptions.map((country) => (
                          <SelectItem key={country.code} value={country.code}>
                            {country.name} ({country.code})
                          </SelectItem>
                        ))}
                      </SelectGroup>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <AccordionTrigger
                    className="p-2"
                    aria-label={`Toggle ${calendar.name}`}
                  >
                    {/* Icon moved inside trigger, or remove chevron if header click isn't needed */}
                  </AccordionTrigger>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveCalendar(calendar._internalId)}
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    aria-label="Remove calendar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <AccordionContent className="px-4 pb-2 pt-4">
                {/* Display Info message if country-based */}
                {calendar.isLoading ? (
                  <div className="mb-4 flex items-center gap-2 rounded-md border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-700">
                    <Info className="h-4 w-4 animate-spin" />{' '}
                    {/* Add spinner for loading state */}
                    Fetching holidays for{' '}
                    {
                      countryOptions.find(
                        (c) => c.code === calendar.countryCode
                      )?.name
                    }
                    ...
                  </div>
                ) : calendar.isCountryBased ? (
                  <div className="mb-4 flex items-center gap-2 rounded-md border border-blue-200 bg-blue-50 p-3 text-sm text-blue-700">
                    <Info className="h-4 w-4" />
                    Holidays for {currentYear} automatically populated based on{' '}
                    {
                      countryOptions.find(
                        (c) => c.code === calendar.countryCode
                      )?.name
                    }
                    . Manual editing is disabled.
                  </div>
                ) : null}

                <div className="space-y-4">
                  {/* Holiday Header */}
                  <div className="hidden grid-cols-[1fr_160px_40px] items-center gap-x-3 border-b pb-2 md:grid">
                    <Label className="text-xs font-medium text-muted-foreground">
                      Holiday Name*
                    </Label>
                    <Label className="text-xs font-medium text-muted-foreground">
                      Date*
                    </Label>
                    <div /> {/* Placeholder for delete */}
                  </div>
                  {/* Holiday Rows */}
                  <div className="max-h-60 space-y-4 overflow-y-auto md:space-y-2">
                    {' '}
                    {/* Scrollable area for holidays */}
                    {calendar.holidays.length === 0 && !calendar.isLoading ? (
                      <p className="py-4 text-center text-sm italic text-muted-foreground">
                        {calendar.isCountryBased
                          ? `No holidays found for ${countryOptions.find((c) => c.code === calendar.countryCode)?.name} in ${currentYear}.`
                          : 'No custom holidays added yet.'}
                      </p>
                    ) : (
                      calendar.holidays.map((holiday) => (
                        <div
                          key={holiday._internalId}
                          className="grid grid-cols-2 items-start gap-x-3 gap-y-2 md:grid-cols-[1fr_160px_40px]"
                        >
                          {/* Holiday Name */}
                          <div className="col-span-2 md:col-span-1">
                            <Label
                              htmlFor={`holiday-name-${holiday._internalId}`}
                              className="text-xs font-medium md:hidden"
                            >
                              Holiday Name*
                            </Label>
                            <Input
                              id={`holiday-name-${holiday._internalId}`}
                              value={holiday.name}
                              onChange={(e) =>
                                handleHolidayInputChange(
                                  calendar._internalId,
                                  holiday._internalId,
                                  'name',
                                  e.target.value
                                )
                              }
                              placeholder="Holiday Name"
                              className="h-9"
                              disabled={
                                calendar.isCountryBased || calendar.isLoading
                              } // Disable if country-based or loading
                            />
                          </div>
                          {/* Holiday Date */}
                          <div className="col-span-1 md:col-span-1">
                            <Label
                              htmlFor={`holiday-date-${holiday._internalId}`}
                              className="text-xs font-medium md:hidden"
                            >
                              Date*
                            </Label>
                            {renderDatePicker(
                              calendar._internalId,
                              holiday._internalId,
                              holiday.dateObj,
                              calendar.isCountryBased || calendar.isLoading
                            )}
                          </div>
                          {/* Delete Holiday Button */}
                          <div className="col-span-2 mt-1 flex items-center justify-end md:col-span-1 md:mt-0 md:self-center">
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              onClick={() =>
                                handleRemoveHoliday(
                                  calendar._internalId,
                                  holiday._internalId
                                )
                              }
                              className="h-9 w-9 text-muted-foreground hover:text-destructive"
                              aria-label="Remove holiday row"
                              disabled={
                                calendar.isCountryBased || calendar.isLoading
                              } // Disable if country-based or loading
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                  {/* Only show Add Holiday button for custom calendars */}
                  {!calendar.isCountryBased && !calendar.isLoading && (
                    <Button
                      type="button"
                      onClick={() => handleAddHoliday(calendar._internalId)}
                      variant="outline"
                      size="sm"
                      className="mt-4"
                    >
                      <PlusCircle className="mr-2 h-4 w-4" />
                      Add Custom Holiday
                    </Button>
                  )}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
        <Button
          type="button"
          onClick={handleAddCalendar}
          variant="outline"
          size="sm"
          className="mt-4"
        >
          <PlusCircle className="mr-2 h-4 w-4" />
          Add New Calendar
        </Button>
      </CardContent>
      <CardFooter className="flex items-center justify-between border-t pt-4">
        <p className="text-xs text-muted-foreground">* Required field.</p>
        <Button onClick={handleSave} disabled={!hasUnsavedChanges}>
          <Save className="mr-2 h-4 w-4" /> Save Calendars
        </Button>
      </CardFooter>
    </Card>
  );
}
