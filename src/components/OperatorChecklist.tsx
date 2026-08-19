import React, { useState, useEffect } from 'react';
import {
  Minifactory,
  Station,
  MachineCheckpoint,
  PokayokeCheckpoint,
  PhotoEvidence,
  DeviationLog,
  LocationCoords,
} from '../types';
import { CameraModal } from './CameraModal';
import { DeviationModal } from './DeviationModal';
import { requestCurrentLocation, getCurrentShift, formatTimestamp } from '../utils/geolocation';
import {
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Camera,
  AlertTriangle,
  Send,
  RotateCcw,
  Smartphone,
  List,
  ChevronLeft,
  ChevronRight,
  User,
  SlidersHorizontal,
  Clock,
  Sparkles,
  AlertCircle,
  Lock,
} from 'lucide-react';

interface OperatorChecklistProps {
  minifactories: Minifactory[];
  selectedMinifactoryId: string;
  onMinifactoryChange: (id: string) => void;
  onSubmitSuccess: (updatedStation: Station, submissionHash: string) => void;
}

// Simple shuffle utility
function shuffleArray<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const OperatorChecklist: React.FC<OperatorChecklistProps> = ({
  minifactories,
  selectedMinifactoryId,
  onMinifactoryChange,
  onSubmitSuccess,
}) => {
  const currentMf =
    minifactories.find((m) => m.id === selectedMinifactoryId) || minifactories[1] || minifactories[0];
  const lines = currentMf?.lines || [];

  const [selectedLineId, setSelectedLineId] = useState<string>(lines[0]?.id || 'MF2-LINE2');
  const currentLine = lines.find((l) => l.id === selectedLineId) || lines[0] || { id: '', name: '', stations: [] };
  const stations = currentLine?.stations || [];

  const [selectedStationId, setSelectedStationId] = useState<string>(
    stations.find((s) => s.number === '130')?.id || stations[0]?.id || 'st-130'
  );
  const activeStation = stations.find((s) => s.id === selectedStationId) || stations[0] || {
    id: 'st-130',
    number: '130',
    name: 'Main Station',
    machineCheckpoints: [],
    pokayokeCheckpoints: [],
  };

  // Operator Info
  const [operatorName, setOperatorName] = useState<string>(activeStation?.operatorName || 'Prakash Rao');
  const [operatorId, setOperatorId] = useState<string>(activeStation?.operatorId || 'OP-9041');

  // Checkpoints State (Clean initial states)
  const [machineCheckpoints, setMachineCheckpoints] = useState<MachineCheckpoint[]>(() =>
    (activeStation?.machineCheckpoints || []).map((m) => ({
      ...m,
      status: 'PENDING' as const,
      photos: [],
      checkedAt: undefined,
    }))
  );

  const [pokayokeCheckpoints, setPokayokeCheckpoints] = useState<PokayokeCheckpoint[]>(() =>
    (activeStation?.pokayokeCheckpoints || []).map((p) => ({
      ...p,
      status: 'PENDING' as const,
      photos: [],
      checkedAt: undefined,
    }))
  );

  const [deviations, setDeviations] = useState<DeviationLog[]>([]);

  // Setup / Station Switch Modal State (Closed by default for direct lean experience)
  const [showSetupModal, setShowSetupModal] = useState<boolean>(false);

  // Form Fields inside Setup Modal
  const [modalMfId, setModalMfId] = useState<string>(selectedMinifactoryId);
  const [modalLineId, setModalLineId] = useState<string>(selectedLineId);
  const [modalStationId, setModalStationId] = useState<string>(selectedStationId);
  const [modalOperatorId, setModalOperatorId] = useState<string>(operatorId);
  const [modalOperatorName, setModalOperatorName] = useState<string>(operatorName);
  const [modalShift, setModalShift] = useState<string>(getCurrentShift());
  const [modalError, setModalError] = useState<string | null>(null);

  // Randomized Order Keys for Checkpoints
  const [shuffledStepKeys, setShuffledStepKeys] = useState<string[]>([]);

  // View Mode: 'mobile_step' (Single Card - Default), 'guided_list' (Lean List), 'table' (Table)
  const [viewMode, setViewMode] = useState<'mobile_step' | 'guided_list' | 'table'>('mobile_step');
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);

  // Location
  const [location, setLocation] = useState<LocationCoords>({
    latitude: 18.52043,
    longitude: 73.85674,
    accuracy: 5,
    address: 'Shopfloor Inspection Zone',
    isWithinGeofence: true,
  });

  // Camera Modal State
  const [activeCameraTarget, setActiveCameraTarget] = useState<{
    checkpointId: string;
    isPokayoke: boolean;
    photoTypeLabel?: string;
    title: string;
  } | null>(null);

  // Deviation Modal State
  const [activeDeviationTarget, setActiveDeviationTarget] = useState<{
    checkpointName: string;
  } | null>(null);

  const [startTime] = useState<number>(Date.now());
  const [submitError, setSubmitError] = useState<string | null>(null);

  // Sync station changes with clean pending inputs
  useEffect(() => {
    if (activeStation) {
      const cleanMachine = (activeStation.machineCheckpoints || []).map((m) => ({
        ...m,
        status: 'PENDING' as const,
        photos: [],
        checkedAt: undefined,
      }));
      const cleanPokayoke = (activeStation.pokayokeCheckpoints || []).map((p) => ({
        ...p,
        status: 'PENDING' as const,
        photos: [],
        checkedAt: undefined,
      }));

      setMachineCheckpoints(cleanMachine);
      setPokayokeCheckpoints(cleanPokayoke);
      setDeviations([]);
      if (activeStation.operatorName) setOperatorName(activeStation.operatorName);
      if (activeStation.operatorId) setOperatorId(activeStation.operatorId);
      setActiveStepIndex(0);

      const mKeys = cleanMachine.map((m) => `machine:${m.id}`);
      const pKeys = cleanPokayoke.map((p) => `pokayoke:${p.id}`);
      setShuffledStepKeys(shuffleArray([...mKeys, ...pKeys]));
    }
  }, [selectedStationId]);

  useEffect(() => {
    requestCurrentLocation().then(setLocation);
  }, []);

  // Wipe clean all entered statuses, photos, and deviations for this station
  const handleClearAllInputs = () => {
    setMachineCheckpoints((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'PENDING',
        photos: [],
        checkedAt: undefined,
      }))
    );
    setPokayokeCheckpoints((prev) =>
      prev.map((item) => ({
        ...item,
        status: 'PENDING',
        photos: [],
        checkedAt: undefined,
      }))
    );
    setDeviations([]);
    setActiveStepIndex(0);
    setSubmitError(null);
  };

  // Open setup modal
  const handleOpenSetupModal = () => {
    setModalMfId(selectedMinifactoryId);
    setModalLineId(selectedLineId);
    setModalStationId(selectedStationId);
    setModalOperatorId(operatorId);
    setModalOperatorName(operatorName);
    setModalShift(getCurrentShift());
    setModalError(null);
    setShowSetupModal(true);
  };

  // Save station/operator changes from modal
  const handleSaveSetupModal = () => {
    if (!modalOperatorId.trim() || !modalOperatorName.trim()) {
      setModalError('Please provide both Operator ID and Name.');
      return;
    }
    onMinifactoryChange(modalMfId);
    setSelectedLineId(modalLineId);
    setSelectedStationId(modalStationId);
    setOperatorId(modalOperatorId.trim());
    setOperatorName(modalOperatorName.trim());
    handleClearAllInputs();
    setShowSetupModal(false);
  };

  // Check if checkpoint is completed (status set AND required photos taken)
  const isStepCompleted = (step?: {
    status: 'PENDING' | 'OK' | 'NOT_OK';
    photoRequired?: boolean;
    requiredPhotoCount?: number;
    photos: PhotoEvidence[];
  }) => {
    if (!step || step.status === 'PENDING') return false;
    const reqCount = step.requiredPhotoCount ?? (step.photoRequired ? 1 : 0);
    if (reqCount > 0 && step.photos.length < reqCount) return false;
    return true;
  };

  // Auto-advance step
  const advanceToNextRandomStep = (currentIdx: number, stepsList = allSteps) => {
    const pendingIndices: number[] = [];
    stepsList.forEach((step, idx) => {
      if (!isStepCompleted(step)) {
        pendingIndices.push(idx);
      }
    });

    if (pendingIndices.length === 0) {
      setActiveStepIndex(stepsList.length);
    } else {
      const remainingOthers = pendingIndices.filter((idx) => idx !== currentIdx);
      const pool = remainingOthers.length > 0 ? remainingOthers : pendingIndices;
      const nextRandomIdx = pool[Math.floor(Math.random() * pool.length)];
      setActiveStepIndex(nextRandomIdx);
    }
  };

  // Status handlers
  const handleMachineStatusChange = (id: string, status: 'OK' | 'NOT_OK', autoAdvance: boolean = true) => {
    const cp = machineCheckpoints.find((c) => c.id === id);
    if (!cp) return;

    if (status === 'NOT_OK') {
      setActiveDeviationTarget({ checkpointName: cp.checkPoint });
    }

    const updated = machineCheckpoints.map((item) =>
      item.id === id
        ? {
            ...item,
            status,
            checkedAt: formatTimestamp(new Date()),
          }
        : item
    );

    setMachineCheckpoints(updated);

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(30);
      }
    } catch (e) {
      // ignore
    }

    const updatedCp = updated.find((c) => c.id === id);
    if (updatedCp) {
      const isComplete = isStepCompleted({
        status: updatedCp.status,
        photoRequired: updatedCp.photoRequired,
        photos: updatedCp.photos,
      });

      if (autoAdvance && isComplete && viewMode === 'mobile_step') {
        setTimeout(() => {
          advanceToNextRandomStep(activeStepIndex);
        }, 180);
      }
    }
  };

  const handlePokayokeStatusChange = (id: string, status: 'OK' | 'NOT_OK', autoAdvance: boolean = true) => {
    const cp = pokayokeCheckpoints.find((c) => c.id === id);
    if (!cp) return;

    if (status === 'NOT_OK') {
      setActiveDeviationTarget({ checkpointName: `Pokayoke ${cp.sn}: ${cp.pokayoke}` });
    }

    const updated = pokayokeCheckpoints.map((item) =>
      item.id === id
        ? {
            ...item,
            status,
            checkedAt: formatTimestamp(new Date()),
          }
        : item
    );

    setPokayokeCheckpoints(updated);

    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        navigator.vibrate(30);
      }
    } catch (e) {
      // ignore
    }

    const updatedCp = updated.find((c) => c.id === id);
    if (updatedCp) {
      const isComplete = isStepCompleted({
        status: updatedCp.status,
        requiredPhotoCount: updatedCp.requiredPhotoCount,
        photos: updatedCp.photos,
      });

      if (autoAdvance && isComplete && viewMode === 'mobile_step') {
        setTimeout(() => {
          advanceToNextRandomStep(activeStepIndex);
        }, 180);
      }
    }
  };

  const handleOpenCamera = (checkpointId: string, isPokayoke: boolean, photoTypeLabel?: string, title?: string) => {
    setActiveCameraTarget({
      checkpointId,
      isPokayoke,
      photoTypeLabel,
      title: title || 'Checkpoint Photo',
    });
  };

  const handlePhotoCaptured = (dataUrl: string, timestamp: string, photoLocation: LocationCoords) => {
    if (!activeCameraTarget) return;

    const newPhoto: PhotoEvidence = {
      id: `photo-${Date.now()}`,
      checkpointId: activeCameraTarget.checkpointId,
      dataUrl,
      timestamp,
      location: photoLocation,
      operatorId,
      stationId: activeStation.number,
    };

    if (activeCameraTarget.isPokayoke) {
      setPokayokeCheckpoints((prev) =>
        prev.map((item) => {
          if (item.id === activeCameraTarget.checkpointId) {
            const updatedPhotos = [...item.photos, newPhoto];
            const updatedStatus = item.status === 'PENDING' ? 'OK' : item.status;
            const updatedItem = {
              ...item,
              photos: updatedPhotos,
              status: updatedStatus,
              checkedAt: formatTimestamp(new Date()),
            };

            if (viewMode === 'mobile_step' && isStepCompleted(updatedItem)) {
              setTimeout(() => {
                advanceToNextRandomStep(activeStepIndex);
              }, 200);
            }

            return updatedItem;
          }
          return item;
        })
      );
    } else {
      setMachineCheckpoints((prev) =>
        prev.map((item) => {
          if (item.id === activeCameraTarget.checkpointId) {
            const updatedPhotos = [...item.photos, newPhoto];
            const updatedStatus = item.status === 'PENDING' ? 'OK' : item.status;
            const updatedItem = {
              ...item,
              photos: updatedPhotos,
              status: updatedStatus,
              checkedAt: formatTimestamp(new Date()),
            };

            if (viewMode === 'mobile_step' && isStepCompleted(updatedItem)) {
              setTimeout(() => {
                advanceToNextRandomStep(activeStepIndex);
              }, 200);
            }

            return updatedItem;
          }
          return item;
        })
      );
    }
  };

  const handleSaveDeviation = (newDev: DeviationLog) => {
    setDeviations((prev) => [newDev, ...prev]);
  };

  const handleSubmitChecklist = () => {
    setSubmitError(null);

    const pendingMachine = machineCheckpoints.filter((c) => c.status === 'PENDING');
    if (pendingMachine.length > 0) {
      setSubmitError(`Please complete all machine checkpoints (${pendingMachine.length} pending).`);
      return;
    }

    const pendingPokayoke = pokayokeCheckpoints.filter((c) => c.status === 'PENDING');
    if (pendingPokayoke.length > 0) {
      setSubmitError(`Please complete all Pokayoke checkpoints (${pendingPokayoke.length} pending).`);
      return;
    }

    const missingPhotosMachine = machineCheckpoints.filter((c) => c.photoRequired && c.photos.length === 0);
    const missingPhotosPokayoke = pokayokeCheckpoints.filter((c) => c.photos.length < c.requiredPhotoCount);

    if (missingPhotosMachine.length > 0 || missingPhotosPokayoke.length > 0) {
      setSubmitError(`Please capture required live photos for the remaining items.`);
      return;
    }

    const hasAnyDeviations =
      machineCheckpoints.some((c) => c.status === 'NOT_OK') ||
      pokayokeCheckpoints.some((c) => c.status === 'NOT_OK');

    const updatedStation: Station = {
      ...activeStation,
      operatorName,
      operatorId,
      status: hasAnyDeviations ? 'DEVIATION_STOPPED' : 'COMPLETED',
      lastSubmittedAt: formatTimestamp(new Date()),
      shift: getCurrentShift(),
      completionPercentage: 100,
      machineCheckpoints,
      pokayokeCheckpoints,
      deviations,
    };

    const hash = `HASH-${Date.now().toString(36).toUpperCase()}`;
    onSubmitSuccess(updatedStation, hash);
  };

  // Build list of unified steps
  const rawStepMap = new Map<string, {
    kind: 'machine' | 'pokayoke';
    id: string;
    sn: string | number;
    title: string;
    subTitle: string;
    specLabel: string;
    specValue: string;
    freq: string;
    status: 'PENDING' | 'OK' | 'NOT_OK';
    photos: PhotoEvidence[];
    photoRequired: boolean;
    requiredPhotoCount: number;
    photoRequirementLabel?: string;
  }>();

  machineCheckpoints.forEach((m) => {
    rawStepMap.set(`machine:${m.id}`, {
      kind: 'machine',
      id: m.id,
      sn: m.sn,
      title: m.checkPoint,
      subTitle: `Model: ${m.model}`,
      specLabel: 'Machine Standard',
      specValue: m.standard,
      freq: m.freq,
      status: m.status,
      photos: m.photos,
      photoRequired: m.photoRequired,
      requiredPhotoCount: m.photoRequired ? 1 : 0,
      photoRequirementLabel: m.photoRequired ? 'Live Photo' : undefined,
    });
  });

  pokayokeCheckpoints.forEach((p) => {
    rawStepMap.set(`pokayoke:${p.id}`, {
      kind: 'pokayoke',
      id: p.id,
      sn: p.sn,
      title: p.pokayoke,
      subTitle: `Pokayoke Verification`,
      specLabel: 'Verify Method',
      specValue: p.verifyMethod,
      freq: p.freq,
      status: p.status,
      photos: p.photos,
      photoRequired: true,
      requiredPhotoCount: p.requiredPhotoCount,
      photoRequirementLabel: p.photoRequirementLabel,
    });
  });

  type StepItem = NonNullable<ReturnType<typeof rawStepMap.get>>;
  const allSteps: StepItem[] = [];

  shuffledStepKeys.forEach((key) => {
    const item = rawStepMap.get(key);
    if (item) allSteps.push(item);
  });

  rawStepMap.forEach((item, key) => {
    if (!shuffledStepKeys.includes(key)) {
      allSteps.push(item);
    }
  });

  const totalStepsCount = allSteps.length;
  const completedCount = allSteps.filter((s) => s.status !== 'PENDING').length;
  const passCount = allSteps.filter((s) => s.status === 'OK').length;
  const failCount = allSteps.filter((s) => s.status === 'NOT_OK').length;
  const currentStepItem = allSteps[activeStepIndex];
  const isSummaryStep = activeStepIndex >= totalStepsCount;

  return (
    <div className="max-w-4xl mx-auto px-3 sm:px-6 py-2 sm:py-4 space-y-4">
      {/* 1. LEAN TOOLBAR HEADER */}
      <div className="bg-white border border-slate-200/90 rounded-2xl px-4 py-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        {/* Left: Station info & Quick Switcher */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5">
            <span className="font-extrabold text-sm sm:text-base text-slate-900">
              Station {activeStation.number}
            </span>
            <span className="text-xs text-slate-400 font-medium hidden sm:inline">•</span>
            <span className="text-xs text-slate-600 font-medium hidden sm:inline">
              {currentLine.name}
            </span>
          </div>

          <button
            type="button"
            onClick={handleOpenSetupModal}
            className="p-1.5 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            title="Change Station or Operator"
          >
            <SlidersHorizontal className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Right: Reset + View Mode Tabs */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleClearAllInputs}
            className="px-2.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl border border-slate-200/80 transition-all flex items-center gap-1.5"
            title="Clean and reset all checklist inputs for this station"
          >
            <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
            <span className="hidden sm:inline">Clean Inputs</span>
          </button>

          {/* View Mode Toggle */}
          <div className="flex bg-slate-100 p-0.5 rounded-xl border border-slate-200">
            <button
              type="button"
              onClick={() => setViewMode('mobile_step')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'mobile_step'
                  ? 'bg-amber-500 text-slate-950 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Smartphone className="w-3.5 h-3.5" />
              <span>Card</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('guided_list')}
              className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 ${
                viewMode === 'guided_list'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="w-3.5 h-3.5" />
              <span>List</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN CHECKLIST VIEW (SINGLE CARD MODE - DEFAULT & LEAN FOCUS) */}
      {viewMode === 'mobile_step' && (
        <div className="bg-white border border-slate-200/90 rounded-3xl shadow-sm p-4 sm:p-7 space-y-5">
          {/* Progress Header */}
          <div className="space-y-2 border-b border-slate-100 pb-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <div className="flex items-center gap-2">
                <span className="bg-amber-500 text-slate-950 px-2.5 py-0.5 rounded-lg font-black text-xs">
                  {isSummaryStep ? 'SUMMARY' : `CHECKPOINT ${activeStepIndex + 1} OF ${totalStepsCount}`}
                </span>
                {!isSummaryStep && currentStepItem && (
                  <span className="text-[11px] font-semibold text-slate-500">
                    {currentStepItem.kind === 'machine' ? 'Machine Standard' : 'Pokayoke Sensor'}
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-xs text-slate-500">
                  {completedCount}/{totalStepsCount} done
                </span>
                {failCount > 0 && (
                  <span className="text-[11px] font-bold bg-rose-50 text-rose-700 px-2 py-0.5 rounded-md border border-rose-200">
                    {failCount} NOT OK
                  </span>
                )}
              </div>
            </div>

            {/* Smooth Slim Progress Bar */}
            <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden">
              <div
                className="bg-amber-500 h-full transition-all duration-300 rounded-full"
                style={{
                  width: `${isSummaryStep ? 100 : ((activeStepIndex + 1) / totalStepsCount) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* ACTIVE CHECKPOINT CONTENT */}
          {!isSummaryStep && currentStepItem ? (
            <div className="space-y-5 py-1">
              {/* Checkpoint Title */}
              <div>
                <h3 className="text-xl sm:text-2xl font-black text-slate-900 leading-tight">
                  {currentStepItem.title}
                </h3>
                <p className="text-xs text-slate-500 font-medium mt-1">
                  {currentStepItem.subTitle} • Frequency: {currentStepItem.freq}
                </p>
              </div>

              {/* Requirement / Specification Box */}
              <div className="bg-slate-50 border border-slate-200 rounded-2xl p-4 space-y-1">
                <div className="text-[10px] font-extrabold uppercase text-slate-500 tracking-wider">
                  {currentStepItem.specLabel}
                </div>
                <div className="font-mono font-bold text-slate-900 text-base sm:text-lg">
                  {currentStepItem.specValue}
                </div>
              </div>

              {/* Photo Evidence Bar (if required or attached) */}
              <div className="bg-slate-50 border border-slate-200/90 rounded-2xl p-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-2 overflow-x-auto">
                  {currentStepItem.photos.length > 0 ? (
                    currentStepItem.photos.map((ph, idx) => (
                      <div key={ph.id} className="relative group shrink-0">
                        <img
                          src={ph.dataUrl}
                          alt={`Evidence ${idx + 1}`}
                          className="w-12 h-12 object-cover rounded-xl border border-emerald-500 shadow-2xs"
                        />
                        <span className="absolute -top-1 -right-1 bg-emerald-600 text-white text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                          ✓
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-xs text-slate-500 font-medium flex items-center gap-1.5 pl-1">
                      <Camera className="w-4 h-4 text-amber-600" />
                      {currentStepItem.photoRequired ? 'Live camera photo required' : 'Optional photo evidence'}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={() =>
                    handleOpenCamera(
                      currentStepItem.id,
                      currentStepItem.kind === 'pokayoke',
                      currentStepItem.photoRequirementLabel,
                      currentStepItem.title
                    )
                  }
                  className="px-3 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold rounded-xl text-xs flex items-center gap-1.5 shrink-0 shadow-2xs transition-all active:scale-95"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>{currentStepItem.photos.length > 0 ? '+ Add Photo' : 'Snap Photo'}</span>
                </button>
              </div>

              {/* TACTILE PASS / NOT OK DECISION BUTTONS */}
              <div className="grid grid-cols-2 gap-3 pt-2">
                <button
                  type="button"
                  onClick={() =>
                    currentStepItem.kind === 'machine'
                      ? handleMachineStatusChange(currentStepItem.id, 'OK', true)
                      : handlePokayokeStatusChange(currentStepItem.id, 'OK', true)
                  }
                  className={`py-4 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                    currentStepItem.status === 'OK'
                      ? 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-2 border-emerald-300'
                  }`}
                >
                  <CheckCircle2 className="w-5 h-5" />
                  <span>PASS / OK</span>
                </button>

                <button
                  type="button"
                  onClick={() =>
                    currentStepItem.kind === 'machine'
                      ? handleMachineStatusChange(currentStepItem.id, 'NOT_OK', false)
                      : handlePokayokeStatusChange(currentStepItem.id, 'NOT_OK', false)
                  }
                  className={`py-4 px-4 rounded-2xl font-black text-sm sm:text-base flex items-center justify-center gap-2 transition-all active:scale-95 shadow-sm ${
                    currentStepItem.status === 'NOT_OK'
                      ? 'bg-rose-600 text-white ring-2 ring-rose-400'
                      : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-2 border-rose-300'
                  }`}
                >
                  <XCircle className="w-5 h-5" />
                  <span>NOT OK</span>
                </button>
              </div>
            </div>
          ) : (
            /* SUMMARY / READY TO SUBMIT CARD */
            <div className="space-y-5 py-4 text-center">
              <div className="w-12 h-12 bg-emerald-100 text-emerald-700 rounded-full flex items-center justify-center mx-auto">
                <ShieldCheck className="w-7 h-7" />
              </div>

              <div>
                <h3 className="text-xl font-black text-slate-900">Checklist Ready</h3>
                <p className="text-xs text-slate-500 mt-1">
                  Station {activeStation.number} inspection verified.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3 text-left">
                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Machine Checks</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    {machineCheckpoints.filter((c) => c.status === 'OK').length} / {machineCheckpoints.length} OK
                  </span>
                </div>

                <div className="bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">Pokayoke Checks</span>
                  <span className="text-base font-bold font-mono text-slate-900">
                    {pokayokeCheckpoints.filter((c) => c.status === 'OK').length} / {pokayokeCheckpoints.length} OK
                  </span>
                </div>
              </div>

              {submitError && (
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 text-left">
                  <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>{submitError}</span>
                </div>
              )}

              <button
                type="button"
                onClick={handleSubmitChecklist}
                className="w-full py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl transition-all shadow-md flex items-center justify-center gap-2 active:scale-98"
              >
                <Send className="w-4 h-4" />
                <span>Submit Checklist</span>
              </button>
            </div>
          )}

          {/* BOTTOM STEP NAVIGATION */}
          <div className="border-t border-slate-100 pt-4 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={activeStepIndex === 0}
              onClick={() => setActiveStepIndex((prev) => Math.max(0, prev - 1))}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 text-slate-700 hover:bg-slate-200 disabled:opacity-30 flex items-center gap-1 transition-all"
            >
              <ChevronLeft className="w-4 h-4" /> Prev
            </button>

            {/* Quick Step Indicator Pills */}
            <div className="flex items-center gap-1 overflow-x-auto px-1 py-1 max-w-[220px] sm:max-w-xs scrollbar-none">
              {allSteps.map((step, idx) => {
                const isCurrent = idx === activeStepIndex;
                let bgClass = 'bg-slate-200 text-slate-600';
                if (step.status === 'OK') bgClass = 'bg-emerald-500 text-white';
                if (step.status === 'NOT_OK') bgClass = 'bg-rose-500 text-white';

                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepIndex(idx)}
                    className={`w-6 h-6 rounded-lg text-[10px] font-bold shrink-0 transition-all flex items-center justify-center ${bgClass} ${
                      isCurrent ? 'ring-2 ring-slate-900 font-black scale-110' : 'opacity-80 hover:opacity-100'
                    }`}
                  >
                    {idx + 1}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setActiveStepIndex((prev) => Math.min(totalStepsCount, prev + 1))}
              className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white hover:bg-slate-800 flex items-center gap-1 transition-all active:scale-95"
            >
              {isSummaryStep ? 'Summary' : activeStepIndex === totalStepsCount - 1 ? 'Review' : 'Next'}
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* 3. LEAN LIST VIEW (`guided_list`) */}
      {viewMode === 'guided_list' && (
        <div className="space-y-3">
          {allSteps.map((step, idx) => {
            return (
              <div
                key={step.id}
                className={`bg-white border rounded-2xl p-3.5 sm:p-4 shadow-2xs transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  step.status === 'OK'
                    ? 'border-emerald-200 bg-emerald-50/30'
                    : step.status === 'NOT_OK'
                    ? 'border-rose-200 bg-rose-50/30'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-black shrink-0 ${
                      step.status === 'OK'
                        ? 'bg-emerald-600 text-white'
                        : step.status === 'NOT_OK'
                        ? 'bg-rose-600 text-white'
                        : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    #{idx + 1}
                  </div>

                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-black text-slate-900">{step.title}</span>
                      <span className="text-[10px] text-slate-500 font-mono">({step.freq})</span>
                    </div>
                    <p className="text-[11px] font-mono text-amber-900 font-bold mt-0.5">
                      {step.specLabel}: {step.specValue}
                    </p>
                  </div>
                </div>

                {/* Right: Camera + Status Buttons */}
                <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                  <button
                    type="button"
                    onClick={() =>
                      handleOpenCamera(
                        step.id,
                        step.kind === 'pokayoke',
                        step.photoRequirementLabel,
                        step.title
                      )
                    }
                    className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1 border transition-all ${
                      step.photos.length > 0
                        ? 'bg-emerald-50 text-emerald-800 border-emerald-300'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                    title="Attach live photo"
                  >
                    <Camera className="w-3.5 h-3.5 text-amber-600" />
                    {step.photos.length > 0 && <span className="text-[10px] font-mono">({step.photos.length})</span>}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      step.kind === 'machine'
                        ? handleMachineStatusChange(step.id, 'OK', false)
                        : handlePokayokeStatusChange(step.id, 'OK', false)
                    }
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      step.status === 'OK'
                        ? 'bg-emerald-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                    }`}
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>OK</span>
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      step.kind === 'machine'
                        ? handleMachineStatusChange(step.id, 'NOT_OK', false)
                        : handlePokayokeStatusChange(step.id, 'NOT_OK', false)
                    }
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1 ${
                      step.status === 'NOT_OK'
                        ? 'bg-rose-600 text-white shadow-2xs'
                        : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-rose-50 hover:text-rose-700'
                    }`}
                  >
                    <XCircle className="w-3.5 h-3.5" />
                    <span>NOT OK</span>
                  </button>
                </div>
              </div>
            );
          })}

          {/* Submit bar in list view */}
          <div className="pt-2">
            {submitError && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs flex items-center gap-2 mb-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{submitError}</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleSubmitChecklist}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm rounded-2xl transition-all shadow-sm flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              <span>Submit Verified Checklist ({completedCount}/{totalStepsCount})</span>
            </button>
          </div>
        </div>
      )}

      {/* Camera Modal */}
      {activeCameraTarget && (
        <CameraModal
          isOpen={true}
          onClose={() => setActiveCameraTarget(null)}
          onCapture={handlePhotoCaptured}
          checkpointTitle={activeCameraTarget.title}
          stationNumber={activeStation.number}
          minifactoryName={currentMf?.name || ''}
          lineName={currentLine?.name || ''}
          operatorId={operatorId}
          photoTypeLabel={activeCameraTarget.photoTypeLabel}
          locationCoords={location}
        />
      )}

      {/* Deviation Modal */}
      {activeDeviationTarget && (
        <DeviationModal
          isOpen={true}
          onClose={() => setActiveDeviationTarget(null)}
          onSave={handleSaveDeviation}
          stationNumber={activeStation.number}
          minifactoryId={currentMf?.id || ''}
          lineId={currentLine?.id || ''}
          locationLabel={`${currentMf?.name || ''} - ${currentLine?.name || ''}`}
          checkpointName={activeDeviationTarget.checkpointName}
        />
      )}

      {/* OPERATOR / STATION SETUP MODAL (Only when explicitly opened via gear/icon) */}
      {showSetupModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-3 animate-fadeIn">
          <div className="bg-white rounded-3xl border border-slate-200 shadow-2xl max-w-md w-full p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-black text-slate-900">Station & Operator Setup</h3>
                <p className="text-xs text-slate-500">Configure station for inspection</p>
              </div>
              <button
                type="button"
                onClick={() => setShowSetupModal(false)}
                className="text-slate-400 hover:text-slate-600 text-sm font-bold"
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div className="p-2.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-xs">
                {modalError}
              </div>
            )}

            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Minifactory</label>
                <select
                  value={modalMfId}
                  onChange={(e) => {
                    const id = e.target.value;
                    setModalMfId(id);
                    const mf = minifactories.find((m) => m.id === id);
                    if (mf?.lines?.length) {
                      setModalLineId(mf.lines[0].id);
                      if (mf.lines[0].stations?.length) {
                        setModalStationId(mf.lines[0].stations[0].id);
                      }
                    }
                  }}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                >
                  {minifactories.map((mf) => (
                    <option key={mf.id} value={mf.id}>
                      {mf.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Station</label>
                <select
                  value={modalStationId}
                  onChange={(e) => setModalStationId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                >
                  {(
                    minifactories
                      .find((m) => m.id === modalMfId)
                      ?.lines?.find((l) => l.id === modalLineId)?.stations || []
                  ).map((s) => (
                    <option key={s.id} value={s.id}>
                      Station {s.number} - {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operator ID</label>
                  <input
                    type="text"
                    value={modalOperatorId}
                    onChange={(e) => setModalOperatorId(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Operator Name</label>
                  <input
                    type="text"
                    value={modalOperatorName}
                    onChange={(e) => setModalOperatorName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-xl font-bold text-slate-800"
                  />
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSaveSetupModal}
              className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-xs rounded-xl shadow-sm transition-all"
            >
              Apply Settings
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
