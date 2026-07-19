"use client";

import { useState } from "react";
import { useAppData } from "@/components/app-provider";
import { supabase } from "@/lib/supabase/client";

export default function AccountPage() {
  const { data, session, isAdmin } = useAppData();
  const activeProfile = data.profiles.find((profile) => profile.id === data.activeProfileId);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const updatePassword = async () => {
    if (!supabase || !session?.user.email) {
      return;
    }
    if (!currentPassword) {
      setMessage("現在のパスワードを入力してください。");
      return;
    }
    if (newPassword.length < 8) {
      setMessage("新しいパスワードは8文字以上で入力してください。");
      return;
    }
    if (newPassword !== confirmPassword) {
      setMessage("新しいパスワードと確認用パスワードが一致しません。");
      return;
    }

    setSubmitting(true);
    setMessage("");

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: session.user.email,
      password: currentPassword,
    });

    if (signInError) {
      setMessage("現在のパスワードが正しくありません。");
      setSubmitting(false);
      return;
    }

    const { error } = await supabase.auth.updateUser({ password: newPassword });

    if (error) {
      setMessage(`パスワード変更に失敗しました: ${error.message}`);
      setSubmitting(false);
      return;
    }

    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setSubmitting(false);
    setMessage("パスワードを変更しました。次回ログインから新しいパスワードを使用してください。");
  };

  const isError =
    message.includes("失敗") || message.includes("正しく") || message.includes("入力") || message.includes("一致");

  return (
    <>
      <div className="page-header">
        <div>
          <h1 className="page-title">アカウント設定</h1>
          <p className="page-subtitle">ログイン中のユーザー自身の設定だけを変更できます。</p>
        </div>
        <span className="badge">{isAdmin ? "管理者" : "一般"}</span>
      </div>

      <div className="grid cols-2">
        <section className="panel">
          <h2>ログイン情報</h2>
          <div className="grid">
            <div className="field">
              <label>氏名</label>
              <input className="input" value={activeProfile?.name || ""} readOnly />
            </div>
            <div className="field">
              <label>メールアドレス</label>
              <input className="input" value={session?.user.email || activeProfile?.email || ""} readOnly />
            </div>
            <div className="field">
              <label>権限</label>
              <input className="input" value={isAdmin ? "管理者" : "一般"} readOnly />
            </div>
          </div>
        </section>

        <section className="panel">
          <h2>パスワード変更</h2>
          <div className="auth-form">
            <div className="field">
              <label>現在のパスワード</label>
              <input
                className="input"
                autoComplete="current-password"
                type="password"
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
              />
            </div>
            <div className="field">
              <label>新しいパスワード</label>
              <input
                className="input"
                autoComplete="new-password"
                type="password"
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
              />
            </div>
            <div className="field">
              <label>新しいパスワード（確認）</label>
              <input
                className="input"
                autoComplete="new-password"
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
              />
            </div>
            {message && <p className={isError ? "error-text" : "muted"}>{message}</p>}
            <button className="button" disabled={submitting} type="button" onClick={() => void updatePassword()}>
              {submitting ? "変更中..." : "パスワードを変更"}
            </button>
          </div>
        </section>
      </div>
    </>
  );
}
