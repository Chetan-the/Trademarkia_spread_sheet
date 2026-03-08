"use client";

import { useParams } from "next/navigation";
import Spreadsheet from "@/components/Spreadsheet";

export default function SpreadsheetPage() {
  const params = useParams();

  if (!params.id || typeof params.id !== "string") {
    return <div>Loading...</div>;
  }

  return (
    <div className="h-screen w-full flex flex-col bg-white">
      <Spreadsheet docId={params.id} />
    </div>
  );
}