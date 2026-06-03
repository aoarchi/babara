"use client";

import { useState, useEffect } from "react";
import { auth, db } from "@/lib/firebase";
import {
  GoogleAuthProvider,
  signInWithPopup,
  signOut,
  onAuthStateChanged,
  User,
} from "firebase/auth";
import {
  doc,
  setDoc,
  getDoc,
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  limit,
  serverTimestamp,
} from "firebase/firestore";

interface CrewProfile {
  displayName: string;
  photoURL: string;
  isLocationVisible: boolean;
  location?: { lat: number; lng: number };
}

interface Post {
  id: string;
  uid: string;
  displayName: string;
  photoURL: string;
  text: string;
  createdAt: unknown;
}

export default function CrewApp() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<CrewProfile | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [postText, setPostText] = useState("");
  const [locSharing, setLocSharing] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setAuthLoading(false);
    });
  }, []);

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }
    const crewRef = doc(db, "crews", user.uid);
    getDoc(crewRef).then((snap) => {
      if (!snap.exists()) {
        setDoc(crewRef, {
          displayName: user.displayName ?? "크루",
          photoURL: user.photoURL ?? "",
          isLocationVisible: false,
        });
      }
    });
    return onSnapshot(crewRef, (snap) => {
      if (snap.exists()) setProfile(snap.data() as CrewProfile);
    });
  }, [user]);

  useEffect(() => {
    if (!user) {
      setPosts([]);
      return;
    }
    const q = query(
      collection(db, "posts"),
      orderBy("createdAt", "desc"),
      limit(50)
    );
    return onSnapshot(q, (snap) => {
      const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Post));
      setPosts(all.filter((p) => p.uid === user.uid));
    });
  }, [user]);

  const signIn = async () => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const shareLocation = () => {
    if (!user) return;
    setLocSharing(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await setDoc(
          doc(db, "crews", user.uid),
          {
            location: { lat: pos.coords.latitude, lng: pos.coords.longitude },
            isLocationVisible: true,
            locationUpdatedAt: serverTimestamp(),
          },
          { merge: true }
        );
        setLocSharing(false);
      },
      () => setLocSharing(false),
      { enableHighAccuracy: true }
    );
  };

  const hideLocation = async () => {
    if (!user) return;
    await setDoc(
      doc(db, "crews", user.uid),
      { isLocationVisible: false },
      { merge: true }
    );
  };

  const submitPost = async () => {
    const text = postText.trim();
    if (!text || !user) return;
    setPostText("");
    await addDoc(collection(db, "posts"), {
      uid: user.uid,
      displayName: user.displayName ?? "크루",
      photoURL: user.photoURL ?? "",
      text,
      createdAt: serverTimestamp(),
    });
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-white">
        <div className="text-slate-300 text-sm">로딩 중...</div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex flex-col lg:flex-row">
        {/* 왼쪽: 브랜딩 */}
        <div className="bg-slate-900 flex flex-col justify-center px-10 py-14 lg:flex-1 lg:py-0">
          {/* b 로고 */}
          <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center mb-7 shadow-sm">
            <span
              className="text-slate-900 font-bold leading-none select-none"
              style={{ fontSize: 36, fontFamily: "Georgia, 'Times New Roman', serif" }}
            >
              b
            </span>
          </div>
          <h1 className="text-white text-4xl lg:text-5xl font-bold tracking-tight">babara</h1>
          <p className="text-slate-400 text-base mt-3 leading-relaxed">
            Be with Babara
          </p>
        </div>

        {/* 오른쪽: 로그인 카드 */}
        <div className="bg-white flex items-center justify-center px-8 py-12 lg:flex-1">
          <div className="w-full max-w-sm space-y-5">
            <div>
              <h2 className="text-xl font-semibold text-slate-900">babara에 로그인</h2>
              <p className="text-sm text-slate-400 mt-1">크루 계정으로 시작하세요</p>
            </div>

            <button
              onClick={signIn}
              className="w-full flex items-center justify-center gap-2.5 px-5 py-3.5 bg-slate-900 text-white rounded-xl text-sm font-medium hover:bg-slate-800 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" xmlns="http://www.w3.org/2000/svg">
                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
              </svg>
              Google로 시작하기
            </button>

            <div className="relative flex items-center gap-3">
              <div className="flex-1 border-t border-slate-100" />
              <span className="text-xs text-slate-300 shrink-0">또는</span>
              <div className="flex-1 border-t border-slate-100" />
            </div>

            <p className="text-xs text-center text-slate-400 leading-relaxed">
              Google 계정으로 로그인하면<br />크루 프로필이 자동으로 생성돼요
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto min-h-screen bg-white">
      {/* 헤더 */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          {user.photoURL ? (
            <img src={user.photoURL} className="w-7 h-7 rounded-full" alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-7 h-7 rounded-full bg-slate-200" />
          )}
          <span className="text-sm font-semibold text-slate-900">{user.displayName}</span>
        </div>
        <button
          onClick={() => signOut(auth)}
          className="text-xs text-slate-400 hover:text-slate-600"
        >
          로그아웃
        </button>
      </div>

      <div className="px-4 py-4 space-y-4 pb-12">
        {/* 위치 공유 카드 */}
        <div className="border border-slate-100 rounded-xl p-4 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-slate-700">내 위치 공유</span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                profile?.isLocationVisible
                  ? "bg-green-50 text-green-600"
                  : "bg-slate-100 text-slate-400"
              }`}
            >
              {profile?.isLocationVisible ? "공유 중" : "비공개"}
            </span>
          </div>
          <p className="text-xs text-slate-400">
            팬들이 지도에서 내 위치를 볼 수 있어요. 버튼을 누르면 현재 위치로 업데이트돼요.
          </p>
          <div className="flex gap-2">
            <button
              onClick={shareLocation}
              disabled={locSharing}
              className="flex-1 py-2.5 bg-slate-900 text-white rounded-lg text-xs font-medium disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
            >
              {locSharing ? "위치 가져오는 중..." : "현재 위치로 공유"}
            </button>
            {profile?.isLocationVisible && (
              <button
                onClick={hideLocation}
                className="px-4 py-2.5 border border-slate-200 text-slate-500 rounded-lg text-xs hover:bg-slate-50 transition-colors"
              >
                숨기기
              </button>
            )}
          </div>
        </div>

        {/* 근황 올리기 */}
        <div className="border border-slate-100 rounded-xl p-4 space-y-3">
          <span className="text-sm font-medium text-slate-700">근황 올리기</span>
          <textarea
            value={postText}
            onChange={(e) => setPostText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitPost();
            }}
            placeholder="지금 뭐 하고 있나요?"
            rows={3}
            className="w-full text-sm border border-slate-200 rounded-lg px-3 py-2 outline-none focus:border-slate-400 resize-none"
          />
          <button
            onClick={submitPost}
            disabled={!postText.trim()}
            className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-sm font-medium disabled:bg-slate-100 disabled:text-slate-400 transition-colors"
          >
            올리기
          </button>
        </div>

        {/* 내 근황 */}
        {posts.length > 0 && (
          <div className="space-y-3">
            <p className="text-xs font-medium text-slate-400 uppercase tracking-wide">내 근황</p>
            {posts.map((post) => (
              <div key={post.id} className="border border-slate-100 rounded-xl p-3">
                <p className="text-sm text-slate-700 leading-relaxed">{post.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
