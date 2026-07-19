import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";

const createUserSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  role: z.enum(["admin", "user"]),
});

async function findUserByEmail(admin: ReturnType<typeof getSupabaseAdmin>, email: string) {
  if (!admin) {
    return null;
  }

  const normalizedEmail = email.toLocaleLowerCase();

  for (let page = 1; page <= 20; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });

    if (error) {
      throw error;
    }

    const user = data.users.find((item) => item.email?.toLocaleLowerCase() === normalizedEmail);
    if (user) {
      return user;
    }

    if (data.users.length < 1000) {
      return null;
    }
  }

  return null;
}

function getSupabaseAdmin() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return null;
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

export async function POST(request: Request) {
  const admin = getSupabaseAdmin();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!admin || !supabaseUrl || !anonKey) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY is not configured." }, { status: 500 });
  }

  const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) {
    return NextResponse.json({ error: "Authorization token is required." }, { status: 401 });
  }

  const userClient = createClient(supabaseUrl, anonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  const {
    data: { user },
    error: userError,
  } = await userClient.auth.getUser(token);

  if (userError || !user) {
    return NextResponse.json({ error: "ログイン状態を確認できませんでした。" }, { status: 401 });
  }

  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();

  if (profileError || profile?.role !== "admin") {
    return NextResponse.json({ error: "管理者のみユーザーを追加できます。" }, { status: 403 });
  }

  const parsed = createUserSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "入力内容を確認してください。" }, { status: 400 });
  }

  const { email, name, role } = parsed.data;
  const origin = request.headers.get("origin") || process.env.NEXT_PUBLIC_APP_URL || undefined;
  const inviteRedirectTo = origin ? `${origin}/?auth_action=invite` : undefined;
  const recoveryRedirectTo = origin ? `${origin}/?auth_action=recovery` : undefined;
  const { data: invited, error: inviteError } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { name },
    redirectTo: inviteRedirectTo,
  });

  if (inviteError || !invited.user) {
    if (!inviteError?.message.toLocaleLowerCase().includes("already been registered")) {
      return NextResponse.json(
        { error: inviteError?.message || "ユーザー招待に失敗しました。" },
        { status: 400 },
      );
    }

    const existingUser = await findUserByEmail(admin, email);
    if (!existingUser) {
      return NextResponse.json({ error: inviteError.message }, { status: 400 });
    }

    const { error: upsertExistingError } = await admin.from("profiles").upsert({
      id: existingUser.id,
      name,
      role,
    });

    if (upsertExistingError) {
      return NextResponse.json({ error: upsertExistingError.message }, { status: 400 });
    }

    const { error: resetError } = await userClient.auth.resetPasswordForEmail(email, {
      redirectTo: recoveryRedirectTo,
    });

    if (resetError) {
      return NextResponse.json({ error: resetError.message }, { status: 400 });
    }

    return NextResponse.json({
      mode: "password_reset",
      profile: {
        id: existingUser.id,
        email,
        name,
        role,
      },
    });
  }

  const { error: upsertError } = await admin.from("profiles").upsert({
    id: invited.user.id,
    name,
    role,
  });

  if (upsertError) {
    return NextResponse.json({ error: upsertError.message }, { status: 400 });
  }

  return NextResponse.json({
    mode: "invited",
    profile: {
      id: invited.user.id,
      email,
      name,
      role,
    },
  });
}
