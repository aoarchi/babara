"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  onSnapshot,
  query,
  orderBy,
  limit,
  setDoc,
  deleteDoc,
  updateDoc,
  serverTimestamp,
} from "firebase/firestore";

interface UserProfile {
  displayName: string;
  photoURL: string;
}

interface Post {
  id: string;
  uid: string;
  text: string;
  createdAt: unknown;
}

type FriendStatus = "none" | "sent" | "received" | "accepted";

export default function ProfileApp() {
  const searchParams = useSearchParams();
  const targetUid = searchParams.get("uid") ?? "";

  const [viewer, setViewer] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [friendStatus, setFriendStatus] = useState<FriendStatus>("none");
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setViewer(u);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!targetUid) return;
    getDoc(doc(db, "crews", targetUid)).then((snap) => {
      if (snap.exists()) setProfile(snap.data() as UserProfile);
      setProfileLoading(false);
    });
  }, [targetUid]);

  useEffect(() => {
    if (!targetUid) return;
    const q = query(collection(db, "posts"), orderBy("createdAt", "desc"), limit(50));
    return onSnapshot(q, (snap) => {
      setPosts(
        snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as Post))
          .filter((p) => p.uid === targetUid)
      );
    });
  }, [targetUid]);

  useEffect(() => {
    if (!viewer || !targetUid || viewer.uid === targetUid) return;
    return onSnapshot(doc(db, "crews", viewer.uid, "friends", targetUid), (snap) => {
      if (!snap.exists()) { setFriendStatus("none"); return; }
      const d = snap.data();
      if (d.status === "accepted") setFriendStatus("accepted");
      else setFriendStatus(d.direction === "sent" ? "sent" : "received");
    });
  }, [viewer, targetUid]);

  const signIn = async () => {
    await signInWithPopup(auth, new GoogleAuthProvider());
  };

  const sendRequest = async () => {
    if (!viewer || !targetUid || !profile) return;
    await setDoc(doc(db, "crews", viewer.uid, "friends", targetUid), {
      status: "pending", direction: "sent",
      displayName: profile.displayName, photoURL: profile.photoURL,
      createdAt: serverTimestamp(),
    });
    await setDoc(doc(db, "crews", targetUid, "friends", viewer.uid), {
      status: "pending", direction: "received",
      displayName: viewer.displayName ?? "", photoURL: viewer.photoURL ?? "",
      createdAt: serverTimestamp(),
    });
  };

  const cancelRequest = async () => {
    if (!viewer || !targetUid) return;
    await deleteDoc(doc(db, "crews", viewer.uid, "friends", targetUid));
    await deleteDoc(doc(db, "crews", targetUid, "friends", viewer.uid));
  };

  const acceptRequest = async () => {
    if (!viewer || !targetUid) return;
    await updateDoc(doc(db, "crews", viewer.uid, "friends", targetUid), { status: "accepted" });
    await updateDoc(doc(db, "crews", targetUid, "friends", viewer.uid), { status: "accepted" });
  };

  const isSelf = viewer?.uid === targetUid;

  if (profileLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-slate-300 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <p className="text-slate-400 text-sm">존재하지 않는 프로필이에요</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100">
      {/* 상단 네비바 */}
      <div className="fixed top-0 left-0 right-0 z-50 bg-slate-900 h-14 flex items-center px-4 justify-between shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shrink-0">
            <span
              className="text-slate-900 font-bold leading-none"
              style={{ fontSize: 22, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              b
            </span>
          </div>
          <span className="text-white font-semibold text-sm hidden sm:block">babara</span>
        </div>
        {!authLoading && (
          viewer ? (
            <button
              onClick={() => window.location.assign("/babara/crew/")}
              className="text-xs text-slate-400 hover:text-white transition-colors"
            >
              홈으로
            </button>
          ) : (
            <button
              onClick={signIn}
              className="text-xs text-white bg-slate-700 px-3 py-1.5 rounded-lg hover:bg-slate-600 transition-colors"
            >
              로그인
            </button>
          )
        )}
      </div>

      <div className="pt-14 max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* 프로필 카드 */}
        <div className="bg-white rounded-2xl shadow-sm overflow-hidden">
          <div className="bg-slate-900 h-20" />
          <div className="px-5 pb-5">
            <div className="-mt-10 mb-3">
              {profile.photoURL ? (
                <img
                  src={profile.photoURL}
                  className="w-20 h-20 rounded-full border-4 border-white"
                  alt=""
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-20 h-20 rounded-full bg-slate-200 border-4 border-white" />
              )}
            </div>
            <div className="flex items-end justify-between">
              <div>
                <h1 className="text-xl font-bold text-slate-900">{profile.displayName}</h1>
              </div>
              {!isSelf && !authLoading && (
                <div className="flex gap-2">
                  {!viewer && (
                    <button
                      onClick={signIn}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium"
                    >
                      로그인 후 친구 추가
                    </button>
                  )}
                  {viewer && friendStatus === "none" && (
                    <button
                      onClick={sendRequest}
                      className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium"
                    >
                      + 친구 추가
                    </button>
                  )}
                  {viewer && friendStatus === "sent" && (
                    <button
                      onClick={cancelRequest}
                      className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-sm font-medium"
                    >
                      요청 취소
                    </button>
                  )}
                  {viewer && friendStatus === "received" && (
                    <div className="flex gap-2">
                      <button
                        onClick={acceptRequest}
                        className="px-4 py-2 bg-slate-900 text-white rounded-xl text-sm font-medium"
                      >
                        수락
                      </button>
                      <button
                        onClick={cancelRequest}
                        className="px-4 py-2 border border-slate-200 text-slate-500 rounded-xl text-sm font-medium"
                      >
                        거절
                      </button>
                    </div>
                  )}
                  {viewer && friendStatus === "accepted" && (
                    <span className="px-4 py-2 bg-green-50 text-green-600 rounded-xl text-sm font-medium">
                      친구 ✓
                    </span>
                  )}
                </div>
              )}
              {isSelf && (
                <span className="text-xs text-slate-400">내 프로필</span>
              )}
            </div>
          </div>
        </div>

        {/* 포스트 */}
        {posts.length === 0 && (
          <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
            <p className="text-sm text-slate-300">아직 올린 근황이 없어요</p>
          </div>
        )}
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex items-center gap-3 mb-3">
              {profile.photoURL ? (
                <img src={profile.photoURL} className="w-9 h-9 rounded-full" alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-9 h-9 rounded-full bg-slate-200" />
              )}
              <span className="text-sm font-semibold text-slate-900">{profile.displayName}</span>
            </div>
            <p className="text-sm text-slate-700 leading-relaxed">{post.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
