import { NextRequest, NextResponse } from "next/server";
import jwt from "jsonwebtoken";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/nextauth"; 

export async function GET(request: NextRequest) {
  try {
    // 1. Get the current OSC session
    const session = await getServerSession(authOptions);

    // 2. If no session, redirect to the OSC login page
    if (!session || !session.user) {
      const loginUrl = new URL("/login", request.url);
      return NextResponse.redirect(loginUrl);
    }

    // 3. Sign the secure token using the Shared Secret
    const secret = process.env.SHARED_SSO_SECRET;
    if (!secret) {
      console.error("SSO Error: SHARED_SSO_SECRET is missing in .env");
      return NextResponse.json({ error: "Server Configuration Error" }, { status: 500 });
    }

    const token = jwt.sign(
      { email: session.user.email }, 
      secret, 
      { expiresIn: "60s" } 
    );

    // 🟢 UPDATED URL: Changed '/api/auth/sso' to '/api/sso'
    // This must match the folder you just created in the Inventory project
    const targetUrl = `https://inventory.ebright.my/api/sso?token=${token}`;
    
    return NextResponse.redirect(targetUrl);
  } catch (error) {
    console.error("OSC SSO Launch Error:", error);
    return NextResponse.json({ error: "SSO Launch Failed" }, { status: 500 });
  }
}