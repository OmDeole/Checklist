export type ShiftName = 'Shift 1 (06:00 - 14:00)' | 'Shift 2 (14:00 - 22:00)' | 'Shift 3 (22:00 - 06:00)';

export interface LocationCoords {
  latitude: number;
  longitude: number;
  accuracy: number;
  address?: string;
  isWithinGeofence: boolean;
}

export interface PhotoEvidence {
  id: string;
  checkpointId: string;
  dataUrl: string; // Base64 canvas capture
  timestamp: string;
  location: LocationCoords;
  operatorId: string;
  stationId: string;
  type?: 'single' | 'before' | 'after';
}

export interface MachineCheckpoint {
  id: string;
  sn: number;
  checkPoint: string;
  model: string;
  standard: string;
  freq: string;
  photoRequired: boolean;
  status: 'OK' | 'NOT_OK' | 'PENDING';
  photos: PhotoEvidence[];
  checkedAt?: string;
  notes?: string;
}

export interface PokayokeCheckpoint {
  id: string;
  sn: string; // 'A', 'B', 'C', 'D', 'E'
  pokayoke: string;
  model: string;
  verifyMethod: string;
  freq: string;
  photoRequirementLabel: string; // e.g. "Before and after photo", "Yes", "Manual"
  requiredPhotoCount: number; // 2 for A, 1 for B, C, D, E
  status: 'OK' | 'NOT_OK' | 'PENDING';
  photos: PhotoEvidence[];
  checkedAt?: string;
  notes?: string;
}

export interface DeviationLog {
  id: string;
  sn: number;
  date: string;
  timestamp: string;
  minifactoryId: string;
  lineId: string;
  stationId: string;
  location: string;
  problemDescription: string;
  owner: string;
  countermeasure: string;
  targetDate: string;
  status: 'Open' | 'In Progress' | 'Resolved';
  checkpointName?: string;
  photoEvidenceUrl?: string;
}

export interface Station {
  id: string;
  number: string; // e.g. "130"
  name: string; // e.g. "Pump Assembly & Pokayoke Verification"
  minifactoryId: string; // 'MF1', 'MF2', 'MF3'
  lineId: string; // e.g. 'MF2-LINE2'
  lineName: string; // e.g. 'Pump Assembly Line - 2'
  operatorName?: string;
  operatorId?: string;
  status: 'COMPLETED' | 'IN_PROGRESS' | 'PENDING' | 'DEVIATION_STOPPED';
  lastSubmittedAt?: string;
  shift: ShiftName;
  completionPercentage: number;
  machineCheckpoints: MachineCheckpoint[];
  pokayokeCheckpoints: PokayokeCheckpoint[];
  deviations: DeviationLog[];
  isFlaggedForFalsification?: boolean;
  falsificationReason?: string;
}

export interface Line {
  id: string;
  minifactoryId: string;
  name: string; // e.g. 'Pump Assembly Line - 2'
  stations: Station[];
}

export interface Minifactory {
  id: string; // 'MF1', 'MF2', 'MF3'
  name: string; // e.g. 'MF2 - Pump Assembly Minifactory'
  lines: Line[];
}

export interface ChecklistSubmission {
  id: string;
  minifactoryId: string;
  lineId: string;
  stationId: string;
  stationNumber: string;
  lineName: string;
  operatorName: string;
  operatorId: string;
  shift: ShiftName;
  submittedAt: string;
  completedAt: string;
  timeTakenSeconds: number;
  location: LocationCoords;
  machineCheckpoints: MachineCheckpoint[];
  pokayokeCheckpoints: PokayokeCheckpoint[];
  deviations: DeviationLog[];
  overallStatus: 'OK' | 'DEVIATION';
  verificationHash: string;
  isAuthentic: boolean;
}
