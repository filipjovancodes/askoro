import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { createClient } from "@/lib/supabase/server";

const signupSchema = z.object({
  email: z.string().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  name: z.string().min(1, "Name is required").optional(),
});

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);

  const parseResult = signupSchema.safeParse(body);

  if (!parseResult.success) {
    return NextResponse.json(
      {
        error: "Invalid request body",
        details: parseResult.error.flatten(),
      },
      { status: 400 },
    );
  }

  const { email, password, name } = parseResult.data;

  const supabase = await createClient();

  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: {
        name: name ?? email.split("@")[0],
      },
    },
  });

  if (error) {
    return NextResponse.json(
      {
        error: error.message,
      },
      { status: 400 },
    );
  }

  return NextResponse.json({
    user: data.user,
  });
}
