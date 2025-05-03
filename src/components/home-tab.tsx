
import type { SprintData } from '@/types/sprint-data';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
// Removed unused Info icon import

interface HomeTabProps {
  sprintData: SprintData | null;
}

export default function HomeTab({ sprintData }: HomeTabProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Welcome to Sprint Stats!</CardTitle>
        <CardDescription>
          This tool helps you visualize your team's agile sprint performance.
          Use the 'Entry' tab to input your data manually or by pasting from a spreadsheet.
          View the generated charts and reports in the 'Reports' tab.
          This Home tab provides a summary of the loaded sprint data.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {sprintData && sprintData.sprints && sprintData.sprints.length > 0 ? ( // Check sprints array explicitly
          <>
            <h3 className="text-lg font-semibold mb-4">Sprint Summary</h3>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[100px]">Sprint #</TableHead>
                    <TableHead>Start Date</TableHead>
                    <TableHead>End Date</TableHead>
                    {/* Removed Duration from Home Tab for brevity */}
                    <TableHead className="text-right">Commitment</TableHead>
                    <TableHead className="text-right">Delivered</TableHead>
                     {/* Optionally add a 'Details' column if needed */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sprintData.sprints.map((sprint) => (
                    <TableRow key={sprint.sprintNumber}>
                      <TableCell className="font-medium">{sprint.sprintNumber}</TableCell>
                      <TableCell>{sprint.startDate || 'N/A'}</TableCell>
                      <TableCell>{sprint.endDate || 'N/A'}</TableCell>
                      <TableCell className="text-right">{sprint.committedPoints}</TableCell>
                      <TableCell className="text-right">{sprint.completedPoints}</TableCell>
                      {/* <TableCell>{sprint.details || '-'}</TableCell> */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center text-muted-foreground p-8 border border-dashed rounded-md">
            {/* Re-add Info icon if desired */}
            {/* <Info className="mr-2 h-5 w-5" /> */}
            No sprint data loaded. Go to the 'Entry' tab to add data.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
