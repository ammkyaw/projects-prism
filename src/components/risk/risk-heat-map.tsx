// src/components/risk/risk-heat-map.tsx
'use client';

import type { RiskItem, RiskLikelihood, RiskImpact } from '@/types/sprint-data';
import { riskLikelihoods, riskImpacts } from '@/types/sprint-data';
import { cn } from '@/lib/utils';

interface RiskHeatMapProps {
  risks: RiskItem[];
}

const likelihoodOrder: RiskLikelihood[] = [...riskLikelihoods].reverse(); // "Almost Certain" at the top
const impactOrder: RiskImpact[] = [...riskImpacts]; // "Insignificant" on the left

// Define colors for each cell based on Likelihood and Impact (Tailwind CSS classes)
const getCellColor = (
  likelihood: RiskLikelihood,
  impact: RiskImpact
): string => {
  // This is a simplified mapping based on the provided image.
  // You can make this more granular.
  // Darker colors for higher risk.
  if (likelihood === 'Almost Certain') {
    if (impact === 'Catastrophic') return 'bg-red-600 text-white'; // Bright Red
    if (impact === 'Major') return 'bg-red-700 text-white'; // Dark Red
    if (impact === 'Moderate') return 'bg-orange-500 text-white';
    if (impact === 'Minor') return 'bg-orange-400 text-black';
    return 'bg-yellow-400 text-black'; // Insignificant
  }
  if (likelihood === 'Likely') {
    if (impact === 'Catastrophic') return 'bg-red-700 text-white';
    if (impact === 'Major') return 'bg-red-700 text-white';
    if (impact === 'Moderate') return 'bg-orange-500 text-white';
    if (impact === 'Minor') return 'bg-yellow-400 text-black';
    return 'bg-yellow-400 text-black'; // Insignificant
  }
  if (likelihood === 'Possible') {
    if (impact === 'Catastrophic') return 'bg-orange-500 text-white';
    if (impact === 'Major') return 'bg-orange-400 text-black';
    if (impact === 'Moderate') return 'bg-yellow-400 text-black';
    if (impact === 'Minor') return 'bg-yellow-400 text-black';
    return 'bg-green-700 text-white'; // Insignificant
  }
  if (likelihood === 'Unlikely') {
    if (impact === 'Catastrophic') return 'bg-orange-400 text-black';
    if (impact === 'Major') return 'bg-yellow-400 text-black';
    if (impact === 'Moderate') return 'bg-yellow-400 text-black';
    if (impact === 'Minor') return 'bg-green-700 text-white';
    return 'bg-green-700 text-white'; // Insignificant
  }
  if (likelihood === 'Rare') {
    if (impact === 'Catastrophic') return 'bg-yellow-400 text-black';
    if (impact === 'Major') return 'bg-yellow-400 text-black';
    if (impact === 'Moderate') return 'bg-green-700 text-white';
    if (impact === 'Minor') return 'bg-green-700 text-white';
    return 'bg-lime-500 text-black'; // Insignificant
  }
  return 'bg-gray-200 text-gray-800'; // Default
};

export default function RiskHeatMap({ risks }: RiskHeatMapProps) {
  const heatMapData: { [L in RiskLikelihood]?: { [I in RiskImpact]?: number } } =
    {};

  // Initialize heatmap data with 0 counts
  likelihoodOrder.forEach((l) => {
    heatMapData[l] = {};
    impactOrder.forEach((i) => {
      heatMapData[l]![i] = 0;
    });
  });

  // Populate heatmap data
  risks.forEach((risk) => {
    if (
      heatMapData[risk.likelihood] &&
      heatMapData[risk.likelihood]![risk.impact] !== undefined
    ) {
      (heatMapData[risk.likelihood]![risk.impact] as number)++;
    }
  });

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full border-collapse border border-border">
        <thead>
          <tr>
            <th className="border border-border p-2 text-xs font-medium text-muted-foreground">
              Likelihood ↓ | Impact →
            </th>
            {impactOrder.map((impact) => (
              <th
                key={impact}
                className="border border-border p-2 text-xs font-medium text-muted-foreground"
              >
                {impact}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {likelihoodOrder.map((likelihood) => (
            <tr key={likelihood}>
              <td className="border border-border p-2 text-xs font-medium text-muted-foreground text-right">
                {likelihood}
              </td>
              {impactOrder.map((impact) => {
                const count = heatMapData[likelihood]?.[impact] || 0;
                return (
                  <td
                    key={`${likelihood}-${impact}`}
                    className={cn(
                      'border border-border p-2 text-center h-16 w-24', // Added fixed height/width
                      getCellColor(likelihood, impact)
                    )}
                    title={`${count} risk(s) with ${likelihood} likelihood and ${impact} impact`}
                  >
                    <span className="text-lg font-semibold">{count}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
