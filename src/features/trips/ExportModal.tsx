import React from "react";
import { Trip } from "../../types";
import { PrintExportStudio } from "../export/PrintExportStudio";

export interface ExportModalProps {
  trip: Trip;
  isOpen: boolean;
  onClose: () => void;
  onNotify?: (msg: string, type: "success" | "error" | "info") => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  trip,
  isOpen,
  onClose,
  onNotify,
}) => {
  return (
    <PrintExportStudio
      trip={trip}
      isOpen={isOpen}
      onClose={onClose}
      onNotify={onNotify}
    />
  );
};
