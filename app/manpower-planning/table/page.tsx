"use client";

import { useSearchParams } from "next/navigation";
import ManpowerTable from "@/app/components/ManpowerTable";

export default function TablePage() {
  const searchParams = useSearchParams();
  const start = searchParams.get("start") || "";
  const end = searchParams.get("end") || "";

  // you could parse or validate the dates if needed
  const weekString = start && end ? `start=${start}&end=${end}` : "";

  return (
    <div>
      <h1 className="sr-only">Manpower Planning</h1>
      {weekString ? (
        <ManpowerTable week={weekString} />
      ) : (
        <p className="p-8">No week selected. Please go back and pick a week.</p>
      )}
    </div>
  );
}
