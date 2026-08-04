import { NextResponse } from "next/server";
import { runCorrectionLoop } from "@/jobs/correction_worker";

export async function POST() {
  try {
    const result = await runCorrectionLoop();
    return NextResponse.json({ success: true, count: result.count });
  } catch (error) {
    console.error("Failed to run self-correction loop:", error);
    return NextResponse.json(
      { error: "Failed to run self-correction loop" },
      { status: 500 }
    );
  }
}
