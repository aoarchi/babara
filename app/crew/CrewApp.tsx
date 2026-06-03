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
  deleteDoc,
  updateDoc,
} from "firebase/firestore";
import { QRCodeSVG } from "qrcode.react";

interface FriendRequest {
  uid: string;
  displayName: string;
  photoURL: string;
  status: string;
  direction: string;
}

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
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [showQR, setShowQR] = useState(false);

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

  useEffect(() => {
    if (!user) { setFriendRequests([]); return; }
    return onSnapshot(collection(db, "crews", user.uid, "friends"), (snap) => {
      const incoming = snap.docs
        .map((d) => ({ uid: d.id, ...d.data() } as FriendRequest))
        .filter((f) => f.status === "pending" && f.direction === "received");
      setFriendRequests(incoming);
    });
  }, [user]);

  const acceptFriend = async (fromUid: string) => {
    if (!user) return;
    await updateDoc(doc(db, "crews", user.uid, "friends", fromUid), { status: "accepted" });
    await updateDoc(doc(db, "crews", fromUid, "friends", user.uid), { status: "accepted" });
  };

  const rejectFriend = async (fromUid: string) => {
    if (!user) return;
    await deleteDoc(doc(db, "crews", user.uid, "friends", fromUid));
    await deleteDoc(doc(db, "crews", fromUid, "friends", user.uid));
  };

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

  const navItems = [
    {
      label: "친구",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
          <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
        </svg>
      ),
    },
    {
      label: "저장됨",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
        </svg>
      ),
    },
    {
      label: "방",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
        </svg>
      ),
    },
    {
      label: "지도",
      href: "/babara/map/",
      icon: (
        <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
          <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" /><circle cx="12" cy="10" r="3" />
        </svg>
      ),
    },
  ];

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
        <div className="flex items-center gap-3">
          {user.photoURL ? (
            <img src={user.photoURL} className="w-8 h-8 rounded-full" alt="" referrerPolicy="no-referrer" />
          ) : (
            <div className="w-8 h-8 rounded-full bg-slate-700" />
          )}
          <button
            onClick={() => signOut(auth)}
            className="text-xs text-slate-500 hover:text-white transition-colors"
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 바디 */}
      <div className="pt-14 pb-20 md:pb-6 max-w-5xl mx-auto flex gap-4 px-3 py-4">

        {/* 좌측 사이드바 (데스크탑) */}
        <div className="hidden md:flex flex-col w-64 shrink-0 gap-1">
          {/* 프로필 */}
          <div className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-200 transition-colors">
            {user.photoURL ? (
              <img src={user.photoURL} className="w-9 h-9 rounded-full" alt="" referrerPolicy="no-referrer" />
            ) : (
              <div className="w-9 h-9 rounded-full bg-slate-300" />
            )}
            <div className="flex flex-col gap-2">
              <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
              <button
                onClick={() => profile?.isLocationVisible ? hideLocation() : shareLocation()}
                disabled={locSharing}
                className="flex items-center gap-2 disabled:opacity-50"
              >
                <div className={`relative w-10 h-6 rounded-full transition-colors duration-200 ${profile?.isLocationVisible ? "bg-green-500" : "bg-slate-300"}`}>
                  <div className={`absolute top-1 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${profile?.isLocationVisible ? "translate-x-5" : "translate-x-1"}`} />
                </div>
                <span className={`text-xs ${profile?.isLocationVisible ? "text-green-600" : "text-slate-400"}`}>
                  {locSharing ? "가져오는 중..." : profile?.isLocationVisible ? "위치 공유 중" : "위치 비공개"}
                </span>
              </button>
            </div>
          </div>

          <div className="border-t border-slate-200 my-1" />

          {/* QR / 링크 공유 */}
          <div>
            <button
              onClick={() => setShowQR(!showQR)}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-200 transition-colors"
            >
              <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-700">
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth={2}>
                  <rect x="3" y="3" width="5" height="5"/><rect x="16" y="3" width="5" height="5"/>
                  <rect x="3" y="16" width="5" height="5"/><path d="M21 16h-3v3"/><path d="M21 21h-3"/><path d="M16 21v-3"/>
                  <path d="M11 3v2"/><path d="M11 8v2"/><path d="M3 11h2"/><path d="M8 11h2"/><path d="M11 13h2"/><path d="M11 18h2"/><path d="M16 11h2"/>
                </svg>
              </div>
              <span className="text-sm font-medium text-slate-800">내 QR / 링크</span>
            </button>
            {showQR && (
              <div className="mx-3 mt-2 p-4 bg-white rounded-xl shadow-sm space-y-3">
                <div className="flex justify-center">
                  <QRCodeSVG
                    value={`${typeof window !== "undefined" ? window.location.origin : ""}/babara/profile/?uid=${user.uid}`}
                    size={160}
                  />
                </div>
                <button
                  onClick={() => {
                    const url = `${window.location.origin}/babara/profile/?uid=${user.uid}`;
                    navigator.clipboard.writeText(url);
                  }}
                  className="w-full py-2 border border-slate-200 text-slate-600 rounded-lg text-xs font-medium hover:bg-slate-50 transition-colors"
                >
                  링크 복사
                </button>
              </div>
            )}
          </div>

          <div className="border-t border-slate-200 my-1" />

          {navItems.map((item) => (
            <div
              key={item.label}
              onClick={() => item.href && window.location.assign(item.href)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-slate-200 cursor-pointer transition-colors"
            >
              <div className="w-9 h-9 bg-slate-200 rounded-full flex items-center justify-center text-slate-700">
                {item.icon}
              </div>
              <span className="text-sm font-medium text-slate-800">{item.label}</span>
            </div>
          ))}

        </div>

        {/* 메인 피드 */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* 친구 요청 알림 */}
        {friendRequests.length > 0 && (
          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <p className="text-sm font-semibold text-slate-900">
              친구 요청 <span className="text-red-500">{friendRequests.length}</span>
            </p>
            {friendRequests.map((req) => (
              <div key={req.uid} className="flex items-center gap-3">
                {req.photoURL ? (
                  <img src={req.photoURL} className="w-10 h-10 rounded-full shrink-0" alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
                )}
                <span
                  className="flex-1 text-sm font-medium text-slate-800 cursor-pointer hover:underline"
                  onClick={() => window.location.assign(`/babara/profile/?uid=${req.uid}`)}
                >
                  {req.displayName}
                </span>
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => acceptFriend(req.uid)}
                    className="px-3 py-1.5 bg-slate-900 text-white rounded-lg text-xs font-medium"
                  >
                    수락
                  </button>
                  <button
                    onClick={() => rejectFriend(req.uid)}
                    className="px-3 py-1.5 border border-slate-200 text-slate-500 rounded-lg text-xs"
                  >
                    거절
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* 근황 작성 */}
          <div className="bg-white rounded-2xl p-4 shadow-sm">
            <div className="flex gap-3 items-center mb-3">
              {user.photoURL ? (
                <img src={user.photoURL} className="w-10 h-10 rounded-full shrink-0" alt="" referrerPolicy="no-referrer" />
              ) : (
                <div className="w-10 h-10 rounded-full bg-slate-200 shrink-0" />
              )}
              <button
                onClick={() => document.getElementById("post-input")?.focus()}
                className="flex-1 text-left px-4 py-2.5 bg-slate-100 hover:bg-slate-200 rounded-full text-sm text-slate-400 transition-colors"
              >
                지금 뭐 하고 있나요?
              </button>
            </div>
            <div className="border-t border-slate-100 pt-3">
              <textarea
                id="post-input"
                value={postText}
                onChange={(e) => setPostText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) submitPost();
                }}
                placeholder="근황을 입력하세요..."
                rows={postText ? 3 : 1}
                className="w-full text-sm outline-none resize-none placeholder:text-slate-300 text-slate-800 transition-all"
              />
              {postText.trim() && (
                <div className="flex justify-end mt-2">
                  <button
                    onClick={submitPost}
                    className="px-5 py-2 bg-slate-900 text-white rounded-xl text-xs font-semibold"
                  >
                    올리기
                  </button>
                </div>
              )}
            </div>
          </div>


          {/* 포스트 피드 */}
          {posts.length === 0 && (
            <div className="bg-white rounded-2xl p-8 shadow-sm text-center">
              <p className="text-sm text-slate-300">첫 근황을 올려보세요</p>
            </div>
          )}
          {posts.map((post) => (
            <div key={post.id} className="bg-white rounded-2xl p-4 shadow-sm">
              <div className="flex items-center gap-3 mb-3">
                {user.photoURL ? (
                  <img src={user.photoURL} className="w-10 h-10 rounded-full" alt="" referrerPolicy="no-referrer" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-slate-200" />
                )}
                <p className="text-sm font-semibold text-slate-900">{user.displayName}</p>
              </div>
              <p className="text-sm text-slate-700 leading-relaxed">{post.text}</p>
            </div>
          ))}
        </div>
      </div>

      {/* 모바일 하단 네비 */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-slate-100 flex justify-around py-2 z-50">
        {navItems.map((item) => (
          <button
            key={item.label}
            onClick={() => item.href && window.location.assign(item.href)}
            className="flex flex-col items-center gap-0.5 px-4 py-1 text-slate-500"
          >
            {item.icon}
            <span className="text-[10px]">{item.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
