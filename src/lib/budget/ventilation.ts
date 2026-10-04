import { z } from 'zod';

// 1. Définition des types basés sur notre schéma SQL
export type SourcingType = 'network' | 'celeste_search' | 'undecided';

export interface BudgetItem {
  id: string;
  name: string;
  isEnabled: boolean;
  sourcingType: SourcingType;
  defaultWeight: number; // Poids d'importance relative
}

// 2. Référentiel des poids relatifs du marché (La somme n'a pas besoin d'être 100)
// Ces poids permettent à l'IA de recalculer la part de chacun selon ce qui est activé.
export const VENDOR_DICTIONARY: Omit<BudgetItem, 'id' | 'isEnabled' | 'sourcingType'>[] = [
  { name: "Lieu de réception", defaultWeight: 35 },
  { name: "Traiteur", defaultWeight: 30 },
  { name: "Voyage de noces", defaultWeight: 15 },
  { name: "Tenues des mariées / mariés", defaultWeight: 10 },
  { name: "Photographe", defaultWeight: 8 },
  { name: "Vidéaste", defaultWeight: 7 },
  { name: "Fleuriste", defaultWeight: 6 },
  { name: "DJ", defaultWeight: 5 },
  { name: "Location matériel de fête", defaultWeight: 4 },
  { name: "Alliances", defaultWeight: 3 },
  { name: "Pièce montée", defaultWeight: 3 },
  { name: "Accessoires papeterie", defaultWeight: 2 },
  { name: "Location de voiture", defaultWeight: 2 },
  { name: "Officiant(e)", defaultWeight: 2 },
  { name: "Coiffeur", defaultWeight: 2 },
  { name: "Maquilleuse", defaultWeight: 2 },
  { name: "Soins esthétiques", defaultWeight: 1 },
  { name: "Outils tech", defaultWeight: 1 },
];

export interface VentilationResult {
  contingencyReserve: number;
  allocations: { id: string; name: string; allocatedAmount: number }[];
  totalAllocated: number;
}

/**
 * Moteur de ventilation intelligente du budget
 * @param totalBudget Le budget global défini par le couple (en euros)
 * @param items La liste des prestataires avec leur statut (coché/décoché)
 * @param contingencyPercent Le pourcentage verrouillé pour les imprévus (défaut 12%)
 */
export function calculateBudgetVentilation(
  totalBudget: number,
  items: BudgetItem[],
  contingencyPercent: number = 0.12
): VentilationResult {
  
  // 1. Verrouillage du bouclier d'imprévus
  const contingencyReserve = Math.round(totalBudget * contingencyPercent);
  const distributableBudget = totalBudget - contingencyReserve;

  // 2. Filtrer uniquement les prestataires activés par le couple
  const activeItems = items.filter(item => item.isEnabled);

  // 3. Calculer la somme des poids actifs
  const totalActiveWeight = activeItems.reduce((sum, item) => sum + item.defaultWeight, 0);

  // Sécurité : si tout est décoché, tout part dans les imprévus/réserve
  if (totalActiveWeight === 0) {
    return {
      contingencyReserve: totalBudget,
      allocations: [],
      totalAllocated: 0
    };
  }

  // 4. Ventiler proportionnellement le budget disponible
  let totalAllocated = 0;
  const allocations = activeItems.map(item => {
    const rawAmount = distributableBudget * (item.defaultWeight / totalActiveWeight);
    // Arrondi à la dizaine la plus proche pour éviter les montants bizarres (ex: 453,27 € -> 450 €)
    const roundedAmount = Math.round(rawAmount / 10) * 10; 
    
    totalAllocated += roundedAmount;
    
    return {
      id: item.id,
      name: item.name,
      allocatedAmount: roundedAmount
    };
  });

  // 5. Ajustement du dernier centime/dizaine lié aux arrondis
  const difference = distributableBudget - totalAllocated;
  if (difference !== 0 && allocations.length > 0) {
    // On ajoute la différence au poste ayant le poids le plus fort (généralement le lieu ou traiteur)
    const highestWeightItem = allocations.reduce((prev, current) => {
      const prevItem = items.find(i => i.id === prev.id);
      const currentItem = items.find(i => i.id === current.id);
      return (currentItem?.defaultWeight || 0) > (prevItem?.defaultWeight || 0) ? current : prev;
    });
    
    highestWeightItem.allocatedAmount += difference;
  }

  return {
    contingencyReserve,
    allocations,
    totalAllocated: distributableBudget
  };
}